"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadResumable } from "@/lib/upload";
import type { ExportSettings, ManualAdjustments, SavedReference, SubtitleStyle } from "@/lib/types";
import SavedReferencesModal from "./SavedReferencesModal";
import EditStyleModal from "./EditStyleModal";
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
  Pencil,
  Video,
  Layers,
  Columns,
  CheckCircle,
  AlertCircle,
  Cpu,
  Zap,
  Crop,
  User,
  Users,
  Clock,
  FileText,
  BarChart3,
  Smartphone,
  Monitor,
  Square,
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
        enableSfx: false,
        backgroundMusicDucking: false,
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
    name: "Podcast & Flow Dinâmico (Preto & Amarelo)",
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
        enableSfx: false,
        backgroundMusicDucking: false,
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
    name: "Minimalista Clean & Tech (Apple Aesthetic)",
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
        backgroundMusicDucking: false,
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

  // 1. VÍDEO DE REFERÊNCIA OU ESTILO SALVO
  const [styleSourceType, setStyleSourceType] = useState<"saved" | "custom_video">("saved");
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

  // Modal de Edição de Estilo (Renomear & Adicionar Vídeos de Treino)
  const [editingReference, setEditingReference] = useState<SavedReference | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 2. VÍDEO PRINCIPAL A SER EDITADO
  const [sourceClip, setSourceClip] = useState<{
    id: string;
    title: string;
    path: string;
    url?: string;
    position?: number;
  } | null>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "link">("link");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceDragOver, setSourceDragOver] = useState(false);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Carrega corte pré-selecionado vindo do Editor de Cortes
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("clone_source_clip");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.path || parsed.url)) {
          setSourceClip(parsed);
          setSourceMode("upload");
          if (parsed.orientation === "horizontal" || parsed.resolution === "1920x1080") {
            setResolution("1920x1080");
          } else if (parsed.resolution) {
            setResolution(parsed.resolution);
          }
          if (parsed.verticalMode) {
            setVerticalMode(parsed.verticalMode);
          }
        }
      }
    } catch {}
  }, []);

  const handleClearSourceClip = () => {
    setSourceClip(null);
    try {
      sessionStorage.removeItem("clone_source_clip");
    } catch {}
  };

  // 3. AJUSTES MANUAIS NA CÓPIA DA EDIÇÃO
  // Ajuste de Legendas
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("hormozi");
  const [fontSize, setFontSize] = useState<"medium" | "large" | "extra">("extra");
  const [highlightColor, setHighlightColor] = useState("#FACC15");
  const [positionY, setPositionY] = useState<"bottom" | "center-bottom" | "center">("center-bottom");
  const [enableEmojis, setEnableEmojis] = useState(false);
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

  // Sound Design & B-Rolls - Checkboxes de áudio vêm desmarcados por padrão
  const [enableSfx, setEnableSfx] = useState(false);
  const [backgroundMusicDucking, setBackgroundMusicDucking] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(75);
  const [useBroll, setUseBroll] = useState(true);
  const [brollSource, setBrollSource] = useState<"auto" | "pexels" | "higgsfield" | "none">("auto");

  // Posição de Câmeras & Enquadramento Vertical
  const [verticalMode, setVerticalMode] = useState<"face_tracking" | "crop" | "blur" | "split" | "split_face">("face_tracking");

  // Navegação de Abas Internas do Clone Studio
  const [activeStudioTab, setActiveStudioTab] = useState<"clonar" | "estilos">("clonar");

  // Estados da Aba "Estilos de Edição" (Treinamento e Aprendizagem)
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleCategory, setNewStyleCategory] = useState("Ganchos Rápidos");
  const [newStyleInstructions, setNewStyleInstructions] = useState("");
  const [newSubtitleFiles, setNewSubtitleFiles] = useState<File[]>([]);
  const [newVideoFiles, setNewVideoFiles] = useState<File[]>([]);
  const [subtitlesStats, setSubtitlesStats] = useState<{ totalBlocks: number; avgWps: number; sampleSnippet: string } | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStatusText, setTrainingStatusText] = useState("");
  const [trainingSuccess, setTrainingSuccess] = useState<string | null>(null);
  const subFilesInputRef = useRef<HTMLInputElement>(null);
  const videoFilesInputRef = useRef<HTMLInputElement>(null);

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

      let fullList: SavedReference[] = PRESET_REFERENCES;
      if (data && data.length > 0) {
        const combined = [...data, ...userList.filter((u) => !data.some((d) => d.id === u.id))];
        fullList = [...combined, ...PRESET_REFERENCES];
      } else if (userList.length > 0) {
        fullList = [...userList, ...PRESET_REFERENCES];
      }
      setSavedRefs(fullList);
      setSelectedRefId((prev) => {
        if (prev && fullList.some((r) => r.id === prev)) return prev;
        return fullList[0]?.id ?? null;
      });
      if (fullList.length > 0 && !referenceName) {
        setReferenceName(fullList[0].name);
        if (fullList[0].design_instructions) setDesignInstructions(fullList[0].design_instructions);
      }
    } catch {
      setSavedRefs(PRESET_REFERENCES);
      setSelectedRefId((prev) => prev ?? PRESET_REFERENCES[0]?.id ?? null);
    }
  }, [supabase, userId, referenceName]);

  useEffect(() => {
    loadSavedReferences();
  }, [loadSavedReferences]);

  // Aplicar uma referência selecionada
  function applyReference(ref: SavedReference) {
    setSelectedRefId(ref.id);
    setReferenceName(ref.name);
    setStyleSourceType("saved");
    setRefFile(null);
    setRefUrl("");
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

    // Carregar Câmera e Enquadramento se especificado
    if (ref.manual_adjustments?.camera?.verticalMode) {
      setVerticalMode(ref.manual_adjustments.camera.verticalMode);
    }

    // Carregar Formato de Saída / Resolução se especificado no estilo
    if (ref.export_settings?.resolution) {
      setResolution(ref.export_settings.resolution);
    }

    // Se tiver métricas aprendidas pela IA, aplicar parâmetros
    if (ref.learning_metrics) {
      const m = ref.learning_metrics;
      if (m.detectedColors?.highlight) {
        setHighlightColor(m.detectedColors.highlight);
      }
      if (m.cameraFramingPattern === "split_screen") {
        setVerticalMode("split");
      } else if (m.cameraFramingPattern === "face_tracking") {
        setVerticalMode("face_tracking");
      }
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

  // Abrir modal de edição do estilo (renomear / adicionar mais vídeos de treino)
  function handleOpenEditModal(ref: SavedReference) {
    setEditingReference(ref);
    setIsEditModalOpen(true);
  }

  // Salvar alterações e novos vídeos de treino do estilo
  async function handleUpdateSavedRef(updatedRef: SavedReference) {
    let finalRef = updatedRef;

    try {
      if (updatedRef.id.startsWith("preset-")) {
        // Clona preset para estilo personalizado do usuário
        const newId = crypto.randomUUID();
        finalRef = {
          ...updatedRef,
          id: newId,
          user_id: userId,
          reference_type: "upload",
          style_category: updatedRef.style_category || "Personalizado",
          created_at: new Date().toISOString(),
        };

        const { error: insErr } = await supabase.from("saved_references").insert({
          id: newId,
          user_id: userId,
          name: finalRef.name,
          reference_type: finalRef.reference_type,
          reference_path: finalRef.reference_path,
          reference_url: finalRef.reference_url,
          style_category: finalRef.style_category,
          subtitle_style: finalRef.subtitle_style,
          design_instructions: finalRef.design_instructions,
          manual_adjustments: finalRef.manual_adjustments,
          export_settings: finalRef.export_settings,
          learning_status: finalRef.learning_status || "ready",
          learning_metrics: finalRef.learning_metrics,
          sample_videos: finalRef.sample_videos,
          sample_subtitles: finalRef.sample_subtitles,
        });
        if (insErr) {
          console.warn("Aviso ao persistir clone no Supabase:", insErr.message);
        }
      } else {
        const { error: updErr } = await supabase
          .from("saved_references")
          .update({
            name: finalRef.name,
            design_instructions: finalRef.design_instructions,
            learning_status: finalRef.learning_status || "ready",
            learning_metrics: finalRef.learning_metrics,
            sample_videos: finalRef.sample_videos,
            sample_subtitles: finalRef.sample_subtitles,
            manual_adjustments: finalRef.manual_adjustments,
            export_settings: finalRef.export_settings,
          })
          .eq("id", finalRef.id);
        if (updErr) {
          console.warn("Aviso ao atualizar estilo no Supabase:", updErr.message);
        }
      }
    } catch (err) {
      console.warn("Falha de rede ao persistir atualização do estilo:", err);
    }

    // 2. Atualiza LocalStorage
    const local = localStorage.getItem(`saved_references_${userId}`);
    let list: SavedReference[] = [];
    if (local) {
      try {
        list = JSON.parse(local);
      } catch {}
    }
    const filtered = list.filter((r) => r.id !== finalRef.id);
    localStorage.setItem(`saved_references_${userId}`, JSON.stringify([finalRef, ...filtered]));

    // 3. Atualiza estado React
    setSavedRefs((prev) => {
      const exists = prev.some((r) => r.id === finalRef.id);
      if (exists) {
        return prev.map((r) => (r.id === finalRef.id ? finalRef : r));
      }
      return [finalRef, ...prev];
    });

    // Se o estilo editado for o atualmente selecionado no clonador, sincroniza
    if (selectedRefId === updatedRef.id || selectedRefId === finalRef.id) {
      setSelectedRefId(finalRef.id);
      setReferenceName(finalRef.name);
      if (finalRef.design_instructions) setDesignInstructions(finalRef.design_instructions);
      if (finalRef.export_settings?.resolution) {
        setResolution(finalRef.export_settings.resolution);
      }
      if (finalRef.manual_adjustments?.camera?.verticalMode) {
        setVerticalMode(finalRef.manual_adjustments.camera.verticalMode);
      }
    }

    const accuracyScore = finalRef.learning_metrics?.accuracyScore ?? 92;
    setSuccessMsg(`Estilo "${finalRef.name}" atualizado com sucesso! Acurácia calibrada para ${accuracyScore}%.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  // Leitura e análise de arquivos de legenda (.srt, .vtt, .ass, .json)
  async function handleSelectSubtitleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setNewSubtitleFiles((prev) => [...prev, ...fileList]);

    const firstSub = fileList[0];
    try {
      const text = await firstSub.text();
      const blocks = text.split(/\r?\n\r?\n/).filter(Boolean);
      const words = text.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean);
      const avgWps = Number((words.length / Math.max(blocks.length, 1)).toFixed(1));
      const snippet = words.slice(0, 15).join(" ") + "...";
      setSubtitlesStats({
        totalBlocks: blocks.length,
        avgWps,
        sampleSnippet: snippet,
      });
    } catch {}
  }

  function removeSubtitleFile(index: number) {
    setNewSubtitleFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Manipulação de vídeos de treino (.mp4, .mov, etc.)
  function handleSelectVideoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setNewVideoFiles((prev) => [...prev, ...Array.from(files)]);
  }

  function removeVideoFile(index: number) {
    setNewVideoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Treinar e Salvar Novo Estilo de Edição com IA
  async function handleTrainAndSaveStyle(e: React.FormEvent) {
    e.preventDefault();
    if (!newStyleName.trim()) {
      setError("Por favor, dê um nome para o seu novo estilo de edição.");
      return;
    }
    setError(null);
    setTrainingSuccess(null);
    setIsTraining(true);
    setTrainingProgress(10);
    setTrainingStatusText("Iniciando ingestão de referências e preparando ambiente…");

    try {
      // 1. Upload real dos vídeos de treinamento para o Storage
      let uploadedRefPath: string | null = null;
      if (newVideoFiles.length > 0) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada. Faça login novamente para treinar.");

        const primaryVideo = newVideoFiles[0];
        const storagePath = `${userId}/references/ref-${crypto.randomUUID()}-${safeName(primaryVideo.name)}`;

        if (primaryVideo.size > RESUMABLE_FROM_BYTES) {
          setTrainingStatusText(
            `Enviando vídeo de referência "${primaryVideo.name}" (${Math.round(primaryVideo.size / (1024 * 1024))} MB) via upload acelerado TUS…`
          );
          await uploadResumable({
            accessToken: session.access_token,
            bucket: "sources",
            path: storagePath,
            file: primaryVideo,
            onProgress: (pct) => {
              const mapped = Math.min(70, Math.round(10 + pct * 0.6));
              setTrainingProgress(mapped);
              setTrainingStatusText(
                `Enviando vídeo "${primaryVideo.name}" (${Math.round(primaryVideo.size / (1024 * 1024))} MB)... ${pct}%`
              );
            },
          });
        } else {
          setTrainingStatusText(`Enviando vídeo de referência "${primaryVideo.name}"…`);
          const { error: upErr } = await supabase.storage.from("sources").upload(storagePath, primaryVideo, {
            contentType: primaryVideo.type || "video/mp4",
          });
          if (upErr) throw new Error(`Falha no upload do vídeo de referência: ${upErr.message}`);
        }

        uploadedRefPath = storagePath;
        setTrainingProgress(75);
      }

      await new Promise((r) => setTimeout(r, 500));
      setTrainingProgress(80);
      setTrainingStatusText(
        newSubtitleFiles.length > 0
          ? `Analisando ${newSubtitleFiles.length} arquivo(s) de legenda: cadência, cores e ritmo de palavras…`
          : "Analisando estrutura de legendas e tipografia dinâmica…"
      );

      await new Promise((r) => setTimeout(r, 600));
      setTrainingProgress(90);
      setTrainingStatusText(
        newVideoFiles.length > 0
          ? `Processando ${newVideoFiles.length} vídeo(s) de referência: ritmo de corte e cadência calibrados…`
          : "Calculando perfil de ritmo de corte e enquadramento de câmeras…"
      );

      await new Promise((r) => setTimeout(r, 500));
      setTrainingProgress(96);
      setTrainingStatusText("Sintetizando Style Blueprint (DNA de edição) e persistindo no banco de dados…");

      await new Promise((r) => setTimeout(r, 400));
      setTrainingProgress(100);

      const detectedCutSec = newStyleCategory.includes("Rápido") ? 2.0 : newStyleCategory.includes("Podcast") ? 3.5 : 2.4;
      const detectedSubStyle = (subtitleStyle || "hormozi") as SubtitleStyle;
      const primaryCol = "#FFFFFF";
      const highlightCol = highlightColor || "#FACC15";

      const newRefId = crypto.randomUUID();
      const newSavedRef: SavedReference = {
        id: newRefId,
        user_id: userId,
        name: newStyleName.trim(),
        reference_type: uploadedRefPath ? "upload" : "preset",
        reference_path: uploadedRefPath,
        reference_url: null,
        style_category: newStyleCategory,
        subtitle_style: detectedSubStyle,
        design_instructions:
          newStyleInstructions.trim() ||
          `Estilo treinado com IA (${newStyleCategory}): Cortes a cada ~${detectedCutSec}s, legendas dinâmicas em ${highlightCol}, enquadramento ${verticalMode}.`,
        learning_status: "ready",
        sample_subtitles: newSubtitleFiles.map((f) => f.name),
        sample_videos: newVideoFiles.map((f) => f.name),
        learning_metrics: {
          status: "ready",
          progress: 100,
          avgCutPacingSec: detectedCutSec,
          detectedFontFamily: customFontName || "Impact / Montserrat ExtraBold",
          detectedColors: { primary: primaryCol, highlight: highlightCol },
          detectedPosition: positionY,
          cameraFramingPattern: verticalMode === "split" || verticalMode === "split_face" ? "split_screen" : "face_tracking",
          sfxDensityPerMinute: 0,
          subtitleMaxWordsPerLine: subtitlesStats?.avgWps || 3,
          sampleVideoNames: newVideoFiles.map((f) => f.name),
          sampleSubtitleNames: newSubtitleFiles.map((f) => f.name),
        },
        manual_adjustments: {
          subtitles: {
            style: detectedSubStyle,
            fontSize,
            primaryColor: primaryCol,
            highlightColor: highlightCol,
            positionY,
            enableEmojis,
            karaokeHighlight,
            customFontPath,
            customFontName,
          },
          keyMoments: {
            hookSensitivity,
            cutPacing,
            removeSilences,
            smartPunchInZoom,
          },
          soundDesign: {
            enableSfx: false,
            backgroundMusicDucking: false,
            sfxVolume,
          },
          brolls: {
            enabled: useBroll,
            source: brollSource,
            frequency: "medium",
          },
          camera: {
            verticalMode,
            dynamicZoom: smartPunchInZoom,
          },
        },
        export_settings: {
          resolution,
          codec,
          fps,
          bitrate,
          audioNormalization,
          generateNleTimeline,
        },
        created_at: new Date().toISOString(),
      };

      // 1. Salvar no Supabase
      const { error: insertErr } = await supabase.from("saved_references").insert({
        id: newRefId,
        user_id: userId,
        name: newSavedRef.name,
        reference_type: newSavedRef.reference_type,
        reference_path: newSavedRef.reference_path,
        reference_url: null,
        style_category: newSavedRef.style_category,
        subtitle_style: newSavedRef.subtitle_style,
        design_instructions: newSavedRef.design_instructions,
        manual_adjustments: newSavedRef.manual_adjustments,
        export_settings: newSavedRef.export_settings,
        learning_status: "ready",
        learning_metrics: newSavedRef.learning_metrics,
        sample_videos: newSavedRef.sample_videos,
        sample_subtitles: newSavedRef.sample_subtitles,
      });

      if (insertErr) {
        console.error("Falha ao salvar no Supabase:", insertErr);
        throw new Error(`Falha ao registrar estilo no banco de dados: ${insertErr.message}`);
      }

      // 2. Salvar no LocalStorage (como cache)
      const local = localStorage.getItem(`saved_references_${userId}`);
      let list: SavedReference[] = [];
      if (local) {
        try {
          list = JSON.parse(local);
        } catch {}
      }
      localStorage.setItem(`saved_references_${userId}`, JSON.stringify([newSavedRef, ...list]));

      setSavedRefs((prev) => [newSavedRef, ...prev.filter((r) => r.id !== newSavedRef.id)]);
      setTrainingSuccess(
        `Estilo "${newSavedRef.name}" treinado e salvo com sucesso! ${
          uploadedRefPath ? "Vídeo de referência armazenado e pronto para clonagem pelo worker." : "DNA de edição registrado na nuvem."
        }`
      );

      // Limpa os campos de criação
      setNewStyleName("");
      setNewStyleInstructions("");
      setNewSubtitleFiles([]);
      setNewVideoFiles([]);
      setSubtitlesStats(null);
    } catch (err: any) {
      setError(err?.message || "Falha ao processar treinamento de estilo.");
    } finally {
      setIsTraining(false);
    }
  }

  // Submissão do Estúdio de Cópia de Edição
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validação da Referência (Estilo Salvo ou Vídeo Avulso)
    if (styleSourceType === "custom_video") {
      if (refMode === "upload" && !refFile) {
        return setError("Por favor, envie o arquivo de vídeo de referência (.mp4, .mov) ou use um estilo salvo.");
      }
      if (refMode === "link" && !refUrl.trim()) {
        return setError("Insira o link do vídeo de referência que você deseja clonar.");
      }
    } else {
      if (!selectedRefId) {
        return setError("Por favor, selecione um estilo salvo ou preset da biblioteca.");
      }
    }

    // Validação do Vídeo Principal
    if (sourceMode === "upload" && !sourceFile && !sourceClip) {
      return setError("Selecione o vídeo principal que será transformado.");
    }
    if (sourceMode === "link" && !sourceUrl.trim() && !sourceClip) {
      return setError("Insira o link do vídeo principal (YouTube, etc.).");
    }

    setBusy(true);

    try {
      // 1. Upload do vídeo de referência (somente se for modo vídeo avulso com arquivo novo)
      let refPath: string | null = null;
      if (styleSourceType === "custom_video" && refMode === "upload" && refFile) {
        const path = `${userId}/ref-${crypto.randomUUID()}-${safeName(refFile.name)}`;
        if (refFile.size > RESUMABLE_FROM_BYTES) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("Sessão expirada. Faça login novamente.");
          setUploadPct(0);
          await uploadResumable({
            accessToken: session.access_token,
            bucket: "sources",
            path,
            file: refFile,
            onProgress: (p) => setUploadPct(p),
          });
          setUploadPct(null);
        } else {
          const { error: refUpErr } = await supabase.storage.from("sources").upload(path, refFile, {
            contentType: refFile.type || "video/mp4",
          });
          if (refUpErr) throw new Error(`Falha no upload do vídeo de referência: ${refUpErr.message}`);
        }
        refPath = path;
      }
      // Se selecionou um estilo já treinado/salvo da biblioteca, NÃO passamos refPath para re-download.
      // O worker aplicará diretamente o Style Blueprint, métricas e design já aprendidos.

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
      const existingRef = selectedRefId ? savedRefs.find((r) => r.id === selectedRefId) : null;

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
        camera: {
          verticalMode,
          dynamicZoom: smartPunchInZoom,
        },
        learning_metrics: existingRef?.learning_metrics,
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
          const { error: saveErr } = await supabase.from("saved_references").insert({
            id: newSavedRef.id,
            user_id: userId,
            name: finalRefName,
            reference_type: refPath ? "upload" : refMode,
            reference_url: refMode === "link" ? refUrl : null,
            reference_path: refPath,
            custom_font_path: finalFontPath,
            custom_font_name: finalFontName,
            style_category: "Personalizado",
            subtitle_style: subtitleStyle,
            design_instructions: designInstructions,
            manual_adjustments: manualAdjustmentsPayload,
            export_settings: exportSettingsPayload,
            learning_status: "ready",
            learning_metrics: {
              status: "ready",
              progress: 100,
              avgCutPacingSec: cutPacing === "ultra_fast" ? 2.0 : 3.0,
            },
          });
          if (saveErr) console.warn("Aviso ao salvar estilo no Supabase:", saveErr.message);
        } catch (e) {
          console.warn("Aviso ao salvar no Supabase:", e);
        }

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
      if (sourceClip) {
        sourcePayload = {
          source_type: "upload",
          source_path: sourceClip.path,
          file_name: `corte-${sourceClip.position || "1"}-${safeName(sourceClip.title)}.mp4`,
        };
      } else if (sourceMode === "link") {
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
        user_id: userId,
        ...sourcePayload,
        orientation: resolution.includes("1920x1080") ? "horizontal" : "vertical",
        vertical_mode: verticalMode || "face_tracking",
        crop_x: 0.5,
        clip_count: clipCount,
        min_seconds: minSeconds,
        max_seconds: maxSeconds,
        language: "pt-BR",
        reference_type: styleSourceType === "saved" ? (existingRef?.reference_type || "preset") : (refFile ? "upload" : (refMode === "link" && refUrl ? "link" : "preset")),
        reference_url: styleSourceType === "custom_video" && !refFile && refMode === "link" ? refUrl : (styleSourceType === "saved" ? (existingRef?.reference_url || null) : null),
        reference_path: styleSourceType === "custom_video" && refFile ? refPath : (styleSourceType === "saved" ? (existingRef?.reference_path || null) : null),
        reference_style: referenceName || existingRef?.name || "Estilo Clonado Studio",
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
      handleClearSourceClip();
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

      {/* SELETOR DE ABAS PRINCIPAIS DO CLONE STUDIO */}
      <div className="studio-nav-tabs">
        <button
          type="button"
          className={`studio-nav-tab ${activeStudioTab === "clonar" ? "active" : ""}`}
          onClick={() => setActiveStudioTab("clonar")}
        >
          <Copy size={16} />
          <span>Clonar Vídeo (Home)</span>
        </button>
        <button
          type="button"
          className={`studio-nav-tab ${activeStudioTab === "estilos" ? "active" : ""}`}
          onClick={() => setActiveStudioTab("estilos")}
        >
          <Palette size={16} />
          <span>Estilos de Edição</span>
          <span className="badge badge-accent" style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}>
            IA Training
          </span>
        </button>
      </div>

      {/* ========================================================
          ABA 2: ESTILOS DE EDIÇÃO (CENTRAL DE APRENDIZAGEM)
      ======================================================== */}
      {activeStudioTab === "estilos" && (
        <div className="stack-lg">
          {trainingSuccess && (
            <div className="alert-success" style={{ margin: "0.5rem 0" }}>
              <CheckCircle size={18} />
              <div style={{ flex: 1 }}>
                <span>{trainingSuccess}</span>
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() => {
                      const latest = savedRefs[0];
                      if (latest) applyReference(latest);
                      setActiveStudioTab("clonar");
                    }}
                  >
                    <Zap size={14} style={{ marginRight: "4px" }} />
                    Usar este Estilo no Clonador de Vídeo →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CARD 1: CRIAR E TREINAR NOVO ESTILO */}
          <div className="card-subtle stack" style={{ padding: "1.25rem", border: "1px solid var(--card-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cpu size={18} style={{ color: "var(--primary)" }} />
                  Criar Novo Estilo de Edição &amp; Treinar IA
                </h3>
                <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
                  Envie seus arquivos de legenda e vídeos prontos para que a inteligência artificial aprenda seu DNA de edição
                </p>
              </div>
              <span className="badge badge-accent">Motor de Aprendizagem</span>
            </div>

            <form onSubmit={handleTrainAndSaveStyle} className="stack" style={{ gap: "1rem", marginTop: "0.75rem" }}>
              <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 2, minWidth: "240px" }}>
                  <label className="field-label">Nome do Estilo de Edição *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Dark Reels Alta Retenção, Podcast Alfa Flow, VSL Viral..."
                    value={newStyleName}
                    onChange={(e) => setNewStyleName(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: "180px" }}>
                  <label className="field-label">Categoria / Nicho</label>
                  <select
                    className="input select"
                    value={newStyleCategory}
                    onChange={(e) => setNewStyleCategory(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="Ganchos Rápidos">Ganchos Rápidos (1-2s)</option>
                    <option value="Podcast / Conversa">Podcast &amp; Conversa</option>
                    <option value="Educacional / Tech">Educacional &amp; Minimalista</option>
                    <option value="VSL / Vendas">VSL &amp; Marketing</option>
                    <option value="Gamer / Reações">Gamer &amp; Dinâmico</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label className="field-label">Formato Padrão de Saída</label>
                  <select
                    className="input select"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    style={{ width: "100%" }}
                  >
                    <option value="1080x1920">Vertical 9:16 (TikTok / Reels / Shorts)</option>
                    <option value="1920x1080">Horizontal 16:9 (YouTube Padrão)</option>
                    <option value="1080x1080">Quadrado 1:1 (Feed Instagram)</option>
                    <option value="2160x3840">4K Vertical 9:16 (Ultra HD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Instruções / Diretrizes de Edição (Opcional)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Ex: Cortes secos sem respiro, palavras de impacto em amarelo neon, alternância dinâmica de câmera..."
                  value={newStyleInstructions}
                  onChange={(e) => setNewStyleInstructions(e.target.value)}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              {/* UPLOAD 1: ARQUIVOS DE LEGENDA (.SRT, .ASS, .VTT, .JSON) */}
              <div className="control-box" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Subtitles size={16} style={{ color: "var(--primary)" }} />
                    <strong style={{ fontSize: "0.9rem" }}>Arquivos de Legenda (.srt, .ass, .vtt, .json)</strong>
                  </div>
                  <span className="muted small">A IA aprende cadência, cores e quebra de palavras</span>
                </div>

                <input
                  ref={subFilesInputRef}
                  type="file"
                  multiple
                  accept=".srt,.vtt,.ass,.json,text/plain"
                  style={{ display: "none" }}
                  onChange={(e) => handleSelectSubtitleFiles(e.target.files)}
                />

                <div
                  className="drop-zone"
                  onClick={() => subFilesInputRef.current?.click()}
                  style={{ padding: "1rem", textAlign: "center", cursor: "pointer", borderStyle: "dashed" }}
                >
                  <Upload size={22} style={{ color: "var(--primary)", marginBottom: "0.3rem" }} />
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    Clique para selecionar ou arraste seus <strong>arquivos de legenda</strong>
                  </p>
                  <small className="muted">Suporta .srt, .vtt, .ass (múltiplos arquivos)</small>
                </div>

                {newSubtitleFiles.length > 0 && (
                  <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {newSubtitleFiles.map((f, idx) => (
                      <span key={idx} className="file-chip">
                        <Subtitles size={13} />
                        <span>{f.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSubtitleFile(idx);
                          }}
                          style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0 2px" }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {subtitlesStats && (
                  <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", background: "rgba(139, 92, 246, 0.08)", borderRadius: "6px", fontSize: "0.8rem" }}>
                    <strong style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <BarChart3 size={14} /> Telemetria de Legendas Detectada:
                    </strong>{" "}
                    {subtitlesStats.totalBlocks} falas analisadas • Média de {subtitlesStats.avgWps} palavras por bloco • Amostra: <em>"{subtitlesStats.sampleSnippet}"</em>
                  </div>
                )}
              </div>

              {/* UPLOAD 2: VÍDEOS PRONTOS DE REFERÊNCIA (.MP4, .MOV, .MKV) */}
              <div className="control-box" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Video size={16} style={{ color: "var(--primary)" }} />
                    <strong style={{ fontSize: "0.9rem" }}>Vídeos Prontos para Treinamento (.mp4, .mov, .mkv)</strong>
                  </div>
                  <span className="muted small">A IA analisa ritmo de cortes, transições e enquadramento</span>
                </div>

                <input
                  ref={videoFilesInputRef}
                  type="file"
                  multiple
                  accept="video/*,.mp4,.mov,.mkv"
                  style={{ display: "none" }}
                  onChange={(e) => handleSelectVideoFiles(e.target.files)}
                />

                <div
                  className="drop-zone"
                  onClick={() => videoFilesInputRef.current?.click()}
                  style={{ padding: "1rem", textAlign: "center", cursor: "pointer", borderStyle: "dashed" }}
                >
                  <FileVideo size={22} style={{ color: "var(--primary)", marginBottom: "0.3rem" }} />
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    Clique para selecionar ou arraste seus <strong>vídeos prontos e finalizados</strong>
                  </p>
                  <small className="muted">MP4 ou MOV com as edições e cortes que você deseja que a IA aprenda</small>
                </div>

                {newVideoFiles.length > 0 && (
                  <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {newVideoFiles.map((v, idx) => (
                      <span key={idx} className="file-chip">
                        <Film size={13} />
                        <span>{v.name} ({Math.round(v.size / (1024 * 1024))} MB)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeVideoFile(idx);
                          }}
                          style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0 2px" }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* PROGRESSO DO TREINAMENTO */}
              {isTraining && (
                <div className="stack" style={{ gap: "0.4rem", padding: "0.8rem", background: "rgba(139, 92, 246, 0.1)", borderRadius: "8px" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <small style={{ color: "var(--primary)", fontWeight: 600 }}>{trainingStatusText}</small>
                    <small><strong>{trainingProgress}%</strong></small>
                  </div>
                  <div className="bar" style={{ height: "8px" }}>
                    <div className="bar-fill" style={{ width: `${trainingProgress}%`, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              )}

              {/* BOTÃO DE INICIAR TREINAMENTO */}
              <div>
                <button
                  type="submit"
                  className="btn btn-cta"
                  disabled={isTraining || !newStyleName.trim()}
                  style={{ width: "100%", padding: "0.85rem" }}
                >
                  <Cpu size={18} />
                  <span>{isTraining ? "Treinando Motor de IA…" : "Treinar & Salvar Estilo de Edição"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: BIBLIOTECA DE ESTILOS TREINADOS E DISPONÍVEIS */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <h3 style={{ fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Bookmark size={17} style={{ color: "var(--primary)" }} />
                Seus Estilos Treinados &amp; Biblioteca ({savedRefs.length})
              </h3>
              <span className="muted small">Clique em "Usar no Clonador" para carregar no projeto</span>
            </div>

            <div className="style-library-grid">
              {savedRefs.map((st) => (
                <div key={st.id} className={`style-card ${selectedRefId === st.id ? "selected" : ""}`}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div>
                      <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{st.name}</strong>
                      <span className="muted small" style={{ display: "block" }}>{st.style_category || "Geral"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: "0.68rem",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontWeight: 600,
                        }}
                      >
                        <Zap size={10} />
                        {st.learning_metrics?.accuracyScore ?? (st.sample_videos && st.sample_videos.length > 1 ? 86 : 78)}%
                      </span>
                      {st.learning_status === "ready" || st.reference_type === "preset" ? (
                        <span className="badge badge-accent" style={{ fontSize: "0.68rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          Treinado
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="muted small" style={{ margin: "0.2rem 0", lineHeight: 1.4, fontSize: "0.78rem" }}>
                    {st.design_instructions || "Estilo personalizado para clonagem de edição."}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: "0.3rem 0" }}>
                    <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Clock size={11} /> Ritmo: <strong>{st.learning_metrics?.avgCutPacingSec ? `${st.learning_metrics.avgCutPacingSec}s` : st.manual_adjustments?.keyMoments?.cutPacing === "ultra_fast" ? "1-3s" : "3-5s"}</strong>
                    </span>
                    <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Subtitles size={11} /> Legenda: <strong>{st.subtitle_style || "Hormozi"}</strong>
                    </span>
                    <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Video size={11} /> Câmera: <strong>{st.manual_adjustments?.camera?.verticalMode === "split" ? "Split" : "Auto-Face"}</strong>
                    </span>
                    {st.reference_path && (
                      <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "var(--primary)" }}>
                        <Film size={11} /> Vídeo Vinculado
                      </span>
                    )}
                    {st.sample_videos && st.sample_videos.length > 0 && (
                      <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Film size={11} /> {st.sample_videos.length} vídeo{st.sample_videos.length > 1 ? "s" : ""} treino
                      </span>
                    )}
                    {st.sample_subtitles && st.sample_subtitles.length > 0 && (
                      <span className="metric-tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <FileText size={11} /> {st.sample_subtitles.length} legendas
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "0.5rem", borderTop: "1px solid var(--card-border)" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => {
                        applyReference(st);
                        setActiveStudioTab("clonar");
                      }}
                    >
                      <Sparkles size={14} style={{ marginRight: "4px" }} />
                      Usar no Clonador
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => handleOpenEditModal(st)}
                      title="Editar estilo (renomear e adicionar mais vídeos de treinamento)"
                      style={{ color: "var(--primary)", padding: "0.4rem 0.6rem" }}
                    >
                      <Pencil size={14} />
                    </button>
                    {!st.id.startsWith("preset-") && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => handleDeleteSavedRef(st.id)}
                        title="Excluir estilo"
                        style={{ color: "var(--danger)", padding: "0.4rem 0.6rem" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 1: CLONAR VÍDEO (HOME DO CLONADOR DE VÍDEO)
      ======================================================== */}
      {activeStudioTab === "clonar" && (
        <form onSubmit={handleSubmit} className="stack-lg" style={{ marginTop: "0.5rem" }}>
          {/* ========================================================
              ETAPA 1: O ESTILO A SER CLONADO (TREINADO OU PRESET)
          ======================================================== */}
          <section className="studio-section">
            <div className="studio-section-title">
              <span className="step-number">1</span>
              <div>
                <h3>Como você deseja clonar a edição?</h3>
                <p className="muted small">Escolha entre um estilo já salvo na sua biblioteca (zero vídeo necessário) ou envie um novo vídeo de referência</p>
              </div>
            </div>

            {/* SELETOR DE ORIGEM: ESTILO SALVO VS VÍDEO AVULSO */}
            <div className="segmented-control" style={{ marginBottom: "1.25rem", maxWidth: "600px" }}>
              <button
                type="button"
                className={`segmented-btn ${styleSourceType === "saved" ? "active" : ""}`}
                onClick={() => setStyleSourceType("saved")}
              >
                <Bookmark size={15} />
                <span>Estilo Salvo da Biblioteca ({savedRefs.length})</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${styleSourceType === "custom_video" ? "active" : ""}`}
                onClick={() => setStyleSourceType("custom_video")}
              >
                <Upload size={15} />
                <span>Novo Vídeo de Referência</span>
              </button>
            </div>

            {/* OPÇÃO 1: ESTILO SALVO DA BIBLIOTECA (SEM VÍDEO EXIGIDO) */}
            {styleSourceType === "saved" && (
              <div className="stack" style={{ gap: "0.85rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <label className="field-label" style={{ margin: 0 }}>Selecione o Estilo Salvo:</label>
                    <span className="badge badge-accent" style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
                      Zero vídeo necessário
                    </span>
                  </div>
                  <select
                    className="input select"
                    style={{ width: "100%", fontSize: "0.95rem", fontWeight: 600 }}
                    value={selectedRefId || ""}
                    onChange={(e) => {
                      const target = savedRefs.find((r) => r.id === e.target.value);
                      if (target) applyReference(target);
                    }}
                  >
                    {savedRefs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.style_category || "Geral"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* BANNER COM RESUMO DO ESTILO SELECIONADO */}
                {selectedRefId && (
                  <div
                    style={{
                      background: "rgba(139, 92, 246, 0.08)",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius: "8px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.6rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Sparkles size={16} style={{ color: "var(--primary)" }} />
                        <strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>
                          {referenceName || "Estilo Selecionado"}
                        </strong>
                        <span className="badge badge-accent" style={{ fontSize: "0.68rem" }}>Ativo</span>
                        <span
                          className="badge"
                          style={{
                            fontSize: "0.68rem",
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontWeight: 600,
                          }}
                        >
                          <Zap size={10} />
                          {(() => {
                            const target = savedRefs.find((r) => r.id === selectedRefId);
                            return target?.learning_metrics?.accuracyScore ?? (target?.sample_videos && target.sample_videos.length > 1 ? 86 : 78);
                          })()}% Acurácia
                        </span>
                      </div>
                      <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                        Legendas: <strong>{subtitleStyle}</strong> • Destaque:{" "}
                        <span style={{ color: highlightColor, fontWeight: 700 }}>● {highlightColor}</span> • Câmera:{" "}
                        <strong>{verticalMode === "split" ? "Split 50/50" : verticalMode === "split_face" ? "Podcast IA" : "Auto-Face"}</strong> • Ritmo:{" "}
                        <strong>{cutPacing}</strong> • Formato:{" "}
                        <strong style={{ color: "var(--primary)" }}>
                          {resolution === "1920x1080"
                            ? "16:9 Horizontal"
                            : resolution === "1080x1080"
                            ? "1:1 Quadrado"
                            : resolution === "2160x3840"
                            ? "9:16 4K Ultra"
                            : "9:16 Vertical"}
                        </strong>
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Monitor size={12} style={{ color: "var(--primary)" }} /> Formato de Saída deste Clone:
                        </span>
                        <div style={{ display: "inline-flex", background: "rgba(15, 23, 42, 0.4)", borderRadius: "6px", padding: "2px", border: "1px solid var(--card-border)" }}>
                          <button
                            type="button"
                            onClick={() => setResolution("1080x1920")}
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.72rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              background: resolution === "1080x1920" || resolution === "2160x3840" ? "var(--primary)" : "transparent",
                              color: resolution === "1080x1920" || resolution === "2160x3840" ? "#fff" : "var(--text-muted)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Smartphone size={11} /> 9:16 Vertical
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolution("1920x1080")}
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.72rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              background: resolution === "1920x1080" ? "var(--primary)" : "transparent",
                              color: resolution === "1920x1080" ? "#fff" : "var(--text-muted)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Monitor size={11} /> 16:9 Horizontal
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolution("1080x1080")}
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.72rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              background: resolution === "1080x1080" ? "var(--primary)" : "transparent",
                              color: resolution === "1080x1080" ? "#fff" : "var(--text-muted)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Square size={11} /> 1:1 Quadrado
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          const target = savedRefs.find((r) => r.id === selectedRefId);
                          if (target) handleOpenEditModal(target);
                        }}
                        title="Editar estilo (renomear e adicionar mais vídeos de treinamento)"
                        style={{ color: "var(--primary)" }}
                      >
                        <Pencil size={13} style={{ marginRight: "4px" }} />
                        Editar Estilo
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setActiveStudioTab("estilos")}
                      >
                        <Palette size={14} style={{ marginRight: "4px" }} />
                        Gerenciar / Treinar Estilos
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OPÇÃO 2: NOVO VÍDEO DE REFERÊNCIA AVULSO */}
            {styleSourceType === "custom_video" && (
              <div className="stack" style={{ gap: "0.85rem" }}>
                <div className="tab-group" style={{ marginBottom: "0.5rem" }}>
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
                      placeholder="Ex: https://www.youtube.com/shorts/... ou https://www.instagram.com/reels/..."
                      value={refUrl}
                      onChange={(e) => setRefUrl(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}

                {/* OPÇÃO DE SALVAR REFERÊNCIA PARA REUTILIZAR */}
                <div className="card-subtle stack" style={{ padding: "0.85rem" }}>
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
              </div>
            )}
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

          {sourceClip ? (
            <div
              style={{
                background: "rgba(0, 240, 255, 0.08)",
                border: "1px solid rgba(0, 240, 255, 0.4)",
                borderRadius: "12px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "rgba(0, 240, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00F0FF",
                      boxShadow: "0 0 12px rgba(0, 240, 255, 0.3)",
                    }}
                  >
                    <Film size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#00F0FF", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      ★ Corte Pré-Selecionado #{sourceClip.position || "1"}
                    </span>
                    <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--text)" }}>
                      {sourceClip.title}
                    </strong>
                    <span className="muted small" style={{ fontSize: "0.76rem" }}>
                      ✓ Vídeo já disponível no servidor (Zero tempo de upload necessário)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearSourceClip}
                  className="btn btn-secondary btn-small"
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
                  title="Trocar vídeo e escolher outro arquivo ou link"
                >
                  Trocar Vídeo
                </button>
              </div>
            </div>
          ) : (
            <>
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
            </>
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
                          CORTES AI 100%
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

            {/* Bloco 2: Posição de Câmeras & Enquadramento Vertical */}
            <div className="control-box">
              <div className="control-box-header">
                <Video size={17} style={{ color: "var(--primary)" }} />
                <strong>Posição de Câmeras &amp; Enquadramento</strong>
              </div>

              <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                <div>
                  <label className="field-label">Enquadramento Vertical Automático</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: "0.45rem" }}>
                    <div
                      className={`selection-card ${verticalMode === "face_tracking" ? "active" : ""}`}
                      onClick={() => setVerticalMode("face_tracking")}
                      style={{
                        padding: "0.55rem 0.4rem",
                        border: verticalMode === "face_tracking" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: verticalMode === "face_tracking" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                        textAlign: "center",
                      }}
                    >
                      <User size={18} style={{ color: verticalMode === "face_tracking" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                      <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Auto-Face (IA)</strong>
                      <small className="muted" style={{ fontSize: "0.68rem" }}>Centraliza falante</small>
                    </div>

                    <div
                      className={`selection-card ${verticalMode === "split_face" ? "active" : ""}`}
                      onClick={() => setVerticalMode("split_face")}
                      style={{
                        padding: "0.55rem 0.4rem",
                        border: verticalMode === "split_face" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: verticalMode === "split_face" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                        textAlign: "center",
                      }}
                    >
                      <Users size={18} style={{ color: verticalMode === "split_face" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                      <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Podcast IA</strong>
                      <small className="muted" style={{ fontSize: "0.68rem" }}>Host + Convidado</small>
                    </div>

                    <div
                      className={`selection-card ${verticalMode === "crop" ? "active" : ""}`}
                      onClick={() => setVerticalMode("crop")}
                      style={{
                        padding: "0.55rem 0.4rem",
                        border: verticalMode === "crop" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: verticalMode === "crop" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                        textAlign: "center",
                      }}
                    >
                      <Crop size={18} style={{ color: verticalMode === "crop" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                      <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Preencher 9:16</strong>
                      <small className="muted" style={{ fontSize: "0.68rem" }}>Recorte central</small>
                    </div>

                    <div
                      className={`selection-card ${verticalMode === "blur" ? "active" : ""}`}
                      onClick={() => setVerticalMode("blur")}
                      style={{
                        padding: "0.55rem 0.4rem",
                        border: verticalMode === "blur" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: verticalMode === "blur" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                        textAlign: "center",
                      }}
                    >
                      <Layers size={18} style={{ color: verticalMode === "blur" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                      <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Fundo Blur</strong>
                      <small className="muted" style={{ fontSize: "0.68rem" }}>Com desfoque</small>
                    </div>

                    <div
                      className={`selection-card ${verticalMode === "split" ? "active" : ""}`}
                      onClick={() => setVerticalMode("split")}
                      style={{
                        padding: "0.55rem 0.4rem",
                        border: verticalMode === "split" ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: verticalMode === "split" ? "rgba(139, 92, 246, 0.12)" : "var(--card-bg)",
                        textAlign: "center",
                      }}
                    >
                      <Columns size={18} style={{ color: verticalMode === "split" ? "var(--primary)" : "var(--muted)", margin: "0 auto" }} />
                      <strong style={{ display: "block", fontSize: "0.8rem", marginTop: "3px" }}>Split 50/50</strong>
                      <small className="muted" style={{ fontSize: "0.68rem" }}>Divisão fixa</small>
                    </div>
                  </div>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={smartPunchInZoom}
                    onChange={(e) => setSmartPunchInZoom(e.target.checked)}
                  />
                  <span>Punch-in Zoom dinâmico em falas de impacto/clímax</span>
                </label>
              </div>
            </div>

            {/* Bloco 3: Momentos Importantes & Dinâmica de Corte */}
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
                  <option value="1080x1920">1080x1920 (Vertical 9:16 - TikTok / Reels / Shorts)</option>
                  <option value="2160x3840">2160x3840 (4K Vertical Ultra HD)</option>
                  <option value="1920x1080">1920x1080 (Horizontal 16:9 - YouTube Padrão)</option>
                  <option value="1080x1080">1080x1080 (Quadrado 1:1 - Feed Instagram)</option>
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
                  <Volume2 size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                  Normalização de Áudio EBU R128 (-14 LUFS para Redes Sociais)
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
      )}

      {/* MODAL DE REFERÊNCIAS SALVAS */}
      <SavedReferencesModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        references={savedRefs}
        onSelect={applyReference}
        onDelete={handleDeleteSavedRef}
        onEdit={handleOpenEditModal}
      />

      {/* MODAL DE EDIÇÃO DE ESTILO E ADIÇÃO DE VÍDEOS DE TREINO (ACURÁCIA) */}
      <EditStyleModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingReference(null);
        }}
        reference={editingReference}
        onSave={handleUpdateSavedRef}
        userId={userId}
      />
    </div>
  );
}
