"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "./Icons";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Sincroniza o estado inicial com o atributo data-theme do elemento raiz
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
    } else {
      const stored = localStorage.getItem("cortes_theme") as "light" | "dark" | null;
      if (stored) {
        setTheme(stored);
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "dark"; // Default estúdio dark CapCut
        setTheme(initial);
        document.documentElement.setAttribute("data-theme", initial);
      }
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("cortes_theme", nextTheme);
    } catch {}
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="btn-theme-toggle"
        aria-label="Alternar tema"
        style={{
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--card-border)",
          borderRadius: 8,
          opacity: 0,
        }}
      >
        <span style={{ width: 16, height: 16 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-theme-toggle"
      title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro (CapCut Studio)"}
      aria-label={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 8,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        color: theme === "dark" ? "#FACC15" : "#6366F1",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}
