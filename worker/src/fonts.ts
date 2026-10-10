import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Converte arquivo WOFF (Web Open Font Format 1.0) para OpenType/TrueType padrão (SFNT).
 * A libass / FreeType requer SFNT clássico (.ttf / .otf).
 */
export function convertWoffToSfnt(buf: Buffer): Buffer {
  if (buf.length < 44) return buf;
  const signature = buf.toString("utf8", 0, 4);
  if (signature !== "wOFF") return buf;

  const flavor = buf.subarray(4, 8);
  const numTables = buf.readUInt16BE(12);

  // Monta cabeçalho SFNT (12 bytes)
  const sfntHeader = Buffer.alloc(12);
  flavor.copy(sfntHeader, 0);
  sfntHeader.writeUInt16BE(numTables, 4);

  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange << 1 <= numTables) {
    searchRange <<= 1;
    entrySelector++;
  }
  searchRange *= 16;
  const rangeShift = numTables * 16 - searchRange;

  sfntHeader.writeUInt16BE(searchRange, 6);
  sfntHeader.writeUInt16BE(entrySelector, 8);
  sfntHeader.writeUInt16BE(rangeShift, 10);

  const tableHeaders: Buffer[] = [];
  const tableData: Buffer[] = [];
  let sfntOffset = 12 + numTables * 16;

  for (let i = 0; i < numTables; i++) {
    const dirOffset = 44 + i * 20;
    if (dirOffset + 20 > buf.length) break;

    const tag = buf.subarray(dirOffset, dirOffset + 4);
    const offset = buf.readUInt32BE(dirOffset + 4);
    const compLength = buf.readUInt32BE(dirOffset + 8);
    const origLength = buf.readUInt32BE(dirOffset + 12);
    const origChecksum = buf.readUInt32BE(dirOffset + 16);

    let data = buf.subarray(offset, offset + compLength);
    if (compLength < origLength) {
      try {
        data = zlib.inflateSync(data);
      } catch {
        // Fallback se não conseguir descomprimir
      }
    }

    const tHeader = Buffer.alloc(16);
    tag.copy(tHeader, 0);
    tHeader.writeUInt32BE(origChecksum, 4);
    tHeader.writeUInt32BE(sfntOffset, 8);
    tHeader.writeUInt32BE(origLength, 12);
    tableHeaders.push(tHeader);

    // Padding de 4 bytes
    const pad = (4 - (data.length % 4)) % 4;
    tableData.push(data);
    if (pad > 0) {
      tableData.push(Buffer.alloc(pad));
    }
    sfntOffset += data.length + pad;
  }

  return Buffer.concat([sfntHeader, ...tableHeaders, ...tableData]);
}

/**
 * Lê o nome real da família tipográfica (Font Family) a partir da tabela 'name' do TTF/OTF.
 * Isso garante que o nome passado ao estilo ASS coincida exatamente com a fonte detectada pelo FreeType/libass.
 */
export function getFontFamilyName(input: Buffer | string): string | null {
  try {
    let buf = typeof input === "string" ? fs.readFileSync(input) : input;
    if (buf.toString("utf8", 0, 4) === "wOFF") {
      buf = convertWoffToSfnt(buf);
    }

    if (buf.length < 12) return null;
    const numTables = buf.readUInt16BE(4);
    let nameTableOffset = 0;

    for (let i = 0; i < numTables; i++) {
      const offset = 12 + i * 16;
      if (offset + 16 > buf.length) break;
      const tag = buf.toString("utf8", offset, offset + 4);
      if (tag === "name") {
        nameTableOffset = buf.readUInt32BE(offset + 8);
        break;
      }
    }

    if (!nameTableOffset || nameTableOffset + 6 > buf.length) return null;

    const count = buf.readUInt16BE(nameTableOffset + 2);
    const stringOffset = nameTableOffset + buf.readUInt16BE(nameTableOffset + 4);
    const names: Record<number, string> = {};

    for (let i = 0; i < count; i++) {
      const recordOffset = nameTableOffset + 6 + i * 12;
      if (recordOffset + 12 > buf.length) break;

      const platformId = buf.readUInt16BE(recordOffset);
      const nameId = buf.readUInt16BE(recordOffset + 6);
      const length = buf.readUInt16BE(recordOffset + 8);
      const strOffset = stringOffset + buf.readUInt16BE(recordOffset + 10);

      if (strOffset + length > buf.length) continue;

      let val = "";
      if (platformId === 0 || platformId === 3) {
        // UTF-16BE (Windows / Unicode standard)
        const sub = Buffer.from(buf.subarray(strOffset, strOffset + length));
        sub.swap16();
        val = sub.toString("utf16le").trim();
      } else {
        // Latin1 / ASCII (Mac standard)
        val = buf.toString("latin1", strOffset, strOffset + length).trim();
      }

      if (val && !names[nameId]) {
        names[nameId] = val;
      }
    }

    // Name ID 1 = Font Family, Name ID 4 = Full Name, Name ID 6 = PostScript Name
    return names[1] || names[4] || names[6] || null;
  } catch {
    return null;
  }
}

