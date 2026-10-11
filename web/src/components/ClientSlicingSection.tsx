"use client";

import { useEffect, useRef, useState } from "react";
import { fmtClock } from "@/lib/format";
import { getLocalVideoFile, findLocalVideoFile, storeLocalVideoFile } from "@/lib/clientFileStore";
import { sliceVideoLocally, type CutSegment, type CutProgress } from "@/lib/clientCutter";
import { finalizeClientSlicedClipsAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  FilmIcon,
  Check,
  UploadIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  TrendingUpIcon,
} from "./Icons";

interface Candidate {
  id: string;
  position: number;
  title: string;
  hook?: string;
  score?: number;
  reason?: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
}

interface ClientSlicingSectionProps {
  jobId: string;
  userId: string;
  fileName?: string | null;
  candidates: Candidate[];
  onCompleted: () => void;
}

export default function ClientSlicingSection({
  jobId,
  userId,
  fileName,
  candidates,
  onCompleted,
}: ClientSlicingSectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id || `cand_${c.position}`))
  );
  const [localFile, setLocalFile] = useState<File | null>(() => {
    return getLocalVideoFile(jobId) || (fileName ? findLocalVideoFile(fileName) : undefined) || null;
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState<CutProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<"idle" | "slicing" | "uploading" | "done">("idle");
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Se o arquivo ainda não estiver no estado, tenta buscar do cache novamente
  useEffect(() => {
    if (!localFile) {
      const found = getLocalVideoFile(jobId) || (fileName ? findLocalVideoFile(fileName) : undefined);
      if (found) setLocalFile(found);
    }
  }, [jobId, fileName, localFile]);

  const toggleSelect = (id: string) => {
    if (isProcessing) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeCandidates = candidates.filter((c) => selectedIds.has(c.id || `cand_${c.position}`));

  async function handleStartSlicing() {
    if (!localFile) {
      fileInputRef.current?.click();
      return;
    }
    if (activeCandidates.length === 0) {
      setErrorMessage("Selecione pelo menos um clipe para fatiar.");
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setCurrentStep("slicing");

    try {
      const segments: CutSegment[] = activeCandidates.map((c, idx) => ({
        id: c.id || `cand_${idx + 1}`,
        position: idx + 1,
        startSeconds: c.start_seconds,
        endSeconds: c.end_seconds,
        title: c.title,
      }));

      // 1. Fatiamento instantâneo via FFmpeg WASM stream copy
      const slicedClips = await sliceVideoLocally(localFile, segments, (p) => {
        setProgressInfo(p);
      });

      // 2. Upload leve apenas dos clipes fatiados
      setCurrentStep("uploading");
      const supabase = createClient();
      const finalManifest = [];

      for (let i = 0; i < slicedClips.length; i++) {
        const item = slicedClips[i];
        const origCandidate = activeCandidates[i];
        const clipStoragePath = `${userId}/${jobId}/clip-${String(item.position).padStart(2, "0")}.mp4`;

        setUploadPercent(Math.round(((i) / slicedClips.length) * 100));

        const { error: upErr } = await supabase.storage
          .from("clips")
          .upload(clipStoragePath, item.blob, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (upErr) {
          throw new Error(`Falha no upload do clipe ${item.position}: ${upErr.message}`);
        }

        finalManifest.push({
          position: item.position,
          title: origCandidate.title || `Corte #${item.position}`,
          hook: origCandidate.hook || "",
          reason: origCandidate.reason || "",
          score: origCandidate.score || 80,
          start_seconds: origCandidate.start_seconds,
          end_seconds: origCandidate.end_seconds,
          file_path: clipStoragePath,
        });
      }

      setUploadPercent(100);

      // 3. Finaliza no banco de dados via Server Action
      const finalRes = await finalizeClientSlicedClipsAction(jobId, finalManifest);
      if (!finalRes.success) {
        throw new Error(finalRes.error || "Falha ao registrar os clipes no banco de dados.");
      }

      setCurrentStep("done");
      setTimeout(() => {
        onCompleted();
      }, 1200);
    } catch (err: any) {
      console.error("Erro no fatiamento/upload local:", err);
      setErrorMessage(err?.message || "Ocorreu um erro durante o corte local.");
      setIsProcessing(false);
      setCurrentStep("idle");
    }
  }

  return (
    <div
      className="card stack"
      style={{
        border: "1px solid rgba(139, 92, 246, 0.4)",
        background: "rgba(139, 92, 246, 0.04)",
        borderRadius: "12px",
        padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                background: "rgba(139, 92, 246, 0.2)",
                color: "#a78bfa",
                padding: "0.3rem",
                borderRadius: "8px",
                display: "inline-flex",
              }}
            >
              <Zap size={18} />
            </span>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Momentos Virais Prontos para Fatiamento</h3>
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            A IA analisou a transcrição e identificou {candidates.length} melhores momentos. Fatie agora diretamente no seu navegador em segundos (sem esperar horas de upload).
          </p>
        </div>

        {localFile ? (
          <div
            style={{
              fontSize: "0.78rem",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "0.35rem 0.65rem",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <Check size={13} /> Arquivo local pronto ({localFile.name})
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <UploadIcon size={14} /> Selecionar arquivo original
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.mov,.mkv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setLocalFile(f);
              storeLocalVideoFile(jobId, f);
              if (fileName) storeLocalVideoFile(fileName, f);
            }
          }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "0.6rem 0.85rem",
            borderRadius: "6px",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <AlertCircleIcon size={14} /> {errorMessage}
        </div>
      )}

      {/* Lista de cards dos candidatos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem", marginTop: "0.5rem" }}>
        {candidates.map((cand, idx) => {
          const candId = cand.id || `cand_${cand.position || idx + 1}`;
          const isSelected = selectedIds.has(candId);
          return (
            <div
              key={candId}
              onClick={() => toggleSelect(candId)}
              style={{
                cursor: isProcessing ? "default" : "pointer",
                padding: "0.85rem",
                borderRadius: "8px",
                border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--card-border)",
                background: isSelected ? "rgba(139, 92, 246, 0.08)" : "var(--bg-subtle)",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)" }}>
                  Corte #{cand.position || idx + 1}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {cand.score && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                        background: cand.score >= 80 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: cand.score >= 80 ? "#10b981" : "#f59e0b",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.2rem",
                      }}
                    >
                      <TrendingUpIcon size={11} /> {cand.score} pts
                    </span>
                  )}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isProcessing}
                    onChange={() => {}}
                    style={{ cursor: "pointer", accentColor: "var(--primary)" }}
                  />
                </div>
              </div>

              <strong style={{ fontSize: "0.88rem", lineHeight: 1.3 }}>{cand.title}</strong>
              {cand.hook && (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  &ldquo;{cand.hook}&rdquo;
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "auto" }}>
                <ClockIcon size={12} />
                <span>
                  {fmtClock(cand.start_seconds)} – {fmtClock(cand.end_seconds)} ({Math.round(cand.duration_seconds)}s)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Progresso durante processamento */}
      {isProcessing && (
        <div style={{ marginTop: "1rem", padding: "0.85rem", background: "var(--bg-subtle)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.4rem" }}>
            <span style={{ fontWeight: 600 }}>
              {currentStep === "slicing"
                ? progressInfo?.statusMessage || "Fatiando clipes localmente..."
                : currentStep === "uploading"
                ? `Enviando clipes leves (${uploadPercent}%)...`
                : "Concluído!"}
            </span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>
              {currentStep === "slicing" ? `${progressInfo?.percent || 0}%` : `${uploadPercent}%`}
            </span>
          </div>
          <div style={{ width: "100%", height: "6px", background: "var(--card-border)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${currentStep === "slicing" ? progressInfo?.percent || 0 : uploadPercent}%`,
                height: "100%",
                background: "var(--primary)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Botão de Ação */}
      {!isProcessing && (
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartSlicing}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.25rem" }}
          >
            <Zap size={15} />
            <span>
              {localFile
                ? `Fatiar ${activeCandidates.length} Corte${activeCandidates.length > 1 ? "s" : ""} no Computador`
                : "Selecionar Arquivo e Fatiar"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
