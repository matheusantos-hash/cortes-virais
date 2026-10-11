"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ScissorsIcon, RefreshCw, ZapIcon } from "@/components/Icons";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = "/";
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "75vh",
        padding: "2rem 1rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(244, 63, 94, 0.2))",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          boxShadow: "0 8px 32px rgba(99, 102, 241, 0.15)",
        }}
      >
        <ScissorsIcon size={38} style={{ color: "#818cf8" }} />
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.35rem 0.85rem",
          borderRadius: 9999,
          background: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
          border: `1px solid ${isOnline ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
          color: isOnline ? "#34d399" : "#fb7185",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: isOnline ? "#10b981" : "#f43f5e",
            boxShadow: isOnline
              ? "0 0 8px #10b981"
              : "0 0 8px #f43f5e",
          }}
        />
        {isOnline ? "Conexão restaurada!" : "Você está offline"}
      </div>

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: "0.75rem",
          color: "var(--text, #f8fafc)",
        }}
      >
        {isOnline ? "Pronto para reconectar" : "Sem conexão com a internet"}
      </h1>

      <p
        style={{
          maxWidth: 460,
          color: "var(--text-muted, #94a3b8)",
          fontSize: "0.95rem",
          lineHeight: 1.6,
          marginBottom: "2rem",
        }}
      >
        {isOnline
          ? "Sua internet voltou! Clique no botão abaixo para retornar ao Cortes AI e continuar seu fluxo de trabalho."
          : "O aplicativo Cortes AI está pronto no seu dispositivo. Verifique sua conexão Wi-Fi ou dados móveis para processar novos vídeos e sincronizar cortes."}
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={handleRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
            transition: "all 0.2s ease",
          }}
        >
          <RefreshCw size={16} />
          {isOnline ? "Voltar ao Início" : "Tentar Novamente"}
        </button>

        <Link
          href="/projetos"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            borderRadius: "10px",
            background: "var(--card, #141720)",
            color: "var(--text, #f8fafc)",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "1px solid var(--border, #27272a)",
            textDecoration: "none",
          }}
        >
          <ZapIcon size={16} />
          Ver Meus Projetos
        </Link>
      </div>
    </div>
  );
}
