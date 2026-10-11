"use client";

import React from "react";

interface EditorCropTabProps {
  cropX: number;
  onCropXChange: (val: number) => void;
}

export default function EditorCropTab({ cropX, onCropXChange }: EditorCropTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div>
        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
          Enquadramento &amp; Ângulo (Crop X)
        </h4>
        <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
          Ajuste a posição horizontal do enquadramento no vídeo original:
        </p>
      </div>

      <div style={{ background: "#171A25", padding: "0.85rem", borderRadius: "8px", border: "1px solid #262B3B" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#94A3B8" }}>Posição Horizontal:</span>
          <strong style={{ color: "#00F0FF", fontSize: "0.85rem", fontFamily: "monospace" }}>
            {cropX === 0.5 ? "Centro (0.5)" : cropX < 0.5 ? `Esquerda (${cropX.toFixed(2)})` : `Direita (${cropX.toFixed(2)})`}
          </strong>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={cropX}
          onChange={(e) => onCropXChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "#00F0FF", cursor: "pointer" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={() => onCropXChange(0.2)}
            style={{
              padding: "0.4rem",
              borderRadius: "5px",
              border: cropX === 0.2 ? "1px solid #00F0FF" : "1px solid #2B3042",
              background: cropX === 0.2 ? "rgba(0,240,255,0.15)" : "#13161F",
              color: cropX === 0.2 ? "#00F0FF" : "#94A3B8",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Esquerda
          </button>
          <button
            type="button"
            onClick={() => onCropXChange(0.5)}
            style={{
              padding: "0.4rem",
              borderRadius: "5px",
              border: cropX === 0.5 ? "1px solid #00F0FF" : "1px solid #2B3042",
              background: cropX === 0.5 ? "rgba(0,240,255,0.15)" : "#13161F",
              color: cropX === 0.5 ? "#00F0FF" : "#94A3B8",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Centro
          </button>
          <button
            type="button"
            onClick={() => onCropXChange(0.8)}
            style={{
              padding: "0.4rem",
              borderRadius: "5px",
              border: cropX === 0.8 ? "1px solid #00F0FF" : "1px solid #2B3042",
              background: cropX === 0.8 ? "rgba(0,240,255,0.15)" : "#13161F",
              color: cropX === 0.8 ? "#00F0FF" : "#94A3B8",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Direita
          </button>
        </div>
      </div>
    </div>
  );
}
