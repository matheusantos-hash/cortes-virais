"use client";

import React from "react";
import { Camera, DownloadIcon } from "../Icons";

interface EditorThumbnailTabProps {
  thumbTitle: string;
  onThumbTitleChange: (val: string) => void;
  titleColor: "yellow" | "cyan" | "white";
  onTitleColorChange: (val: "yellow" | "cyan" | "white") => void;
  capturedThumbUrl: string | null;
  onCaptureFrame: () => void;
  onDownloadThumbnail: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function EditorThumbnailTab({
  thumbTitle,
  onThumbTitleChange,
  titleColor,
  onTitleColorChange,
  capturedThumbUrl,
  onCaptureFrame,
  onDownloadThumbnail,
  canvasRef,
}: EditorThumbnailTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div>
        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
          Gerador de Capa Viral (1080x1920)
        </h4>
        <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
          Capture o frame mais expressivo e aplique tipografia chamativa:
        </p>
      </div>

      <div>
        <label style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
          Título da Capa:
        </label>
        <input
          type="text"
          value={thumbTitle}
          onChange={(e) => onThumbTitleChange(e.target.value)}
          style={{
            background: "#171A25",
            border: "1px solid #2B3042",
            color: "#FFF",
            padding: "0.45rem",
            borderRadius: "6px",
            fontSize: "0.8rem",
            width: "100%",
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
          Cor do Destaque:
        </label>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            onClick={() => onTitleColorChange("yellow")}
            style={{
              flex: 1,
              padding: "0.35rem",
              borderRadius: "5px",
              border: titleColor === "yellow" ? "2px solid #FFF" : "1px solid transparent",
              background: "#FFE600",
              color: "#000",
              fontWeight: 800,
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            Amarelo
          </button>
          <button
            type="button"
            onClick={() => onTitleColorChange("cyan")}
            style={{
              flex: 1,
              padding: "0.35rem",
              borderRadius: "5px",
              border: titleColor === "cyan" ? "2px solid #FFF" : "1px solid transparent",
              background: "#00F0FF",
              color: "#000",
              fontWeight: 800,
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            Ciano
          </button>
          <button
            type="button"
            onClick={() => onTitleColorChange("white")}
            style={{
              flex: 1,
              padding: "0.35rem",
              borderRadius: "5px",
              border: titleColor === "white" ? "2px solid #6366F1" : "1px solid #4B5563",
              background: "#FFF",
              color: "#000",
              fontWeight: 800,
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            Branco
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <button
          type="button"
          onClick={onCaptureFrame}
          style={{
            background: "#1E2333",
            border: "1px solid #31384E",
            color: "#FFF",
            padding: "0.45rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
          }}
        >
          <Camera size={14} /> Capturar Frame Atual
        </button>

        <button
          type="button"
          onClick={onDownloadThumbnail}
          disabled={!capturedThumbUrl}
          style={{
            background: capturedThumbUrl ? "#10B981" : "#1C202B",
            border: "none",
            color: capturedThumbUrl ? "#FFF" : "#64748B",
            padding: "0.45rem",
            borderRadius: "6px",
            cursor: capturedThumbUrl ? "pointer" : "not-allowed",
            fontSize: "0.78rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
          }}
        >
          <DownloadIcon size={14} /> Baixar Capa JPG
        </button>
      </div>

      <canvas ref={canvasRef as any} style={{ display: "none" }} />
    </div>
  );
}
