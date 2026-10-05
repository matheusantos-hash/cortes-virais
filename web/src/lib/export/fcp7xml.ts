import type { TimelineProject, Sequence, TrackItem, MediaAsset } from "./timeline";
import { framesToTimecode, isDropFrame, type FpsFraction } from "./timecode";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function timebaseRateXml(fps: FpsFraction): string {
  const timebase = Math.round(fps.num / fps.den);
  const ntsc = isDropFrame(fps) ? "TRUE" : "FALSE";
  return `        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>${ntsc}</ntsc>
        </rate>`;
}

function renderBasicMotion(scale: number, centerX: number, centerY: number, keyframes?: { frame: number; centerX: number; centerY: number }[]): string {
  let centerKeyframesXml = "";
  if (keyframes && keyframes.length > 0) {
    centerKeyframesXml = `
            <keyframe>
              <when>0</when>
              <value>
                <horiz>${centerX.toFixed(2)}</horiz>
                <vert>${centerY.toFixed(2)}</vert>
              </value>
            </keyframe>` +
      keyframes
        .map(
          (kf) => `
            <keyframe>
              <when>${kf.frame}</when>
              <value>
                <horiz>${kf.centerX.toFixed(2)}</horiz>
                <vert>${kf.centerY.toFixed(2)}</vert>
              </value>
            </keyframe>`
        )
        .join("");
  }

  return `
          <filter>
            <effect>
              <name>Basic Motion</name>
              <effectid>basic</effectid>
              <effecttype>motion</effecttype>
              <mediatype>video</mediatype>
              <parameter>
                <parameterid>scale</parameterid>
                <name>Scale</name>
                <value>${scale.toFixed(1)}</value>
              </parameter>
              <parameter>
                <parameterid>center</parameterid>
                <name>Center</name>
                <value>
                  <horiz>${centerX.toFixed(2)}</horiz>
                  <vert>${centerY.toFixed(2)}</vert>
                </value>${centerKeyframesXml}
              </parameter>
            </effect>
          </filter>`;
}

function renderClipItem(
  item: TrackItem,
  asset: MediaAsset,
  fps: FpsFraction,
  trackType: "video" | "audio"
): string {
  const motionXml =
    trackType === "video" && (item.scale !== undefined || item.centerX !== undefined)
      ? renderBasicMotion(item.scale ?? 100, item.centerX ?? 0, item.centerY ?? 0, item.keyframes)
      : "";

  return `          <clipitem id="${item.id}">
            <name>${escapeXml(item.name)}</name>
            <duration>${item.endFrame - item.startFrame}</duration>
${timebaseRateXml(fps)}
            <start>${item.startFrame}</start>
            <end>${item.endFrame}</end>
            <in>${item.inFrame}</in>
            <out>${item.outFrame}</out>
            <file id="${asset.id}">
              <name>${escapeXml(asset.name)}</name>
              <pathurl>${escapeXml(asset.pathUrl || asset.name)}</pathurl>
${timebaseRateXml(fps)}
              <duration>${asset.durationFrames}</duration>
              <media>
                <${trackType}>
                  <samplecharacteristics>
                    <width>${asset.width || 1920}</width>
                    <height>${asset.height || 1080}</height>
                  </samplecharacteristics>
                </${trackType}>
              </media>
            </file>${motionXml}
          </clipitem>`;
}

export function generateFcp7Xml(project: TimelineProject): string {
  const primarySeq = project.sequences[0];
  const fps = primarySeq ? primarySeq.fps : { num: 30, den: 1 };
  const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]));

  const sequencesXml = project.sequences
    .map((seq) => {
      const v1ClipItems = seq.v1Tracks
        .map((item) => renderClipItem(item, assetMap.get(item.mediaAssetId)!, seq.fps, "video"))
        .join("\n");

      const v2ClipItems = seq.v2Tracks
        .map((item) => renderClipItem(item, assetMap.get(item.mediaAssetId)!, seq.fps, "video"))
        .join("\n");

      const a1ClipItems = seq.a1Tracks
        .map((item) => renderClipItem(item, assetMap.get(item.mediaAssetId)!, seq.fps, "audio"))
        .join("\n");

      const a2ClipItems = seq.a2Tracks
        .map((item) => renderClipItem(item, assetMap.get(item.mediaAssetId)!, seq.fps, "audio"))
        .join("\n");

      const markersXml = seq.markers
        .map(
          (m) => `      <marker>
        <comment>${escapeXml(m.comment)}</comment>
        <name>${escapeXml(m.name)}</name>
        <in>${m.frame}</in>
        <out>${m.frame + 1}</out>
      </marker>`
        )
        .join("\n");

      return `    <sequence id="${seq.id}">
      <name>${escapeXml(seq.name)}</name>
      <duration>${seq.durationFrames}</duration>
${timebaseRateXml(seq.fps)}
      <timecode>
${timebaseRateXml(seq.fps)}
        <string>${seq.startTimecode}</string>
        <frame>0</frame>
      </timecode>
      <media>
        <video>
          <format>
            <samplecharacteristics>
              <width>${seq.width}</width>
              <height>${seq.height}</height>
              <pixelaspectratio>square</pixelaspectratio>
${timebaseRateXml(seq.fps)}
            </samplecharacteristics>
          </format>
          <track>
            <enabled>TRUE</enabled>
            <locked>FALSE</locked>
${v1ClipItems}
          </track>
${
  seq.v2Tracks.length > 0
    ? `          <track>
            <enabled>TRUE</enabled>
            <locked>FALSE</locked>
${v2ClipItems}
          </track>`
    : ""
}
        </video>
        <audio>
          <track>
            <enabled>TRUE</enabled>
            <locked>FALSE</locked>
${a1ClipItems}
          </track>
${
  seq.a2Tracks.length > 0
    ? `          <track>
            <enabled>TRUE</enabled>
            <locked>FALSE</locked>
${a2ClipItems}
          </track>`
    : ""
}
        </audio>
      </media>
${markersXml}
    </sequence>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <project>
    <name>${escapeXml(project.projectName)}</name>
    <children>
${sequencesXml}
    </children>
  </project>
</xmeml>
`;
}
