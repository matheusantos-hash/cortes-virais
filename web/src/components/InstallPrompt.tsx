"use client";

import React, { useEffect, useState } from "react";
import { DownloadIcon, SmartphoneIcon, XIcon, Check } from "@/components/Icons";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true); // inicia escondido até checar
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando como app standalone (PWA instalado)
    const isAppStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isAppStandalone);
    if (isAppStandalone) {
      return;
    }

    // Verifica se foi dispensado recentemente nos últimos 5 dias
    const dismissedUntil = localStorage.getItem("cortes_pwa_dismissed_until");
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      setDismissed(true);
      return;
    }

    // Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Se for iOS e não standalone, exibe opção
    if (isAppleDevice) {
      setDismissed(false);
    }

    // Captura evento beforeinstallprompt padrão (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setDismissed(true);
      localStorage.removeItem("cortes_pwa_dismissed_until");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Guarda 5 dias para não incomodar o usuário
    const fiveDaysFromNow = Date.now() + 5 * 24 * 60 * 60 * 1000;
    localStorage.setItem("cortes_pwa_dismissed_until", String(fiveDaysFromNow));
  };

  if (isStandalone || dismissed || installed || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <aside
      aria-label="Instalação do Aplicativo"
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        maxWidth: "420px",
        width: "calc(100vw - 2.5rem)",
        background: "var(--card, #141720)",
        color: "var(--text, #f8fafc)",
        borderRadius: "16px",
        padding: "1rem 1.15rem",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        boxShadow:
          "0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.25)",
        backdropFilter: "blur(12px)",
        animation: "fadeInSlideUp 0.3s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #6366f1, #f43f5e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
          }}
        >
          <SmartphoneIcon size={22} style={{ color: "#ffffff" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.2rem",
            }}
          >
            <h2
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--text, #f8fafc)",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Instalar o Cortes AI
            </h2>
            <button
              onClick={handleDismiss}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                padding: "0.2rem",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Dispensar"
              aria-label="Dispensar aviso de instalação"
            >
              <XIcon size={16} />
            </button>
          </div>

          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted, #94a3b8)",
              lineHeight: 1.45,
              margin: "0 0 0.85rem 0",
            }}
          >
            {isIOS && showIOSGuide
              ? "No Safari: toque no botão Compartilhar (ícone com seta para cima) e selecione 'Adicionar à Tela de Início'."
              : "Instale no seu dispositivo para acesso rápido em tela cheia, melhor performance e modo offline."}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {(!isIOS || !showIOSGuide) && (
              <button
                onClick={handleInstallClick}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.4)",
                }}
              >
                <DownloadIcon size={14} />
                {isIOS ? "Como instalar no iPhone" : "Instalar App"}
              </button>
            )}

            {isIOS && showIOSGuide && (
              <button
                onClick={handleDismiss}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Check size={14} /> Entendi
              </button>
            )}

            <button
              onClick={handleDismiss}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "8px",
                background: "transparent",
                color: "var(--text-muted, #94a3b8)",
                fontSize: "0.82rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