/**
 * Prepara o arquivo de fonte customizado no diretório dedicado do clipe para consumo pelo FFmpeg libass.
 */
export async function prepareCustomFont(params: {
  inputPath: string;
  outDir: string;
  requestedName?: string | null;
}): Promise<{ fontPath: string; fontName: string; fontsDir: string }> {
  const { inputPath, outDir, requestedName } = params;

  await fs.promises.mkdir(outDir, { recursive: true });

  let rawBuf: Buffer = await fs.promises.readFile(inputPath);
  const isWoff = rawBuf.toString("utf8", 0, 4) === "wOFF";

  if (isWoff) {
    rawBuf = convertWoffToSfnt(rawBuf) as Buffer;
  }

  const detectedFamily = getFontFamilyName(rawBuf);
  const baseName = path.basename(inputPath, path.extname(inputPath)).replace(/[^a-zA-Z0-9_\-\s]/g, "");
  const fontName = detectedFamily || requestedName?.trim() || baseName || "CustomViralFont";

  // Salva a fonte convertida ou original na pasta dedicada com extensão .ttf ou .otf
  const ext = inputPath.toLowerCase().endsWith(".otf") ? ".otf" : ".ttf";
  const targetFontFile = path.join(outDir, `custom_font${ext}`);

  fs.writeFileSync(targetFontFile, rawBuf);

  return {
    fontPath: targetFontFile,
    fontName,
    fontsDir: outDir,
  };
}

/**
 * Mapeia e localiza uma fonte nativa do sistema em assets/fonts (ex: Poppins, Montserrat, Anton, Bebas Neue).
 */
export function resolveSystemFont(nameOrId?: string | null): { family: string; fileName: string; filePath: string } | null {
  if (!nameOrId) return null;
  const clean = nameOrId.trim().toLowerCase();

  const map: Array<{ match: (s: string) => boolean; family: string; fileName: string }> = [
    { match: (s) => s.includes("poppin"), family: "Poppins", fileName: "Poppins-Bold.ttf" },
    { match: (s) => s.includes("montserrat"), family: "Montserrat", fileName: "Montserrat-Black.ttf" },
    { match: (s) => s.includes("anton"), family: "Anton", fileName: "Anton-Regular.ttf" },
    { match: (s) => s.includes("bebas"), family: "Bebas Neue", fileName: "BebasNeue-Regular.ttf" },
    { match: (s) => s.includes("oswald"), family: "Oswald", fileName: "Oswald-Bold.ttf" },
    { match: (s) => s.includes("russo"), family: "Russo One", fileName: "RussoOne-Regular.ttf" },
    { match: (s) => s.includes("inter"), family: "Inter", fileName: "Inter-Black.ttf" },
    { match: (s) => s.includes("rubik"), family: "Rubik", fileName: "Rubik-Black.ttf" },
  ];

  const found = map.find((m) => m.match(clean));
  if (!found) return null;

  const candidateDirs = [
    path.resolve(process.cwd(), "assets", "fonts"),
    path.resolve(process.cwd(), "worker", "assets", "fonts"),
    path.resolve(__dirname, "..", "assets", "fonts"),
    path.resolve(__dirname, "assets", "fonts"),
  ];

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, found.fileName);
    if (fs.existsSync(fullPath)) {
      return {
        family: found.family,
        fileName: found.fileName,
        filePath: fullPath,
      };
    }
  }

  return null;
}
