"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";
import type { ExportSettings, ManualAdjustments, SavedReference, SubtitleStyle } from "@/lib/types";
import SavedReferencesModal from "./SavedReferencesModal";
import {
  Copy,
  Upload,
  Link as LucideLink,
  Save,
  Bookmark,
  Sparkles,
  Wand2,
  Subtitles,
  Volume2,
  SlidersHorizontal,
  FileVideo,
  Film,
  Check,
  RotateCcw,
  Palette,
  Settings2,
  FileCode,
  TrendingUp,
  X,
  Type,
  Trash2,
} from "./Icons";

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
const RESUMABLE_FROM_BYTES = 6 * 1024 * 1024;

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

const PRESET_REFERENCES: SavedReference[] = [
  {
    id: "preset-hormozi",
    name: "Alex Hormozi - Alta Retenção & Letras Amarelas",
    reference_type: "preset",
    reference_url: null,
    style_category: "Ganchos Rápidos",
    subtitle_style: "hormozi",
    design_instructions: "Cortes ultra-rápidos a cada 2 segundos, legendas grandes em amarelo neon com destaque por palavra, SFX de whoosh em transições e emojis de dinheiro/fogo.",
    manual_adjustments: {
      subtitles: {
        style: "hormozi",
        fontSize: "extra",
        primaryColor: "#FFFFFF",
        highlightColor: "#FACC15",
        positionY: "center-bottom",
        enableEmojis: true,
        karaokeHighlight: true,
      },
      keyMoments: {
        hookSensitivity: "extreme",
        cutPacing: "ultra_fast",
        removeSilences: true,
        smartPunchInZoom: true,
      },
      soundDesign: {
        enableSfx: true,
        backgroundMusicDucking: true,
        sfxVolume: 80,
      },
      brolls: {
        enabled: true,
        source: "higgsfield",
        frequency: "high",
      },
    },
    export_settings: {
      resolution: "1080x1920",
      codec: "h264",
      fps: 60,
      bitrate: "high",
      audioNormalization: true,
      generateNleTimeline: true,
    },
  },
  {
    id: "preset-podcast",
    name: "🎙️ Podcast & Flow Dinâmico (Preto & Amarelo)",
    reference_type: "preset",
    reference_url: null,
    style_category: "Podcast / Conversa",
    subtitle_style: "beast",
    design_instructions: "Foco nos momentos mais reveladores da conversa, corte de silêncios, alternância de enquadramento inteligente e legendas dinâmicas.",
    manual_adjustments: {
      subtitles: {
        style: "beast",
        fontSize: "large",
        primaryColor: "#FFFFFF",
        highlightColor: "#10B981",
        positionY: "bottom",
        enableEmojis: true,
        karaokeHighlight: true,
      },
      keyMoments: {
        hookSensitivity: "balanced",
        cutPacing: "dynamic",
        removeSilences: true,
        smartPunchInZoom: true,
      },
      soundDesign: {
        enableSfx: true,
        backgroundMusicDucking: true,
        sfxVolume: 60,
      },
      brolls: {
        enabled: false,
        source: "none",
        frequency: "low",
      },
    },
    export_settings: {
      resolution: "1080x1920",
      codec: "h264",
      fps: 30,
      bitrate: "standard",
      audioNormalization: true,
      generateNleTimeline: true,
    },
  },
  {
    id: "preset-apple",
    name: "🍏 Minimalista Clean & Tech (Apple Aesthetic)",
    reference_type: "preset",
    reference_url: null,
    style_category: "Educacional / Tech",
    subtitle_style: "apple",
    design_instructions: "Tipografia minimalista com cantos arredondados, ritmo fluido e elegante, foco em clareza narrativa sem poluição visual.",
    manual_adjustments: {
      subtitles: {
        style: "apple",
        fontSize: "medium",
        primaryColor: "#F8FAFC",
        highlightColor: "#38BDF8",
        positionY: "bottom",
        enableEmojis: false,
        karaokeHighlight: true,
      },
      keyMoments: {
        hookSensitivity: "balanced",
        cutPacing: "smooth",
        removeSilences: true,
        smartPunchInZoom: false,
      },
      soundDesign: {
        enableSfx: false,
        backgroundMusicDucking: true,
        sfxVolume: 40,
      },
      brolls: {
        enabled: true,
        source: "pexels",
        frequency: "medium",
      },
    },
    export_settings: {
      resolution: "1080x1920",
      codec: "prores422",
      fps: 60,
      bitrate: "master",
      audioNormalization: true,
      generateNleTimeline: true,
    },
  },
];

export default function CopyStyleStudio({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: () => void;
}) {
  const supabase = createClient();

  // 1. VÍDEO DE REFERÊNCIA
  const [refMode, setRefMode] = useState<"upload" | "link">("upload");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [saveReference, setSaveReference] = useState(true);
  const [referenceName, setReferenceName] = useState("");
  const [designInstructions, setDesignInstructions] = useState("");

  // Modal de Biblioteca de Referências
  const [savedRefs, setSavedRefs] = useState<SavedReference[]>(PRESET_REFERENCES);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);

  // 2. VÍDEO PRINCIPAL A SER EDITADO
  const [sourceMode, setSourceMode] = useState<"upload" | "link">("link");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceDragOver, setSourceDragOver] = useState(false);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // 3. AJUSTES MANUAIS NA CÓPIA DA EDIÇÃO
  // Ajuste de Legendas
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("hormozi");
  const [fontSize, setFontSize] = useState<"medium" | "large" | "extra">("extra");
  const [highlightColor, setHighlightColor] = useState("#FACC15");
  const [positionY, setPositionY] = useState<"bottom" | "center-bottom" | "center">("center-bottom");
  const [enableEmojis, setEnableEmojis] = useState(true);
  const [karaokeHighlight, setKaraokeHighlight] = useState(true);

  // Fonte Tipográfica Customizada (.ttf, .otf, .woff, .woff2)
  const [customFontFile, setCustomFontFile] = useState<File | null>(null);
  const [customFontPath, setCustomFontPath] = useState<string | null>(null);
  const [customFontName, setCustomFontName] = useState<string>("");
  const [fontPreviewUrl, setFontPreviewUrl] = useState<string | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);

  function handleFontSelect(file: File) {
    const validExts = [".ttf", ".otf", ".woff", ".woff2"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      setError("Formato de fonte não suportado. Por favor, envie um arquivo .ttf, .otf, .woff ou .woff2.");
      return;
    }
    setCustomFontFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    setCustomFontName(cleanName);

    try {
      const url = URL.createObjectURL(file);
      setFontPreviewUrl(url);
      const font = new FontFace("PreviewCustomFont", `url(${url})`);
      font.load().then((loaded) => {
        document.fonts.add(loaded);
      }).catch(() => {});
    } catch {}
  }

  // Momentos Importantes & Dinâmica
  const [hookSensitivity, setHookSensitivity] = useState<"extreme" | "balanced" | "subtle">("extreme");
  const [cutPacing, setCutPacing] = useState<"ultra_fast" | "dynamic" | "smooth">("ultra_fast");
  const [removeSilences, setRemoveSilences] = useState(true);
  const [smartPunchInZoom, setSmartPunchInZoom] = useState(true);

  // Sound Design & B-Rolls
  const [enableSfx, setEnableSfx] = useState(true);
  const [backgroundMusicDucking, setBackgroundMusicDucking] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(75);
  const [useBroll, setUseBroll] = useState(true);
  const [brollSource, setBrollSource] = useState<"auto" | "pexels" | "higgsfield" | "none">("auto");

  // 4. EXPORTAÇÃO PROFISSIONAL
  const [resolution, setResolution] = useState<"1080x1920" | "2160x3840" | "1920x1080" | "1080x1080">("1080x1920");
  const [codec, setCodec] = useState<"h264" | "hevc" | "prores422">("h264");
  const [fps, setFps] = useState<24 | 30 | 60>(60);
  const [bitrate, setBitrate] = useState<"master" | "high" | "standard">("high");
  const [audioNormalization, setAudioNormalization] = useState(true);
  const [generateNleTimeline, setGenerateNleTimeline] = useState(true);

  // Parâmetros Gerais
  const [clipCount, setClipCount] = useState(5);
  const [minSeconds, setMinSeconds] = useState(25);
  const [maxSeconds, setMaxSeconds] = useState(75);

  // Estado de envio
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carregar referências salvas do Supabase e do LocalStorage
  const loadSavedReferences = useCallback(async () => {
    try {
      // 1. LocalStorage
      const local = localStorage.getItem(`saved_references_${userId}`);
      let userList: SavedReference[] = [];
      if (local) {
        try {
          userList = JSON.parse(local);
        } catch {}
      }

      // 2. Supabase
      const { data } = await supabase
        .from("saved_references")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const combined = [...data, ...userList.filter((u) => !data.some((d) => d.id === u.id))];
        setSavedRefs([...combined, ...PRESET_REFERENCES]);
      } else if (userList.length > 0) {
        setSavedRefs([...userList, ...PRESET_REFERENCES]);
      } else {
        setSavedRefs(PRESET_REFERENCES);
      }
    } catch {
      setSavedRefs(PRESET_REFERENCES);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadSavedReferences();
  }, [loadSavedReferences]);

  // Aplicar uma referência selecionada
  function applyReference(ref: SavedReference) {
    setSelectedRefId(ref.id);
    setReferenceName(ref.name);
    if (ref.reference_type === "link" && ref.reference_url) {
      setRefMode("link");
      setRefUrl(ref.reference_url);
    }
    if (ref.design_instructions) {
      setDesignInstructions(ref.design_instructions);
    }

    // Carregar Ajustes Manuais
    if (ref.manual_adjustments?.subtitles) {
      const s = ref.manual_adjustments.subtitles;
      if (s.style) setSubtitleStyle(s.style);
      if (s.fontSize) setFontSize(s.fontSize);
      if (s.highlightColor) setHighlightColor(s.highlightColor);
      if (s.positionY) setPositionY(s.positionY);
      if (s.enableEmojis !== undefined) setEnableEmojis(s.enableEmojis);
      if (s.karaokeHighlight !== undefined) setKaraokeHighlight(s.karaokeHighlight);
    }

    const savedFontPath = ref.custom_font_path || ref.manual_adjustments?.subtitles?.customFontPath || null;
    const savedFontName = ref.custom_font_name || ref.manual_adjustments?.subtitles?.customFontName || "";
    setCustomFontPath(savedFontPath);
    setCustomFontName(savedFontName);
    setCustomFontFile(null);
    setFontPreviewUrl(null);

    if (ref.manual_adjustments?.keyMoments) {
      const k = ref.manual_adjustments.keyMoments;
      if (k.hookSensitivity) setHookSensitivity(k.hookSensitivity);
      if (k.cutPacing) setCutPacing(k.cutPacing);
      if (k.removeSilences !== undefined) setRemoveSilences(k.removeSilences);
      if (k.smartPunchInZoom !== undefined) setSmartPunchInZoom(k.smartPunchInZoom);
    }

    if (ref.manual_adjustments?.soundDesign) {
      const snd = ref.manual_adjustments.soundDesign;
      if (snd.enableSfx !== undefined) setEnableSfx(snd.enableSfx);
      if (snd.backgroundMusicDucking !== undefined) setBackgroundMusicDucking(snd.backgroundMusicDucking);
      if (snd.sfxVolume !== undefined) setSfxVolume(snd.sfxVolume);
    }

    if (ref.manual_adjustments?.brolls) {
      const b = ref.manual_adjustments.brolls;
      if (b.enabled !== undefined) setUseBroll(b.enabled);
      if (b.source) setBrollSource(b.source);
    }

    // Carregar Configurações de Exportação Pro
    if (ref.export_settings) {
      const exp = ref.export_settings;
      if (exp.resolution) setResolution(exp.resolution);
      if (exp.codec) setCodec(exp.codec);
      if (exp.fps) setFps(exp.fps);
      if (exp.bitrate) setBitrate(exp.bitrate);
      if (exp.audioNormalization !== undefined) setAudioNormalization(exp.audioNormalization);
      if (exp.generateNleTimeline !== undefined) setGenerateNleTimeline(exp.generateNleTimeline);
    }

    setSuccessMsg(`Estilo "${ref.name}" carregado com sucesso!`);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  // Excluir referência salva
  async function handleDeleteSavedRef(id: string) {
    if (!confirm("Deseja realmente remover esta referência da sua biblioteca?")) return;
    try {
      await supabase.from("saved_references").delete().eq("id", id);
    } catch {}

    const local = localStorage.getItem(`saved_references_${userId}`);
    if (local) {
      try {
        const list = JSON.parse(local).filter((r: SavedReference) => r.id !== id);
        localStorage.setItem(`saved_references_${userId}`, JSON.stringify(list));
      } catch {}
    }

    setSavedRefs((prev) => prev.filter((r) => r.id !== id));
  }

  // Submissão do Estúdio de Cópia de Edição
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validação do Vídeo de Referência
    if (refMode === "upload" && !refFile && !selectedRefId) {
      return setError("Por favor, envie o vídeo de referência ou selecione um preset da biblioteca.");
    }
    if (refMode === "link" && !refUrl.trim() && !selectedRefId) {
      return setError("Insira o link do vídeo de referência que você deseja clonar.");
    }

    // Validação do Vídeo Principal
    if (sourceMode === "upload" && !sourceFile) {
      return setError("Selecione o vídeo principal que será transformado.");
    }
    if (sourceMode === "link" && !sourceUrl.trim()) {
      return setError("Insira o link do vídeo principal (YouTube, etc.).");
    }

    setBusy(true);

    try {
      // 1. Upload do vídeo de referência (se for arquivo novo)
      let refPath: string | null = null;
      if (refMode === "upload" && refFile) {
        const path = `${userId}/ref-${crypto.randomUUID()}-${safeName(refFile.name)}`;
        const { error: refUpErr } = await supabase.storage.from("sources").upload(path, refFile, {
          contentType: refFile.type || "video/mp4",
        });
        if (refUpErr) throw new Error(`Falha no upload do vídeo de referência: ${refUpErr.message}`);
        refPath = path;
      } else if (selectedRefId) {
        const existingRef = savedRefs.find((r) => r.id === selectedRefId);
        if (existingRef?.reference_path) {
          refPath = existingRef.reference_path;
        }
      }

      // 1.1 Upload do arquivo de fonte customizada (se selecionado)
      let finalFontPath = customFontPath;
      if (customFontFile) {
        const fontKey = `${userId}/fonts/${crypto.randomUUID()}-${safeName(customFontFile.name)}`;
        const { error: fontUpErr } = await supabase.storage.from("sources").upload(fontKey, customFontFile, {
          contentType: customFontFile.type || "font/ttf",
        });
        if (fontUpErr) throw new Error(`Falha no upload da fonte tipográfica: ${fontUpErr.message}`);
        finalFontPath = fontKey;
      }
      const finalFontName = customFontName.trim() || (customFontFile?.name.replace(/\.[^/.]+$/, "") ?? null);

      // 2. Salvar na biblioteca de referências se o usuário solicitou
      const manualAdjustmentsPayload: ManualAdjustments = {
        subtitles: {
          style: subtitleStyle,
          fontSize,
          highlightColor,
          positionY,
          enableEmojis,
          karaokeHighlight,
          customFontPath: finalFontPath,
          customFontName: finalFontName,
        },
        keyMoments: {
          hookSensitivity,
          cutPacing,
          removeSilences,
          smartPunchInZoom,
        },
        soundDesign: {
          enableSfx,
          backgroundMusicDucking,
          sfxVolume,
        },
        brolls: {
          enabled: useBroll,
          source: brollSource,
        },
      };

      const exportSettingsPayload: ExportSettings = {
        resolution,
        codec,
        fps,
        bitrate,
        audioNormalization,
        generateNleTimeline,
      };

      if (saveReference) {
        const finalRefName = referenceName.trim() || `Estilo Clonado ${new Date().toLocaleDateString("pt-BR")}`;
        const newSavedRef: SavedReference = {
          id: crypto.randomUUID(),
          user_id: userId,
          name: finalRefName,
          reference_type: refMode,
          reference_url: refMode === "link" ? refUrl : null,
          reference_path: refPath,
          custom_font_path: finalFontPath,
          custom_font_name: finalFontName,
          style_category: "Personalizado",
          subtitle_style: subtitleStyle,
          design_instructions: designInstructions,
          manual_adjustments: manualAdjustmentsPayload,
          export_settings: exportSettingsPayload,
          created_at: new Date().toISOString(),
        };

        // Salva no Supabase (se a tabela estiver disponível)
        try {
          await supabase.from("saved_references").insert({
            user_id: userId,
            name: finalRefName,
            reference_type: refMode,
            reference_url: refMode === "link" ? refUrl : null,
            reference_path: refPath,
            custom_font_path: finalFontPath,
            custom_font_name: finalFontName,
            style_category: "Personalizado",
            subtitle_style: subtitleStyle,
            design_instructions: designInstructions,
            manual_adjustments: manualAdjustmentsPayload,
            export_settings: exportSettingsPayload,
          });
        } catch {}

        // Salva também no LocalStorage
        try {
          const local = localStorage.getItem(`saved_references_${userId}`);
          const list = local ? JSON.parse(local) : [];
          localStorage.setItem(`saved_references_${userId}`, JSON.stringify([newSavedRef, ...list]));
          setSavedRefs((prev) => [newSavedRef, ...prev]);
        } catch {}
      }

      // 3. Processamento do Vídeo Principal
      let sourcePayload: Record<string, any>;
      if (sourceMode === "link") {
        let parsed: URL;
        try {
          parsed = new URL(sourceUrl.trim());
        } catch {
          throw new Error("Link do vídeo principal inválido.");
        }
        sourcePayload = { source_type: "link", source_url: parsed.toString() };
      } else {
        if (!sourceFile) throw new Error("Selecione o vídeo principal.");
        const mainPath = `${userId}/${crypto.randomUUID()}-${safeName(sourceFile.name)}`;

        if (sourceFile.size > RESUMABLE_FROM_BYTES) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("Sessão expirada.");
          setUploadPct(0);
          await uploadResumable({
            accessToken: session.access_token,
            bucket: "sources",
            path: mainPath,
            file: sourceFile,
            onProgress: setUploadPct,
          });
        } else {
          const { error: upErr } = await supabase.storage.from("sources").upload(mainPath, sourceFile, {
            contentType: sourceFile.type || "video/mp4",
          });
          if (upErr) throw new Error(upErr.message);
        }
        setUploadPct(null);
        sourcePayload = { source_type: "upload", source_path: mainPath, file_name: sourceFile.name };
      }

      // 4. Criação do Job no Banco com todos os metadados de clonagem
      const jobPayload: Record<string, any> = {
        ...sourcePayload,
        orientation: resolution.includes("1920x1080") ? "horizontal" : "vertical",
        vertical_mode: "face_tracking",
        crop_x: 0.5,
        clip_count: clipCount,
        min_seconds: minSeconds,
        max_seconds: maxSeconds,
        language: "pt-BR",
        reference_type: (selectedRefId && selectedRefId.startsWith("preset-") && !refFile && !refUrl) ? "preset" : refMode,
        reference_url: (selectedRefId && selectedRefId.startsWith("preset-") && !refFile && !refUrl) ? null : (refMode === "link" ? refUrl : null),
        reference_path: refPath,
        reference_style: referenceName || "Estilo Clonado Studio",
        design_instructions: designInstructions || `Clonagem de ritmo ${cutPacing}, legendas ${subtitleStyle}, exportação ${resolution} ${codec}`,
        use_broll: useBroll,
        broll_source: brollSource,
        subtitle_style: subtitleStyle,
        enable_sfx: enableSfx,
        enable_emojis: enableEmojis,
        custom_font_path: finalFontPath,
        custom_font_name: finalFontName,
        manual_adjustments: manualAdjustmentsPayload,
        export_settings: exportSettingsPayload,
      };

      let { error: insErr } = await supabase.from("jobs").insert(jobPayload);

      // Tratamento com fallback se colunas novas não estiverem presentes no schema cache
      if (insErr && (insErr.message.includes("custom_font_path") || insErr.message.includes("custom_font_name"))) {
        delete jobPayload.custom_font_path;
        delete jobPayload.custom_font_name;
        const retry = await supabase.from("jobs").insert(jobPayload);
        insErr = retry.error;
      }

      if (insErr && (insErr.message.includes("file_name") || insErr.message.includes("source_meta"))) {
        delete jobPayload.file_name;
        delete jobPayload.source_meta;
        const retry = await supabase.from("jobs").insert(jobPayload);
        insErr = retry.error;
      }

      if (insErr && (insErr.message.includes("manual_adjustments") || insErr.message.includes("export_settings"))) {
        delete jobPayload.manual_adjustments;
        delete jobPayload.export_settings;
        const retry = await supabase.from("jobs").insert(jobPayload);
        insErr = retry.error;
      }

      if (insErr && (insErr.message.includes("subtitle_style") || insErr.message.includes("enable_sfx") || insErr.message.includes("enable_emojis"))) {
        delete jobPayload.subtitle_style;
        delete jobPayload.enable_sfx;
        delete jobPayload.enable_emojis;
        const retry = await supabase.from("jobs").insert(jobPayload);
        insErr = retry.error;
      }

      if (insErr && (insErr.message.includes("reference_type") || insErr.message.includes("reference_url") || insErr.message.includes("reference_path") || insErr.message.includes("reference_style"))) {
        delete jobPayload.reference_type;
        delete jobPayload.reference_url;
        delete jobPayload.reference_path;
        delete jobPayload.reference_style;
        const retry = await supabase.from("jobs").insert(jobPayload);
        insErr = retry.error;
      }

      if (insErr) throw new Error(insErr.message);

      setSuccessMsg("Projeto de cópia de edição iniciado com sucesso!");
      onCreated();
      setTimeout(() => {
        const el = document.getElementById("galeria-monitor") || document.getElementById("card-monitor-ativo");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 250);
    } catch (err: any) {
      console.error("Erro no Studio:", err);
      setError(err?.message || "Ocorreu um erro ao processar. Tente novamente.");
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  }

  return (
    <div className="card studio-card">
      <div className="studio-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="studio-header-icon">
            <Copy size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Clone Studio &amp; Copiar Edição</h2>
              <span className="badge badge-accent">PRO</span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Replique a estrutura de um vídeo de referência com ajustes finos e exportação profissional
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setIsLibraryOpen(true)}
          title="Ver referências salvas e presets de sucesso"
        >
          <Bookmark size={15} style={{ marginRight: "4px" }} />
          Biblioteca de Referências ({savedRefs.length})
        </button>
      </div>

      {successMsg && (
        <div className="alert-success" style={{ margin: "1rem 0" }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert-danger" style={{ margin: "1rem 0" }}>
          <X size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="stack-lg" style={{ marginTop: "1.25rem" }}>
        {/* ========================================================
            ETAPA 1: O VÍDEO DE REFERÊNCIA (O ESTILO A COPIAR)
        ======================================================== */}
        <section className="studio-section">
          <div className="studio-section-title">
            <span className="step-number">1</span>
            <div>
              <h3>Vídeo de Referência (O Estilo Desejado)</h3>
              <p className="muted small">Envie o vídeo ou cole o link do conteúdo cujo estilo você quer copiar</p>
            </div>
          </div>

          <div className="tab-group" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className={`tab-btn ${refMode === "upload" ? "active" : ""}`}
              onClick={() => setRefMode("upload")}
            >
              <Upload size={14} style={{ marginRight: "4px" }} />
              Subir Arquivo de Referência (.mp4, .mov)
            </button>
            <button
              type="button"
              className={`tab-btn ${refMode === "link" ? "active" : ""}`}
              onClick={() => setRefMode("link")}
            >
              <LucideLink size={14} style={{ marginRight: "4px" }} />
              Link do Vídeo (YouTube, TikTok, Reels)
            </button>
          </div>

          {refMode === "upload" ? (
            <div>
              <input
                ref={refFileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.mkv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setRefFile(e.target.files[0]);
                    if (!referenceName) {
                      setReferenceName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                }}
              />
              <div
                className="drop-zone"
                onClick={() => refFileInputRef.current?.click()}
                style={{ padding: "1.5rem 1rem", textAlign: "center", cursor: "pointer" }}
              >
                <Upload size={28} style={{ color: "var(--primary)", marginBottom: "0.5rem" }} />
                {refFile ? (
                  <div>
                    <strong style={{ color: "var(--primary)", display: "block" }}>
                      ✓ {refFile.name}
                    </strong>
                    <span className="muted small">Clique para trocar de arquivo</span>
                  </div>
                ) : (
                  <div>
                    <strong>Clique para subir o vídeo de referência</strong>
                    <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
                      MP4, MOV ou MKV com cortes ou legendas que você quer replicar
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <input
                type="url"
                className="input"
                placeholder="Ex: https://www.youtube.com/shorts/..."
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          )}

          {/* OPÇÃO DE SALVAR REFERÊNCIA PARA REUTILIZAR */}
          <div className="card-subtle stack" style={{ marginTop: "0.85rem", padding: "0.85rem" }}>
            <label className="checkbox-row" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={saveReference}
                onChange={(e) => setSaveReference(e.target.checked)}
              />
              <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Save size={16} style={{ color: "var(--primary)" }} />
                Deixar esta referência salva para ser reutilizada em outros projetos
              </span>
            </label>

            {saveReference && (
              <div style={{ marginTop: "0.5rem" }}>
                <label className="field-label" style={{ fontSize: "0.82rem" }}>
                  Nome da Referência (Para encontrar na sua biblioteca)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Estilo Hormozi - Amarelo Dinâmico / Vlog Retenção Máxima"
                  value={referenceName}
                  onChange={(e) => setReferenceName(e.target.value)}
                  style={{ width: "100%", marginTop: "0.2rem" }}
                />
              </div>
            )}
          </div>
        </section>

        {/* ========================================================
            ETAPA 2: O VÍDEO PRINCIPAL (O QUE SERÁ EDITADO)
        ======================================================== */}
        <section className="studio-section">
          <div className="studio-section-title">
            <span className="step-number">2</span>
            <div>
              <h3>Vídeo a ser Editado</h3>
              <p className="muted small">O vídeo bruto que receberá o ritmo, as legendas e o estilo copiado</p>
            </div>
          </div>

          <div className="tab-group" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className={`tab-btn ${sourceMode === "link" ? "active" : ""}`}
              onClick={() => setSourceMode("link")}
            >
              <LucideLink size={14} style={{ marginRight: "4px" }} />
              Link do YouTube
            </button>
            <button
              type="button"
              className={`tab-btn ${sourceMode === "upload" ? "active" : ""}`}
              onClick={() => setSourceMode("upload")}
            >
              <Upload size={14} style={{ marginRight: "4px" }} />
              Subir Arquivo de Vídeo
            </button>
          </div>

          {sourceMode === "link" ? (
            <input
              type="url"
              className="input"
              placeholder="Cole o link do YouTube (vídeo longo, podcast, aula)…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              style={{ width: "100%" }}
            />
          ) : (
            <div>
              <input
                ref={sourceFileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.mkv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSourceFile(e.target.files[0]);
                  }
                }}
              />
              <div
                className={`drop-zone ${sourceDragOver ? "dragover" : ""}`}
                onClick={() => sourceFileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSourceDragOver(true);
                }}
                onDragLeave={() => setSourceDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSourceDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setSourceFile(e.dataTransfer.files[0]);
                  }
                }}
                style={{ padding: "1.5rem 1rem", textAlign: "center", cursor: "pointer" }}
              >
                <FileVideo size={28} style={{ color: "var(--primary)", marginBottom: "0.5rem" }} />
                {sourceFile ? (
                  <div>
                    <strong style={{ color: "var(--primary)", display: "block" }}>
                      ✓ {sourceFile.name}
                    </strong>
                    <span className="muted small">Arquivo pronto para processamento</span>
                  </div>
                ) : (
                  <div>
                    <strong>Clique ou arraste seu vídeo bruto aqui</strong>
                    <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
                      Formatos suportados: MP4, MOV, MKV
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================
            ETAPA 3: AJUSTES MANUAIS NA CÓPIA DA EDIÇÃO
        ======================================================== */}
        <section className="studio-section">
          <div className="studio-section-title">
            <span className="step-number">3</span>
            <div>
              <h3>Ajustes Manuais na Cópia da Edição</h3>
              <p className="muted small">Personalize legendas, momentos importantes, ritmo de corte e efeitos</p>
            </div>
          </div>

          <div className="studio-controls-grid">
            {/* Bloco 1: Legendas */}
            <div className="control-box">
              <div className="control-box-header">
                <Subtitles size={17} style={{ color: "var(--primary)" }} />
                <strong>Ajuste de Legendas</strong>
              </div>

              <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                <div>
                  <label className="field-label">Estilo Visual</label>
                  <select
                    className="input select"
                    value={subtitleStyle}
                    onChange={(e) => setSubtitleStyle(e.target.value as SubtitleStyle)}
                  >
                    <option value="hormozi">Hormozi Pop (Impacto &amp; Contorno)</option>
                    <option value="beast">Beast Neon (Verde/Amarelo)</option>
                    <option value="apple">Apple Clean (Minimalista Elegante)</option>
                    <option value="minimal">Discreto &amp; Neutro</option>
                  </select>
                </div>

                <div className="row" style={{ gap: "0.5rem" }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Tamanho da Fonte</label>
                    <select
                      className="input select"
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value as any)}
                    >
                      <option value="medium">Médio (Discreto)</option>
                      <option value="large">Grande (Social Padrão)</option>
                      <option value="extra">Extra Grande (Retenção Alta)</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label className="field-label">Posição Vertical</label>
                    <select
                      className="input select"
                      value={positionY}
                      onChange={(e) => setPositionY(e.target.value as any)}
                    >
                      <option value="bottom">Inferior (Padrão)</option>
                      <option value="center-bottom">Centro-Baixo (Otimizado)</option>
                      <option value="center">Centro da Tela</option>
                    </select>
                  </div>
                </div>

                <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <label className="field-label" style={{ margin: 0, flex: 1 }}>
                    Cor do Destaque (Karaokê):
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[
                      { color: "#FACC15", name: "Amarelo" },
                      { color: "#10B981", name: "Verde" },
                      { color: "#38BDF8", name: "Ciano" },
                      { color: "#F43F5E", name: "Rosa" },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setHighlightColor(c.color)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: c.color,
                          border: highlightColor === c.color ? "2px solid #000" : "1px solid rgba(0,0,0,0.15)",
                          cursor: "pointer",
                          outline: highlightColor === c.color ? "2px solid var(--primary)" : "none",
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={enableEmojis}
                    onChange={(e) => setEnableEmojis(e.target.checked)}
                  />
                  <span>Inserir emojis automáticos sincados no texto</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={karaokeHighlight}
                    onChange={(e) => setKaraokeHighlight(e.target.checked)}
                  />
                  <span>Destaque palavra por palavra (Word highlight)</span>
                </label>

                {/* Upload de Fonte Tipográfica Própria (.ttf, .otf, .woff, .woff2) */}
                <div style={{ marginTop: "0.4rem", paddingTop: "0.6rem", borderTop: "1px dashed var(--card-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <label className="field-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      <Type size={14} style={{ color: "var(--primary)" }} />
                      Fonte Tipográfica Própria (.ttf, .otf, .woff)
                    </label>
                    <span className="muted" style={{ fontSize: "0.72rem" }}>Opcional</span>
                  </div>

                  <input
                    ref={fontFileInputRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/x-font-ttf,application/x-font-otf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFontSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {customFontFile || customFontPath ? (
                    <div
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--primary)",
                        borderRadius: "8px",
                        padding: "0.6rem 0.8rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem" }}>
                            ✓ {customFontName || customFontFile?.name || "Fonte Personalizada"}
                          </span>
                          {customFontFile && (
                            <span className="muted" style={{ fontSize: "0.7rem" }}>
                              ({Math.round(customFontFile.size / 1024)} KB)
                            </span>
                          )}
                        </div>
                        {/* Preview dinâmico da fonte */}
                        <p
                          style={{
                            margin: "0.25rem 0 0",
                            fontFamily: fontPreviewUrl ? "'PreviewCustomFont', sans-serif" : "inherit",
                            fontSize: "0.95rem",
                            fontWeight: 700,
                            color: "var(--text)",
                            letterSpacing: "0.5px",
                          }}
                        >
                          CORTES VIRAIS 100%
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn-icon"
                        title="Remover fonte personalizada"
                        onClick={() => {
                          setCustomFontFile(null);
                          setCustomFontPath(null);
                          setCustomFontName("");
                          setFontPreviewUrl(null);
                          if (fontFileInputRef.current) fontFileInputRef.current.value = "";
                        }}
                        style={{ padding: "5px", color: "var(--danger)", cursor: "pointer", background: "transparent", border: "none" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fontFileInputRef.current?.click()}
                      className="btn-secondary"
                      style={{
                        width: "100%",
                        fontSize: "0.82rem",
                        padding: "0.5rem 0.75rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        borderStyle: "dashed",
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={14} />
                      Subir arquivo da fonte (.ttf, .otf, .woff)
                    </button>
                  )}
                  <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                    Envie o arquivo de fonte do vídeo de referência para replicar 1:1 a tipografia original.
                  </p>
                </div>
              </div>
            </div>

            {/* Bloco 2: Momentos Importantes & Dinâmica de Corte */}
            <div className="control-box">
              <div className="control-box-header">
                <SlidersHorizontal size={17} style={{ color: "var(--primary)" }} />
                <strong>Momentos Importantes &amp; Ritmo</strong>
              </div>

              <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                <div>
                  <label className="field-label">Sensibilidade de Ganchos (Hooks)</label>
                  <select
                    className="input select"
                    value={hookSensitivity}
                    onChange={(e) => setHookSensitivity(e.target.value as any)}
                  >
                    <option value="extreme">Prioridade Máxima (Momentos de Alto Impacto)</option>
                    <option value="balanced">Equilibrada (Retenção &amp; Contexto)</option>
                    <option value="subtle">Narrativa Suave (Fluidez Contínua)</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Ritmo de Cortes na Edição</label>
                  <select
                    className="input select"
                    value={cutPacing}
                    onChange={(e) => setCutPacing(e.target.value as any)}
                  >
                    <option value="ultra_fast">Ultra Dinâmico (1 a 3 segundos)</option>
                    <option value="dynamic">Dinâmico Social (3 a 5 segundos)</option>
                    <option value="smooth">Fluido / Conversação (5 a 8s)</option>
                  </select>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={removeSilences}
                    onChange={(e) => setRemoveSilences(e.target.checked)}
                  />
                  <span>Remover silêncios e pausas longas automaticamente</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={smartPunchInZoom}
                    onChange={(e) => setSmartPunchInZoom(e.target.checked)}
                  />
                  <span>Punch-in Zoom inteligente em palavras de clímax</span>
                </label>

                <div className="row" style={{ gap: "0.5rem" }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Duração Mín. (s)</label>
                    <input
                      type="number"
                      className="input"
                      value={minSeconds}
                      min={10}
                      max={180}
                      onChange={(e) => setMinSeconds(Number(e.target.value))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Duração Máx. (s)</label>
                    <input
                      type="number"
                      className="input"
                      value={maxSeconds}
                      min={20}
                      max={300}
                      onChange={(e) => setMaxSeconds(Number(e.target.value))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Cortes</label>
                    <input
                      type="number"
                      className="input"
                      value={clipCount}
                      min={1}
                      max={20}
                      onChange={(e) => setClipCount(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 3: Sound Design & B-Rolls */}
            <div className="control-box" style={{ gridColumn: "1 / -1" }}>
              <div className="control-box-header">
                <Volume2 size={17} style={{ color: "var(--primary)" }} />
                <strong>Sound Design &amp; B-Rolls Inteligentes</strong>
              </div>

              <div className="row" style={{ gap: "1.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={enableSfx}
                    onChange={(e) => setEnableSfx(e.target.checked)}
                  />
                  <span>SFX de impacto nas transições (Whoosh, Ding, Pop)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={backgroundMusicDucking}
                    onChange={(e) => setBackgroundMusicDucking(e.target.checked)}
                  />
                  <span>Auto-Ducking de áudio (reduz trilha durante a fala)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={useBroll}
                    onChange={(e) => setUseBroll(e.target.checked)}
                  />
                  <span>Sobrepor B-Rolls contextuais com IA</span>
                </label>

                {useBroll && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="muted small">Fonte B-Roll:</span>
                    <select
                      className="input select"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                      value={brollSource}
                      onChange={(e) => setBrollSource(e.target.value as any)}
                    >
                      <option value="auto">⚡ Automático (IA Decide - Recomendado)</option>
                      <option value="higgsfield">Higgsfield AI (Apenas Gerados por IA)</option>
                      <option value="pexels">Pexels / Pixabay (Apenas Vídeos Reais)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            ETAPA 4: EXPORTAÇÃO PROFISSIONAL (STUDIO PRO)
        ======================================================== */}
        <section className="studio-section">
          <div className="studio-section-title">
            <span className="step-number">4</span>
            <div>
              <h3>Opções de Exportação Profissional</h3>
              <p className="muted small">Configurações de renderização, codecs e exportação para NLEs (Premiere / DaVinci)</p>
            </div>
          </div>

          <div className="card-subtle stack" style={{ padding: "1.2rem" }}>
            <div className="export-grid">
              <div>
                <label className="field-label">Resolução de Saída</label>
                <select
                  className="input select"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                >
                  <option value="1080x1920">📱 1080x1920 (Vertical 9:16 - TikTok / Reels / Shorts)</option>
                  <option value="2160x3840">✨ 2160x3840 (4K Vertical Ultra HD)</option>
                  <option value="1920x1080">🖥️ 1920x1080 (Horizontal 16:9 - YouTube Padrão)</option>
                  <option value="1080x1080">⬛ 1080x1080 (Quadrado 1:1 - Feed Instagram)</option>
                </select>
              </div>

              <div>
                <label className="field-label">Codec de Vídeo</label>
                <select
                  className="input select"
                  value={codec}
                  onChange={(e) => setCodec(e.target.value as any)}
                >
                  <option value="h264">H.264 / AVC (Máxima compatibilidade)</option>
                  <option value="hevc">H.265 / HEVC (Maior nitidez e menor tamanho)</option>
                  <option value="prores422">Apple ProRes 422 (Master sem perdas)</option>
                </select>
              </div>

              <div>
                <label className="field-label">Taxa de Quadros (FPS)</label>
                <select
                  className="input select"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) as any)}
                >
                  <option value={60}>60 FPS (Ultra Suave)</option>
                  <option value={30}>30 FPS (Padrão Redes Sociais)</option>
                  <option value={24}>24 FPS (Cinemático)</option>
                </select>
              </div>

              <div>
                <label className="field-label">Bitrate de Renderização</label>
                <select
                  className="input select"
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value as any)}
                >
                  <option value="master">Master Studio (25 Mbps)</option>
                  <option value="high">Alta Qualidade (12 Mbps)</option>
                  <option value="standard">Web Otimizado (6 Mbps)</option>
                </select>
              </div>
            </div>

            <div className="row" style={{ marginTop: "0.85rem", gap: "1.5rem", flexWrap: "wrap" }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={audioNormalization}
                  onChange={(e) => setAudioNormalization(e.target.checked)}
                />
                <span title="Ajusta o volume do áudio para o padrão exigido pelo TikTok, Reels e Shorts">
                  🔊 Normalização de Áudio EBU R128 (-14 LUFS para Redes Sociais)
                </span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={generateNleTimeline}
                  onChange={(e) => setGenerateNleTimeline(e.target.checked)}
                />
                <span title="Gera arquivos XML e EDL para abrir a timeline no Premiere Pro ou DaVinci Resolve">
                  <FileCode size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                  Gerar Pacote NLE (XML Premiere + EDL DaVinci + SRT)
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* PROGRESSO DE UPLOAD SE HOUVER */}
        {uploadPct !== null && (
          <div className="stack" style={{ gap: "0.35rem" }}>
            <div className="row">
              <small className="muted">Enviando vídeo para o servidor…</small>
              <small><strong>{uploadPct}%</strong></small>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}

        {/* BOTÃO PRINCIPAL DE AÇÃO */}
        <div style={{ marginTop: "1rem" }}>
          <button
            type="submit"
            className="btn btn-cta"
            disabled={busy}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.05rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <Sparkles size={20} />
            <span>{busy ? "Iniciando Processamento Pro…" : "Clonar Edição & Renderizar Clipes"}</span>
          </button>
        </div>
      </form>

      {/* MODAL DE REFERÊNCIAS SALVAS */}
      <SavedReferencesModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        references={savedRefs}
        onSelect={applyReference}
        onDelete={handleDeleteSavedRef}
      />
    </div>
  );
}
