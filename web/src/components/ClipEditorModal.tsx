"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Clip, CanvasBroll, CanvasBrollTemplate, SubtitleStyle, VerticalMode } from "@/lib/types";
import { SYSTEM_FONTS, type SystemFont } from "@/lib/systemFonts";
import CanvasBrollOverlay from "./CanvasBrollOverlay";
import { detectBrollTriggers, type BrollTriggerSuggestion } from "@/lib/detectBrollTriggers";
import CloneStudioModal from "./CloneStudioModal";
import {
  DownloadIcon,
  SparklesIcon,
  XIcon,
  Film,
  Scissors,
  Camera,
  Crop,
  Clock,
  Play,
  Pause,
  Maximize2,
  Save,
  Smartphone,
  Square,
  Monitor,
  Trash2,
  SlidersHorizontal,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  EyeIcon,
  EyeOffIcon,
  Lightbulb,
  Copy,
  ActivityIcon,
  X,
  Check,
  Undo,
  Redo,
  Subtitles,
  Type,
  Palette,
} from "./Icons";

interface ClipEditorModalProps {
  clip: Clip;
  videoSrc?: string;
  userId?: string;
  projectId?: string;
  initialAspectRatio?: "9:16" | "1:1" | "16:9";
  initialOrientation?: "vertical" | "horizontal";
  onClose: () => void;
  onUpdateClipTime?: (
    clipId: string,
    trimStart: number,
    trimEnd: number,
    canvasBrolls?: CanvasBroll[],
    adjustments?: {
      aspectRatio?: "9:16" | "1:1" | "16:9";
      verticalMode?: VerticalMode;
      cropX?: number;
      subtitleStyle?: SubtitleStyle;
      customFontName?: string;
      primaryColor?: string;
      highlightColor?: string;
      subtitlePosition?: "bottom" | "center-bottom" | "center";
      subtitleFontSize?: "small" | "medium" | "large" | "extra";
      enableEmojis?: boolean;
      subtitles?: Record<string, any>;
      [key: string]: any;
    }
  ) => Promise<void> | void;
  onSaveCanvasBrolls?: (clipId: string, brolls: CanvasBroll[]) => Promise<void> | void;
}

export default function ClipEditorModal({
  clip,
  videoSrc,
  userId,
  projectId,
  initialAspectRatio,
  initialOrientation,
  onClose,
  onUpdateClipTime,
  onSaveCanvasBrolls,
}: ClipEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(1, Number(clip.end_seconds) - Number(clip.start_seconds));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [activeTab, setActiveTab] = useState<"brolls" | "trim" | "thumbnail" | "formats" | "subtitles" | "crop">("brolls");
  const [isSavingTrim, setIsSavingTrim] = useState(false);
  const [isSavingBrolls, setIsSavingBrolls] = useState(false);

  // Determinação inteligente de aspecto inicial (16:9 para vídeos horizontais, 9:16 para verticais)
  const userChangedAspectRef = useRef(false);

  const determineInitialAspectRatio = (): "9:16" | "1:1" | "16:9" => {
    if (initialAspectRatio) return initialAspectRatio;
    if (initialOrientation === "horizontal") return "16:9";
    if (initialOrientation === "vertical") return "9:16";
    if (clip.edit_decisions?.orientation === "horizontal") return "16:9";
    if (clip.edit_decisions?.orientation === "vertical") return "9:16";
    return "9:16";
  };

  // Estados de Formato, Enquadramento e Legendas
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">(determineInitialAspectRatio);

  // Ao abrir o editor, pausa qualquer vídeo em reprodução no fundo da página
  useEffect(() => {
    document.querySelectorAll("video").forEach((v) => {
      if (v !== videoRef.current) {
        try {
          v.pause();
        } catch {}
      }
    });
  }, []);

  // Detecta proporção real do arquivo quando o vídeo carregar os metadados (se o usuário ainda não alterou manualmente)
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (!userChangedAspectRef.current && vid.videoWidth && vid.videoHeight) {
      if (vid.videoWidth > vid.videoHeight * 1.15) {
        setAspectRatio("16:9");
      } else if (vid.videoHeight > vid.videoWidth * 1.15) {
        setAspectRatio("9:16");
      } else if (Math.abs(vid.videoWidth - vid.videoHeight) / Math.max(vid.videoWidth, vid.videoHeight) < 0.15) {
        setAspectRatio("1:1");
      }
    }
  };
  const [verticalMode, setVerticalMode] = useState<VerticalMode>("crop");
  const [cropX, setCropX] = useState<number>(0.5); // 0.0 (esquerda) a 1.0 (direita), 0.5 (centro)
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("hormozi");
  
  // Customização Completa de Legendas & Tipografias do Sistema (Poppins Bold como padrão moderno)
  const [selectedFontName, setSelectedFontName] = useState<string>("Poppins Bold");
  const [primaryColor, setPrimaryColor] = useState<string>("#FFFFFF");
  const [highlightColor, setHighlightColor] = useState<string>("#FACC15");
  const [subtitlePosition, setSubtitlePosition] = useState<"bottom" | "center-bottom" | "center">("bottom");
  const [subtitleFontSize, setSubtitleFontSize] = useState<"small" | "medium" | "large" | "extra">("large");
  const [customSubtitleFontSize, setCustomSubtitleFontSize] = useState<number>(28);
  const [enableEmojis, setEnableEmojis] = useState<boolean>(true);
  const [showSubtitlePreview, setShowSubtitlePreview] = useState<boolean>(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  // Redimensionamento interativo das seções laterais (Painéis Esquerdo e Direito)
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clip_editor_left_width");
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 200 && parsed <= 550) return parsed;
      }
    }
    return 300;
  });

  const [rightWidth, setRightWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clip_editor_right_width");
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 220 && parsed <= 550) return parsed;
      }
    }
    return 280;
  });

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Interface do snapshot do editor para a pilha de histórico
  interface EditorSnapshot {
    trimStart: number;
    trimEnd: number;
    canvasBrolls: CanvasBroll[];
    selectedBrollId: string | null;
    aspectRatio: "9:16" | "1:1" | "16:9";
    verticalMode: VerticalMode;
    cropX: number;
    subtitleStyle: SubtitleStyle;
    selectedFontName: string;
    primaryColor: string;
    highlightColor: string;
    subtitlePosition: "bottom" | "center-bottom" | "center";
    subtitleFontSize: "small" | "medium" | "large" | "extra";
    customSubtitleFontSize: number;
    enableEmojis: boolean;
  }

  // Estados de B-Rolls Canvas & Overlays
  const [canvasBrolls, setCanvasBrolls] = useState<CanvasBroll[]>(clip.canvas_brolls || []);
  const [selectedBrollId, setSelectedBrollId] = useState<string | null>(
    clip.canvas_brolls && clip.canvas_brolls.length > 0 ? clip.canvas_brolls[0].id : null
  );
  const [enableBrollOverlay, setEnableBrollOverlay] = useState(true);

  // Pilha de Histórico de Ações (Undo / Redo)
  const [pastStack, setPastStack] = useState<EditorSnapshot[]>([]);
  const [futureStack, setFutureStack] = useState<EditorSnapshot[]>([]);
  const isUndoRedoActionRef = useRef(false);

  // Registra novo estado na pilha de histórico
  const recordHistory = useCallback(
    (overrides?: Partial<EditorSnapshot>) => {
      if (isUndoRedoActionRef.current) return;
      setPastStack((prev) => [
        ...prev.slice(-30), // limita a 30 ações para memória enxuta
        {
          trimStart,
          trimEnd,
          canvasBrolls: JSON.parse(JSON.stringify(canvasBrolls)),
          selectedBrollId,
          aspectRatio,
          verticalMode,
          cropX,
          subtitleStyle,
          selectedFontName,
          primaryColor,
          highlightColor,
          subtitlePosition,
          subtitleFontSize,
          customSubtitleFontSize,
          enableEmojis,
          ...overrides,
        },
      ]);
      setFutureStack([]); // limpa o refazer ao tomar nova ação
    },
    [
      trimStart,
      trimEnd,
      canvasBrolls,
      selectedBrollId,
      aspectRatio,
      verticalMode,
      cropX,
      subtitleStyle,
      selectedFontName,
      primaryColor,
      highlightColor,
      subtitlePosition,
      subtitleFontSize,
      customSubtitleFontSize,
      enableEmojis,
    ]
  );

  // Função Desfazer (Undo)
  const handleUndo = useCallback(() => {
    if (pastStack.length === 0) return;
    const previous = pastStack[pastStack.length - 1];
    const newPast = pastStack.slice(0, pastStack.length - 1);

    isUndoRedoActionRef.current = true;
    setFutureStack((f) => [
      {
        trimStart,
        trimEnd,
        canvasBrolls: JSON.parse(JSON.stringify(canvasBrolls)),
        selectedBrollId,
        aspectRatio,
        verticalMode,
        cropX,
        subtitleStyle,
        selectedFontName,
        primaryColor,
        highlightColor,
        subtitlePosition,
        subtitleFontSize,
        customSubtitleFontSize,
        enableEmojis,
      },
      ...f,
    ]);
    setPastStack(newPast);

    setTrimStart(previous.trimStart);
    setTrimEnd(previous.trimEnd);
    setCanvasBrolls(previous.canvasBrolls);
    setSelectedBrollId(previous.selectedBrollId);
    setAspectRatio(previous.aspectRatio);
    setVerticalMode(previous.verticalMode);
    setCropX(previous.cropX);
    setSubtitleStyle(previous.subtitleStyle);
    if (previous.selectedFontName) setSelectedFontName(previous.selectedFontName);
    if (previous.primaryColor) setPrimaryColor(previous.primaryColor);
    if (previous.highlightColor) setHighlightColor(previous.highlightColor);
    if (previous.subtitlePosition) setSubtitlePosition(previous.subtitlePosition);
    if (previous.subtitleFontSize) setSubtitleFontSize(previous.subtitleFontSize);
    if (typeof previous.customSubtitleFontSize === "number") setCustomSubtitleFontSize(previous.customSubtitleFontSize);
    if (typeof previous.enableEmojis === "boolean") setEnableEmojis(previous.enableEmojis);

    setTimeout(() => {
      isUndoRedoActionRef.current = false;
    }, 50);
  }, [
    pastStack,
    trimStart,
    trimEnd,
    canvasBrolls,
    selectedBrollId,
    aspectRatio,
    verticalMode,
    cropX,
    subtitleStyle,
    selectedFontName,
    primaryColor,
    highlightColor,
    subtitlePosition,
    subtitleFontSize,
    customSubtitleFontSize,
    enableEmojis,
  ]);

  // Função Refazer (Redo)
  const handleRedo = useCallback(() => {
    if (futureStack.length === 0) return;
    const next = futureStack[0];
    const newFuture = futureStack.slice(1);

    isUndoRedoActionRef.current = true;
    setPastStack((p) => [
      ...p,
      {
        trimStart,
        trimEnd,
        canvasBrolls: JSON.parse(JSON.stringify(canvasBrolls)),
        selectedBrollId,
        aspectRatio,
        verticalMode,
        cropX,
        subtitleStyle,
        selectedFontName,
        primaryColor,
        highlightColor,
        subtitlePosition,
        subtitleFontSize,
        customSubtitleFontSize,
        enableEmojis,
      },
    ]);
    setFutureStack(newFuture);

    setTrimStart(next.trimStart);
    setTrimEnd(next.trimEnd);
    setCanvasBrolls(next.canvasBrolls);
    setSelectedBrollId(next.selectedBrollId);
    setAspectRatio(next.aspectRatio);
    setVerticalMode(next.verticalMode);
    setCropX(next.cropX);
    setSubtitleStyle(next.subtitleStyle);
    if (next.selectedFontName) setSelectedFontName(next.selectedFontName);
    if (next.primaryColor) setPrimaryColor(next.primaryColor);
    if (next.highlightColor) setHighlightColor(next.highlightColor);
    if (next.subtitlePosition) setSubtitlePosition(next.subtitlePosition);
    if (next.subtitleFontSize) setSubtitleFontSize(next.subtitleFontSize);
    if (typeof next.customSubtitleFontSize === "number") setCustomSubtitleFontSize(next.customSubtitleFontSize);
    if (typeof next.enableEmojis === "boolean") setEnableEmojis(next.enableEmojis);

    setTimeout(() => {
      isUndoRedoActionRef.current = false;
    }, 50);
  }, [
    futureStack,
    trimStart,
    trimEnd,
    canvasBrolls,
    selectedBrollId,
    aspectRatio,
    verticalMode,
    cropX,
    subtitleStyle,
    selectedFontName,
    primaryColor,
    highlightColor,
    subtitlePosition,
    subtitleFontSize,
    customSubtitleFontSize,
    enableEmojis,
  ]);

  // Estados do Player & Safe Zones CapCut
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [zoomScale, setZoomScale] = useState<number>(1); // 1x, 1.5x, 2x
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState<number>(215);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const [rightAccordionOpen, setRightAccordionOpen] = useState<"inspector" | "hook" | "clone">("inspector");

  // Estados da Capa / Thumbnail
  const [thumbTitle, setThumbTitle] = useState(clip.title);
  const [titleColor, setTitleColor] = useState<"yellow" | "white" | "cyan">("yellow");
  const [capturedThumbUrl, setCapturedThumbUrl] = useState<string | null>(null);

  // Detecta gatilhos automáticos na fala do corte
  const suggestions = useMemo<BrollTriggerSuggestion[]>(() => {
    return detectBrollTriggers(clip.edit_decisions?.words, clip.start_seconds, clip.end_seconds);
  }, [clip.edit_decisions?.words, clip.start_seconds, clip.end_seconds]);

  // Sincroniza tempo atual do player
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekRelative = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  }, [duration]);

  // Atalhos de teclado (Espaço = Play/Pause, Setas = +/- 1s, Esc = Fechar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos se o usuário estiver digitando em um input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey || e.altKey) && e.code === "ArrowLeft") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey || e.altKey) && e.code === "ArrowRight") {
        e.preventDefault();
        handleRedo();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekRelative(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekRelative(1);
      } else if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekRelative, onClose, handleUndo, handleRedo]);

  // Redimensionamento interativo da Timeline por arrasto (drag)
  useEffect(() => {
    if (!isResizingTimeline) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newH = Math.max(120, Math.min(window.innerHeight * 0.6, window.innerHeight - e.clientY));
      setTimelineHeight(newH);
    };
    const handleMouseUp = () => {
      setIsResizingTimeline(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingTimeline]);

  // Redimensionamento interativo das seções laterais (Painel Esquerdo e Direito)
  useEffect(() => {
    if (!isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const maxW = Math.min(550, Math.floor(window.innerWidth * 0.45));
        const newW = Math.max(200, Math.min(maxW, e.clientX));
        setLeftWidth(newW);
      } else if (isResizingRight) {
        const maxW = Math.min(550, Math.floor(window.innerWidth * 0.45));
        const newW = Math.max(220, Math.min(maxW, window.innerWidth - e.clientX));
        setRightWidth(newW);
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeft) {
        setIsResizingLeft(false);
        try {
          localStorage.setItem("clip_editor_left_width", String(leftWidth));
        } catch {}
      }
      if (isResizingRight) {
        setIsResizingRight(false);
        try {
          localStorage.setItem("clip_editor_right_width", String(rightWidth));
        } catch {}
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight, leftWidth, rightWidth]);

  const setStartToCurrent = () => {
    if (!videoRef.current) return;
    const t = Math.min(videoRef.current.currentTime, trimEnd - 1);
    setTrimStart(Number(t.toFixed(1)));
  };

  const setEndToCurrent = () => {
    if (!videoRef.current) return;
    const t = Math.max(videoRef.current.currentTime, trimStart + 1);
    setTrimEnd(Number(t.toFixed(1)));
  };

  const playSelectedRange = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const jumpToTime = (t: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, t));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    videoRef.current.play();
    setIsPlaying(true);
  };

  // Interação na Timeline Multitrack
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTracksRef.current || !videoRef.current) return;
    const rect = timelineTracksRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = Number((pct * duration).toFixed(1));
    videoRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
  };

  // Adiciona B-Roll a partir de sugestão da IA
  const addFromSuggestion = (s: BrollTriggerSuggestion) => {
    recordHistory();
    const newId = "broll-" + Date.now();
    const newBroll: CanvasBroll = {
      id: newId,
      offsetSec: s.offsetSec,
      durationSec: s.durationSec,
      template: s.template,
      data: {
        title: s.suggestedTitle,
        value: s.suggestedValue,
        subtitle: s.suggestedSubtitle,
        color: s.suggestedColor,
        positionY: "top",
      },
    };
    setCanvasBrolls((prev) => [...prev, newBroll]);
    setSelectedBrollId(newId);
    jumpToTime(s.offsetSec);
  };

  // Adiciona B-Roll no segundo atual
  const addBrollAtCurrentTime = (template: CanvasBrollTemplate = "metric_counter") => {
    recordHistory();
    const offset = Number(currentTime.toFixed(1));
    const newId = "broll-" + Date.now();
    const newBroll: CanvasBroll = {
      id: newId,
      offsetSec: offset,
      durationSec: 3.0,
      template,
      data: {
        title: template === "growth_chart" ? "CRESCIMENTO" : template === "glass_alert" ? "ATENÇÃO" : "DESTAQUE VIRAL",
        value: template === "metric_counter" ? "+300%" : template === "growth_chart" ? "+450%" : "IMPORTANTE",
        subtitle: "Elemento de retenção CapCut",
        color: template === "growth_chart" ? "green" : "cyan",
        positionY: "top",
      },
    };
    setCanvasBrolls((prev) => [...prev, newBroll]);
    setSelectedBrollId(newId);
    jumpToTime(offset);
  };

  const removeBroll = (id: string) => {
    recordHistory();
    setCanvasBrolls((prev) => prev.filter((b) => b.id !== id));
    if (selectedBrollId === id) {
      setSelectedBrollId(null);
    }
  };

  const updateBroll = (id: string, partial: Partial<CanvasBroll>) => {
    recordHistory();
    setCanvasBrolls((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...partial, data: { ...b.data, ...(partial.data || {}) } } : b))
    );
  };

  const selectedBroll = useMemo(() => {
    return canvasBrolls.find((b) => b.id === selectedBrollId) || null;
  }, [canvasBrolls, selectedBrollId]);

  // Salvar B-Rolls no Banco de Dados
  const handleSaveBrolls = async () => {
    try {
      setIsSavingBrolls(true);
      await onSaveCanvasBrolls?.(clip.id, canvasBrolls);
      alert("B-Rolls Canvas salvos com sucesso!");
    } catch (err: any) {
      alert(`Falha ao salvar: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsSavingBrolls(false);
    }
  };

  // Salvar e Re-renderizar com Trimming, Formato, Enquadramento, Legendas e B-Rolls
  const handleSaveTrimAndBrolls = async () => {
    try {
      setIsSavingTrim(true);
      await onUpdateClipTime?.(clip.id, trimStart, trimEnd, canvasBrolls, {
        aspectRatio,
        verticalMode,
        cropX,
        subtitleStyle,
        customFontName: selectedFontName,
        primaryColor,
        highlightColor,
        subtitlePosition,
        subtitleFontSize,
        customSubtitleFontSize,
        enableEmojis,
        subtitles: {
          style: subtitleStyle,
          customFontName: selectedFontName,
          primaryColor,
          highlightColor,
          positionY: subtitlePosition,
          fontSize: subtitleFontSize,
          fontSizePx: customSubtitleFontSize,
          enableEmojis,
        },
      });
      onClose();
    } catch (err: any) {
      alert(`Falha ao solicitar ajuste: ${err?.message || "Tente novamente."}`);
    } finally {
      setIsSavingTrim(false);
    }
  };

  // Cálculo da família tipográfica ativa para o CSS da legenda
  const activeSystemFont = useMemo(() => {
    return (
      SYSTEM_FONTS.find(
        (f) =>
          f.name.toLowerCase() === selectedFontName.toLowerCase() ||
          f.fontFamily.toLowerCase() === selectedFontName.toLowerCase() ||
          selectedFontName.toLowerCase().includes(f.fontFamily.toLowerCase())
      ) || SYSTEM_FONTS.find((f) => f.id === "poppins") || SYSTEM_FONTS[0]
    );
  }, [selectedFontName]);

  // Cálculo em tempo real da legenda e palavra ativa sincronizada no player
  const activeSubtitleData = useMemo(() => {
    const words = clip.edit_decisions?.words;
    if (!words || words.length === 0) {
      // Mock dinâmico animado com base no tempo para preview instantâneo quando não houver palavras gravadas
      const cycle = Math.floor(currentTime * 1.2) % 3;
      const mockPhrases = [
        ["DOMINE", "O SEGREDO", "DO ALGORITMO 🔥"],
        ["ESTILO", "VIRAL", "DE ALTA RETENÇÃO ⚡"],
        ["LEGENDAS", "QUE PRENDEM", "A ATENÇÃO ✨"],
      ];
      const phrase = mockPhrases[cycle] || mockPhrases[0];
      const activeIndex = Math.floor((currentTime * 2.8) % phrase.length);
      return {
        words: phrase.map((w, idx) => ({ text: w, isActive: idx === activeIndex })),
        isLiveMock: true,
      };
    }

    // Normaliza timestamps para o clipe
    const baseOffset = clip.start_seconds || 0;
    const relWords = words.map((w: any) => {
      const start = (w.s ?? w.start) >= baseOffset ? (w.s ?? w.start) - baseOffset : (w.s ?? w.start);
      const end = (w.e ?? w.end) >= baseOffset ? (w.e ?? w.end) - baseOffset : (w.e ?? w.end);
      return {
        text: ((w.w ?? w.word) || "").toUpperCase(),
        start,
        end,
      };
    });

    // Encontra a palavra falada no currentTime
    const activeIdx = relWords.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
    if (activeIdx !== -1) {
      // Agrupa em janelas de 3 palavras em torno da palavra ativa
      const startGroup = Math.max(0, activeIdx - (activeIdx % 3));
      const endGroup = Math.min(relWords.length, startGroup + 3);
      const group = relWords.slice(startGroup, endGroup).map((w, i) => ({
        text: w.text,
        isActive: startGroup + i === activeIdx,
      }));
      return { words: group, isLiveMock: false };
    }

    // Se estiver entre palavras, pega o grupo mais recente
    const nearestIdx = relWords.findIndex((w) => w.start > currentTime);
    if (nearestIdx > 0 && currentTime - relWords[nearestIdx - 1].end < 1.2) {
      const startGroup = Math.max(0, (nearestIdx - 1) - ((nearestIdx - 1) % 3));
      const endGroup = Math.min(relWords.length, startGroup + 3);
      return {
        words: relWords.slice(startGroup, endGroup).map((w) => ({ text: w.text, isActive: false })),
        isLiveMock: false,
      };
    }

    return null;
  }, [clip.edit_decisions, clip.start_seconds, currentTime]);

  // Estado do Modal de Clonagem de Estilo (Clone Studio completo com DNA de edição)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  // Captura um frame do vídeo para criar a thumbnail estilizada
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isWidescreen = aspectRatio === "16:9";
    const isSquare = aspectRatio === "1:1";
    const targetW = isWidescreen ? 1920 : 1080;
    const targetH = isWidescreen ? 1080 : isSquare ? 1080 : 1920;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.drawImage(video, 0, 0, targetW, targetH);

    const grad = ctx.createLinearGradient(0, 0, 0, targetH);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
    grad.addColorStop(0.25, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);

    const text = thumbTitle.toUpperCase();
    ctx.font = isWidescreen ? "900 58px Arial, sans-serif" : "900 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let fillHex = "#FFE600";
    if (titleColor === "white") fillHex = "#FFFFFF";
    if (titleColor === "cyan") fillHex = "#00F0FF";

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 14;
    ctx.lineJoin = "round";

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (testLine.length > (isWidescreen ? 36 : 22)) {
        lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const centerX = targetW / 2;
    const startY = isWidescreen ? 240 : 320;
    lines.forEach((line, idx) => {
      const y = startY + idx * 82;
      ctx.strokeText(line, centerX, y);
      ctx.fillStyle = fillHex;
      ctx.fillText(line, centerX, y);
    });

    ctx.fillStyle = "#6366F1";
    ctx.beginPath();
    ctx.roundRect(centerX - 140, isWidescreen ? 110 : 168, 280, 56, 28);
    ctx.fill();

    ctx.font = "800 24px Arial, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("★ TOP VIRAL", centerX, isWidescreen ? 138 : 204);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedThumbUrl(dataUrl);
  };

  const downloadThumbnail = () => {
    if (!capturedThumbUrl) return;
    const a = document.createElement("a");
    a.href = capturedThumbUrl;
    a.download = `capa-corte-${clip.position}.jpg`;
    a.click();
  };

  // Formatação de Timecode (00:14.2)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${String(mins).padStart(2, "0")}:${secs.padStart(4, "0")}`;
  };

  // Gera marcações da régua de tempo
  const rulerMarks = useMemo(() => {
    const step = duration > 60 ? 5 : duration > 25 ? 2 : 1;
    const marks: number[] = [];
    for (let t = 0; t <= duration; t += step) {
      marks.push(t);
    }
    return marks;
  }, [duration]);

  return (
    <div
      data-editor-modal="true"
      className="clip-editor-modal"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#0B0D13",
        color: "#F3F4F6",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* 1. HEADER DO ESTÚDIO COMPACTO (48px) */}
      <header className="h-12 bg-[#11131B] border-b border-[#212635] flex items-center justify-between px-3 gap-3 z-10 shrink-0">
        {/* Esquerda: Voltar e Identificação do Corte */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#1A1D27] hover:bg-[#252A39] border border-[#2B3142] text-gray-200 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Voltar para a lista de cortes (Esc)"
          >
            <ArrowLeft size={14} /> Voltar
          </button>

          <div className="h-4 w-px bg-[#2B3142]" />

          <div className="flex items-center gap-2 truncate">
            <span className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-1.5 py-0.5 rounded text-[11px] font-extrabold tracking-wider shrink-0">
              #{clip.position}
            </span>
            <span className="text-xs font-bold text-gray-200 truncate max-w-[260px] md:max-w-[400px]">
              {clip.title}
            </span>
          </div>
        </div>

        {/* Centro: Timecode Digital Monospace & Toggles Pequenos */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-[#08090D] border border-[#232733] px-2.5 py-1 rounded-md font-mono text-xs text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5 shadow-inner">
            <span className="text-white">{formatTimecode(currentTime)}</span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{formatTimecode(duration)}</span>
          </div>

          {/* Botões de Desfazer e Refazer (Undo/Redo) */}
          <div className="flex items-center gap-1 bg-[#151822] border border-[#232838] p-0.5 rounded-md">
            <button
              type="button"
              onClick={handleUndo}
              disabled={pastStack.length === 0}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
                pastStack.length > 0
                  ? "text-gray-200 hover:text-white hover:bg-[#202536] cursor-pointer"
                  : "text-gray-600 cursor-not-allowed"
              }`}
              title="Desfazer alteração (Ctrl+Z ou Ctrl+←)"
            >
              <Undo size={13} />
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={futureStack.length === 0}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
                futureStack.length > 0
                  ? "text-gray-200 hover:text-white hover:bg-[#202536] cursor-pointer"
                  : "text-gray-600 cursor-not-allowed"
              }`}
              title="Refazer alteração (Ctrl+Y ou Ctrl+→)"
            >
              <Redo size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
              showSafeZones
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/40"
                : "bg-[#181B26] text-gray-400 border-[#2B3142] hover:text-gray-300"
            }`}
            title="Alternar Safe Zones de TikTok / Reels / Shorts"
          >
            {showSafeZones ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
            Safe Zones
          </button>

          <button
            type="button"
            onClick={() => setEnableBrollOverlay(!enableBrollOverlay)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
              enableBrollOverlay
                ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                : "bg-[#181B26] text-gray-400 border-[#2B3142] hover:text-gray-300"
            }`}
            title="Ativar/Desativar Prévia de Motion Graphics Canvas"
          >
            <SparklesIcon size={12} /> Overlays
          </button>
        </div>

        {/* Direita: Ações de Salvar e Fechar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCloneModalOpen(true)}
            className="bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/50 text-purple-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Abrir estúdio de clonagem de edição com IA para este corte"
          >
            <SparklesIcon size={13} /> Clonar Estilo
          </button>

          <button
            type="button"
            onClick={handleSaveBrolls}
            disabled={isSavingBrolls}
            className="bg-[#1A1D27] hover:bg-[#252A39] border border-[#2B3142] text-gray-300 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            title="Salvar camadas de B-Roll configuradas"
          >
            <Save size={13} /> {isSavingBrolls ? "..." : "Salvar"}
          </button>

          <button
            type="button"
            onClick={handleSaveTrimAndBrolls}
            disabled={isSavingTrim}
            className="bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-60"
            title="Re-renderizar vídeo final com corte e overlays"
          >
            <SparklesIcon size={13} /> {isSavingTrim ? "Renderizando..." : "Re-renderizar"}
          </button>

          {/* Botão de Exportação com Dropdown de Formatos (MP4, SRT, XML, EDL, Capa) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="bg-[#1A1D27] hover:bg-[#252A39] border border-cyan-500/40 text-cyan-400 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Exportar mídias, legendas ou timeline do corte"
            >
              <DownloadIcon size={13} />
              <span>Exportar</span>
              <ChevronDown size={12} className={`transition-transform duration-150 ${isExportMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-56 bg-[#161924] border border-[#2B3145] rounded-lg shadow-2xl z-50 p-1.5 flex flex-col gap-1"
                onClick={() => setIsExportMenuOpen(false)}
              >
                {videoSrc && (
                  <a
                    href={videoSrc}
                    download={`corte-${String(clip.position).padStart(2, "0")}.${clip.file_path?.endsWith(".mov") ? "mov" : "mp4"}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-[#202538] rounded-md transition-colors"
                  >
                    <Film size={13} className="text-cyan-400" />
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {clip.file_path?.endsWith(".mov") ? "Baixar Vídeo ProRes (MOV)" : "Baixar Vídeo (MP4)"}
                      </span>
                      <span className="text-[10px] text-gray-400">Vídeo pronto renderizado</span>
                    </div>
                  </a>
                )}

                <a
                  href={`/api/jobs/${clip.job_id}/export?format=srt&clipId=${clip.id}`}
                  download={`legendas-corte-${String(clip.position).padStart(2, "0")}.srt`}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-[#202538] rounded-md transition-colors"
                >
                  <Subtitles size={13} className="text-yellow-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Legendas SRT</span>
                    <span className="text-[10px] text-gray-400">Timestamps palavra por palavra</span>
                  </div>
                </a>

                <a
                  href={`/api/jobs/${clip.job_id}/export?format=xml`}
                  download={`projeto_premiere_resolve.xml`}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-[#202538] rounded-md transition-colors"
                >
                  <Monitor size={13} className="text-indigo-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Timeline XML (FCP7)</span>
                    <span className="text-[10px] text-gray-400">Premiere &amp; DaVinci Resolve</span>
                  </div>
                </a>

                <a
                  href={`/api/jobs/${clip.job_id}/export?format=edl`}
                  download={`timeline.edl`}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-200 hover:text-white hover:bg-[#202538] rounded-md transition-colors"
                >
                  <SlidersHorizontal size={13} className="text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Timeline EDL</span>
                    <span className="text-[10px] text-gray-400">Padrão CMX3600</span>
                  </div>
                </a>

                <div className="h-px bg-[#262B3B] my-0.5" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExportMenuOpen(false);
                    downloadThumbnail();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-gray-200 hover:text-white hover:bg-[#202538] rounded-md transition-colors cursor-pointer"
                >
                  <Camera size={13} className="text-rose-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Baixar Capa HD (JPG)</span>
                    <span className="text-[10px] text-gray-400">Thumbnail com visual viral</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
            title="Fechar Estúdio (Esc)"
          >
            <XIcon size={17} />
          </button>
        </div>
      </header>

      {/* 2. ÁREA DE TRABALHO PRINCIPAL (3 SEÇÕES COM DIVISORES REDIMENSIONÁVEIS VIA MOUSE) */}
      <div className="flex-1 flex overflow-hidden bg-[#0D0F16] relative select-none">
        {/* COLUNA ESQUERDA: BIBLIOTECA DE RECURSOS E ABAS */}
        <aside
          style={{ width: isFocusMode ? 0 : `${leftWidth}px` }}
          className={`bg-[#13161F] border-r border-[#212634] flex flex-col overflow-hidden shrink-0 transition-[width] duration-75 ${
            isFocusMode ? "invisible opacity-0" : "visible opacity-100"
          }`}
        >
          {/* Navegação por Abas Verticais/Pills estilo CapCut */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #212634",
              background: "#10121A",
              padding: "0.4rem",
              gap: "0.3rem",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("brolls")}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "brolls" ? "#1E2230" : "transparent",
                color: activeTab === "brolls" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <SparklesIcon size={15} />
              <span>B-Rolls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trim")}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "trim" ? "#1E2230" : "transparent",
                color: activeTab === "trim" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Scissors size={15} />
              <span>Corte</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("thumbnail");
                setTimeout(captureFrame, 150);
              }}
              style={{
                flex: 1,
                padding: "0.45rem 0.3rem",
                borderRadius: "6px",
                fontSize: "0.76rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "thumbnail" ? "#1E2230" : "transparent",
                color: activeTab === "thumbnail" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Camera size={15} />
              <span>Capa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("formats")}
              style={{
                flex: 1,
                padding: "0.45rem 0.2rem",
                borderRadius: "6px",
                fontSize: "0.72rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "formats" ? "#1E2230" : "transparent",
                color: activeTab === "formats" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Crop size={14} />
              <span>Formatos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("crop")}
              style={{
                flex: 1,
                padding: "0.45rem 0.2rem",
                borderRadius: "6px",
                fontSize: "0.72rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "crop" ? "#1E2230" : "transparent",
                color: activeTab === "crop" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Ângulo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("subtitles")}
              style={{
                flex: 1,
                padding: "0.45rem 0.2rem",
                borderRadius: "6px",
                fontSize: "0.72rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeTab === "subtitles" ? "#1E2230" : "transparent",
                color: activeTab === "subtitles" ? "#00F0FF" : "#94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Subtitles size={14} />
              <span>Legenda</span>
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
            {activeTab === "brolls" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {/* 1. SUGESTÕES DA IA NO TOPO */}
                {suggestions.length > 0 && (
                  <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-400/30 shadow-sm">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                      <Lightbulb size={14} className="text-amber-400" />
                      Sugestões Identificadas pela IA ({suggestions.length}):
                    </span>
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {suggestions.map((s, idx) => {
                        const isAdded = canvasBrolls.some((b) => Math.abs(b.offsetSec - s.offsetSec) < 0.5);
                        return (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-[#0E1017] p-2 rounded border border-[#212634] text-xs"
                          >
                            <div className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[170px]">
                              <strong className="text-cyan-400 font-mono">{s.offsetSec}s</strong>: {s.suggestedTitle}
                            </div>
                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => addFromSuggestion(s)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                isAdded ? "bg-gray-800 text-gray-500 cursor-default" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                              }`}
                            >
                              {isAdded ? "Ativo" : "+ Add"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. INSERIR MANUALMENTE NO PLAYHEAD */}
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.88rem", color: "#FFF", fontWeight: 700 }}>
                    Inserir Motion no Playhead
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Adicione animações de retenção no segundo exato ({currentTime.toFixed(1)}s):
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("metric_counter")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#00F0FF",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Contador (+300%)
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("growth_chart")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#10B981",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Gráfico de Alta
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("glass_alert")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#F59E0B",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Alerta Glass
                  </button>

                  <button
                    type="button"
                    onClick={() => addBrollAtCurrentTime("viral_tag")}
                    style={{
                      padding: "0.5rem 0.4rem",
                      borderRadius: "6px",
                      background: "#1A1D27",
                      border: "1px solid #2B3042",
                      color: "#C084FC",
                      cursor: "pointer",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    + Tag Viral
                  </button>
                </div>

                {/* Lista de B-Rolls Adicionados */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8" }}>
                      Camadas na Timeline ({canvasBrolls.length}):
                    </span>
                  </div>

                  {canvasBrolls.length === 0 ? (
                    <div
                      style={{
                        padding: "1rem",
                        textAlign: "center",
                        background: "#161924",
                        borderRadius: "8px",
                        border: "1px dashed #2A3042",
                        color: "#64748B",
                        fontSize: "0.75rem",
                      }}
                    >
                      Nenhum B-Roll adicionado ainda.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
                      {canvasBrolls.map((b) => {
                        const isSelected = b.id === selectedBrollId;
                        return (
                          <div
                            key={b.id}
                            onClick={() => {
                              setSelectedBrollId(b.id);
                              jumpToTime(b.offsetSec);
                            }}
                            style={{
                              background: isSelected ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                              border: `1px solid ${isSelected ? "#00F0FF" : "#262B3B"}`,
                              borderRadius: "6px",
                              padding: "0.5rem",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <span style={{ background: "#00F0FF", color: "#000", fontSize: "0.65rem", padding: "0.08rem 0.3rem", borderRadius: "3px", fontWeight: 800 }}>
                                  {b.offsetSec.toFixed(1)}s
                                </span>
                                <strong style={{ fontSize: "0.78rem", color: "#FFF" }}>{b.data.title || "B-Roll"}</strong>
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Duração: {b.durationSec}s</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBroll(b.id);
                              }}
                              style={{
                                background: "rgba(239, 68, 68, 0.2)",
                                color: "#EF4444",
                                border: "none",
                                borderRadius: "4px",
                                padding: "0.25rem 0.35rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                              }}
                              title="Remover B-Roll"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: AJUSTE DE CORTE (TRIMMING) */}
            {activeTab === "trim" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Ajuste Fino Milimétrico
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Corte início e fim com precisão para ritmo perfeito de retenção:
                  </p>
                </div>

                <div style={{ background: "#171A25", padding: "0.75rem", borderRadius: "8px", border: "1px solid #262B3B" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.78rem" }}>Início: <strong style={{ color: "#00F0FF" }}>{trimStart.toFixed(1)}s</strong></span>
                    <button
                      type="button"
                      onClick={setStartToCurrent}
                      style={{
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: "#262C3A",
                        border: "none",
                        color: "#FFF",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                      }}
                    >
                      Marcar no Player
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={trimEnd - 1}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#6366F1" }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.8rem", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.78rem" }}>Fim: <strong style={{ color: "#00F0FF" }}>{trimEnd.toFixed(1)}s</strong></span>
                    <button
                      type="button"
                      onClick={setEndToCurrent}
                      style={{
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: "#262C3A",
                        border: "none",
                        color: "#FFF",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                      }}
                    >
                      Marcar no Player
                    </button>
                  </div>
                  <input
                    type="range"
                    min={trimStart + 1}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#6366F1" }}
                  />

                  <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.76rem", color: "#A855F7", fontWeight: 700 }}>
                    Nova Duração: {(trimEnd - trimStart).toFixed(1)} segundos
                  </div>
                </div>

                <button
                  type="button"
                  onClick={playSelectedRange}
                  style={{
                    background: "#1E2333",
                    border: "1px solid #31384E",
                    color: "#FFF",
                    padding: "0.5rem",
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
                  <Play size={14} /> Testar Trecho Recortado
                </button>
              </div>
            )}

            {/* ABA: CAPA / THUMBNAIL */}
            {activeTab === "thumbnail" && (
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
                    onChange={(e) => setThumbTitle(e.target.value)}
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
                      onClick={() => setTitleColor("yellow")}
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
                      onClick={() => setTitleColor("cyan")}
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
                      onClick={() => setTitleColor("white")}
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
                    onClick={captureFrame}
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
                    onClick={downloadThumbnail}
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

                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}

            {/* ABA: FORMATOS */}
            {/* ABA: FORMATOS */}
            {activeTab === "formats" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#FFF" }}>
                    Proporção &amp; Destinos
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#94A3B8" }}>
                    Escolha a proporção ideal para distribuição nas redes:
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    onClick={() => {
                      userChangedAspectRef.current = true;
                      recordHistory({ aspectRatio: "9:16" });
                      setAspectRatio("9:16");
                    }}
                    style={{
                      padding: "0.65rem",
                      background: aspectRatio === "9:16" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                      borderRadius: "8px",
                      border: `1px solid ${aspectRatio === "9:16" ? "#00F0FF" : "#2B3042"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: aspectRatio === "9:16" ? "#00F0FF" : "#FFF", fontWeight: 700, fontSize: "0.82rem" }}>
                        <Smartphone size={15} /> 9:16 Vertical
                      </div>
                      {aspectRatio === "9:16" && <span style={{ fontSize: "0.68rem", background: "#00F0FF", color: "#000", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 800 }}>Ativo</span>}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>TikTok, Instagram Reels, YouTube Shorts</span>
                  </div>

                  <div
                    onClick={() => {
                      userChangedAspectRef.current = true;
                      recordHistory({ aspectRatio: "1:1" });
                      setAspectRatio("1:1");
                    }}
                    style={{
                      padding: "0.65rem",
                      background: aspectRatio === "1:1" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                      borderRadius: "8px",
                      border: `1px solid ${aspectRatio === "1:1" ? "#00F0FF" : "#2B3042"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: aspectRatio === "1:1" ? "#00F0FF" : "#FFF", fontWeight: 700, fontSize: "0.82rem" }}>
                        <Square size={15} /> 1:1 Quadrado
                      </div>
                      {aspectRatio === "1:1" && <span style={{ fontSize: "0.68rem", background: "#00F0FF", color: "#000", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 800 }}>Ativo</span>}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>Feed Instagram, LinkedIn, Carrosséis</span>
                  </div>

                  <div
                    onClick={() => {
                      userChangedAspectRef.current = true;
                      recordHistory({ aspectRatio: "16:9" });
                      setAspectRatio("16:9");
                    }}
                    style={{
                      padding: "0.65rem",
                      background: aspectRatio === "16:9" ? "rgba(0, 240, 255, 0.12)" : "#171A25",
                      borderRadius: "8px",
                      border: `1px solid ${aspectRatio === "16:9" ? "#00F0FF" : "#2B3042"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: aspectRatio === "16:9" ? "#00F0FF" : "#FFF", fontWeight: 700, fontSize: "0.82rem" }}>
                        <Monitor size={15} /> 16:9 Widescreen
                      </div>
                      {aspectRatio === "16:9" && <span style={{ fontSize: "0.68rem", background: "#00F0FF", color: "#000", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 800 }}>Ativo</span>}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block", marginTop: "0.2rem" }}>YouTube Padrão, Desktop, TV</span>
                  </div>
                </div>

                {aspectRatio === "9:16" && (
                  <div style={{ background: "#151822", padding: "0.75rem", borderRadius: "8px", border: "1px solid #232838", marginTop: "0.4rem" }}>
                    <span style={{ fontSize: "0.76rem", color: "#94A3B8", display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
                      Modo de Preenchimento Vertical:
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          recordHistory({ verticalMode: "crop" });
                          setVerticalMode("crop");
                        }}
                        style={{
                          padding: "0.45rem",
                          borderRadius: "6px",
                          border: verticalMode === "crop" ? "1px solid #00F0FF" : "1px solid #2A3042",
                          background: verticalMode === "crop" ? "rgba(0,240,255,0.15)" : "#1A1D27",
                          color: verticalMode === "crop" ? "#00F0FF" : "#94A3B8",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Recorte 9:16
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          recordHistory({ verticalMode: "blur" });
                          setVerticalMode("blur");
                        }}
                        style={{
                          padding: "0.45rem",
                          borderRadius: "6px",
                          border: verticalMode === "blur" ? "1px solid #00F0FF" : "1px solid #2A3042",
                          background: verticalMode === "blur" ? "rgba(0,240,255,0.15)" : "#1A1D27",
                          color: verticalMode === "blur" ? "#00F0FF" : "#94A3B8",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Fundo Desfocado (Blur)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA: ÂNGULO / ENQUADRAMENTO HORIZONTAL (CROP X) */}
            {activeTab === "crop" && (
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
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      recordHistory({ cropX: val });
                      setCropX(val);
                    }}
                    style={{ width: "100%", accentColor: "#00F0FF", cursor: "pointer" }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        recordHistory({ cropX: 0.2 });
                        setCropX(0.2);
                      }}
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
                      onClick={() => {
                        recordHistory({ cropX: 0.5 });
                        setCropX(0.5);
                      }}
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
                      onClick={() => {
                        recordHistory({ cropX: 0.8 });
                        setCropX(0.8);
                      }}
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
            )}

            {/* ABA: ESTILOS E FONTES DE LEGENDA DO SISTEMA */}
            {activeTab === "subtitles" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Cabeçalho da aba */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 0.15rem", fontSize: "0.9rem", color: "#FFF", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Type size={16} style={{ color: "#00F0FF" }} />
                      Tipografia &amp; Legendas Virais
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#94A3B8" }}>
                      Personalize fontes do sistema, cores de destaque e animações:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubtitlePreview((prev) => !prev)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      background: showSubtitlePreview ? "rgba(0, 240, 255, 0.15)" : "#1E2230",
                      border: `1px solid ${showSubtitlePreview ? "#00F0FF" : "#333A4D"}`,
                      color: showSubtitlePreview ? "#00F0FF" : "#94A3B8",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    title="Ativar/desativar prévia da legenda sobre o vídeo"
                  >
                    {showSubtitlePreview ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
                    {showSubtitlePreview ? "Prévia ON" : "Prévia OFF"}
                  </button>
                </div>

                {/* 1. SELETOR DE FONTES DO SISTEMA (COM DESTAQUE PARA POPPINS BOLD) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E2E8F0" }}>
                      Fonte do Sistema:
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#00F0FF", fontWeight: 700 }}>
                      {selectedFontName}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.45rem",
                      maxHeight: "220px",
                      overflowY: "auto",
                      paddingRight: "2px",
                    }}
                  >
                    {SYSTEM_FONTS.map((font) => {
                      const isSelected =
                        selectedFontName.toLowerCase() === font.name.toLowerCase() ||
                        selectedFontName.toLowerCase() === font.fontFamily.toLowerCase() ||
                        selectedFontName.toLowerCase().includes(font.fontFamily.toLowerCase());

                      const isPoppins = font.id === "poppins";

                      return (
                        <div
                          key={font.id}
                          onClick={() => {
                            recordHistory({ selectedFontName: font.name });
                            setSelectedFontName(font.name);
                          }}
                          style={{
                            padding: "0.5rem 0.6rem",
                            borderRadius: "8px",
                            border: isSelected
                              ? "2px solid #00F0FF"
                              : isPoppins
                              ? "1px solid rgba(0, 240, 255, 0.4)"
                              : "1px solid #282E40",
                            background: isSelected
                              ? "rgba(0, 240, 255, 0.16)"
                              : isPoppins
                              ? "rgba(0, 240, 255, 0.05)"
                              : "#151824",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.2rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span
                              style={{
                                fontFamily: `'${font.fontFamily}', sans-serif`,
                                fontSize: "0.86rem",
                                fontWeight: 800,
                                color: isSelected ? "#00F0FF" : "#FFF",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {font.name}
                            </span>
                            {isSelected && (
                              <Check size={12} style={{ color: "#00F0FF", flexShrink: 0 }} />
                            )}
                          </div>
                          <span style={{ fontSize: "0.64rem", color: "#64748B" }}>
                            {font.category}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. ESTILO DE ANIMAÇÃO VIRAL */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E2E8F0" }}>
                    Animação &amp; Estilo do Corte:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                    {[
                      { id: "hormozi", name: "Alex Hormozi", desc: "Caixa alta amarela/verde vibrante" },
                      { id: "beast", name: "MrBeast Impact", desc: "Destaque neon e alto impacto" },
                      { id: "apple", name: "Apple Minimal", desc: "Clean moderno e discreto" },
                      { id: "minimal", name: "Legenda Clássica", desc: "Texto sutil com fundo suave" },
                    ].map((sub) => {
                      const isSelected = subtitleStyle === sub.id;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => {
                            recordHistory({ subtitleStyle: sub.id as SubtitleStyle });
                            setSubtitleStyle(sub.id as SubtitleStyle);
                          }}
                          style={{
                            padding: "0.5rem 0.6rem",
                            background: isSelected ? "rgba(0, 240, 255, 0.12)" : "#151824",
                            borderRadius: "8px",
                            border: `1px solid ${isSelected ? "#00F0FF" : "#282E40"}`,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: "0.78rem", color: isSelected ? "#00F0FF" : "#FFF" }}>
                              {sub.name}
                            </strong>
                          </div>
                          <span style={{ fontSize: "0.64rem", color: "#64748B", display: "block", marginTop: "0.15rem" }}>
                            {sub.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. CORES PERSONALIZADAS: TEXTO BASE & DESTAQUE KARAOKE */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", background: "#151824", padding: "0.75rem", borderRadius: "8px", border: "1px solid #242938" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Palette size={14} style={{ color: "#00F0FF" }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#E2E8F0" }}>
                      Paleta de Cores da Legenda:
                    </span>
                  </div>

                  {/* Cor Primária (Texto Falado Padrão) */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Cor do Texto:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {[
                        { hex: "#FFFFFF", name: "Branco" },
                        { hex: "#FACC15", name: "Amarelo" },
                        { hex: "#00F0FF", name: "Ciano" },
                        { hex: "#10B981", name: "Verde" },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            recordHistory({ primaryColor: c.hex });
                            setPrimaryColor(c.hex);
                          }}
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: c.hex,
                            border: primaryColor === c.hex ? "2px solid #00F0FF" : "1px solid #475569",
                            cursor: "pointer",
                            transform: primaryColor === c.hex ? "scale(1.2)" : "scale(1)",
                            transition: "all 0.15s ease",
                          }}
                          title={c.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => {
                          recordHistory({ primaryColor: e.target.value });
                          setPrimaryColor(e.target.value);
                        }}
                        style={{
                          width: "22px",
                          height: "22px",
                          padding: 0,
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          background: "transparent",
                        }}
                        title="Cor personalizada de texto"
                      />
                    </div>
                  </div>

                  {/* Cor de Destaque / Karaoke (Palavra Ativa falada) */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Destaque (Karaoke):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {[
                        { hex: "#FACC15", name: "Amarelo Vibrante" },
                        { hex: "#10B981", name: "Verde Neon" },
                        { hex: "#00F0FF", name: "Ciano Elétrico" },
                        { hex: "#FF007A", name: "Magenta" },
                        { hex: "#FB923C", name: "Laranja" },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            recordHistory({ highlightColor: c.hex });
                            setHighlightColor(c.hex);
                          }}
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: c.hex,
                            border: highlightColor === c.hex ? "2px solid #FFF" : "1px solid #475569",
                            cursor: "pointer",
                            transform: highlightColor === c.hex ? "scale(1.2)" : "scale(1)",
                            transition: "all 0.15s ease",
                          }}
                          title={c.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={highlightColor}
                        onChange={(e) => {
                          recordHistory({ highlightColor: e.target.value });
                          setHighlightColor(e.target.value);
                        }}
                        style={{
                          width: "22px",
                          height: "22px",
                          padding: 0,
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          background: "transparent",
                        }}
                        title="Cor personalizada de destaque"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. POSIÇÃO VERTICAL & TAMANHO DA FONTE */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "#94A3B8", display: "block", marginBottom: "0.25rem" }}>
                      Posição Vertical:
                    </label>
                    <select
                      value={subtitlePosition}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        recordHistory({ subtitlePosition: val });
                        setSubtitlePosition(val);
                      }}
                      style={{
                        width: "100%",
                        background: "#151824",
                        color: "#E2E8F0",
                        border: "1px solid #282E40",
                        borderRadius: "6px",
                        padding: "0.35rem 0.5rem",
                        fontSize: "0.74rem",
                        cursor: "pointer",
                      }}
                    >
                      <option value="bottom">Base (Safe Zone)</option>
                      <option value="center-bottom">Centro-Inferior</option>
                      <option value="center">Centro da Tela</option>
                    </select>
                  </div>

                  <div style={{ background: "#10121B", border: "1px solid #242938", borderRadius: "8px", padding: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <label style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 600 }}>
                        Tamanho da Fonte das Legendas:
                      </label>
                      <span style={{ fontSize: "0.72rem", color: "#00F0FF", fontWeight: 700, fontFamily: "monospace" }}>
                        {customSubtitleFontSize}px
                      </span>
                    </div>

                    {/* Presets Rápidos */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.3rem", marginBottom: "0.55rem" }}>
                      {[
                        { label: "Pequena", size: "small", px: 20 },
                        { label: "Média", size: "medium", px: 24 },
                        { label: "Grande", size: "large", px: 28 },
                        { label: "Extra", size: "extra", px: 36 },
                      ].map((item) => {
                        const isSelected = subtitleFontSize === item.size || customSubtitleFontSize === item.px;
                        return (
                          <button
                            key={item.size}
                            type="button"
                            onClick={() => {
                              recordHistory({ subtitleFontSize: item.size as any, customSubtitleFontSize: item.px });
                              setSubtitleFontSize(item.size as any);
                              setCustomSubtitleFontSize(item.px);
                            }}
                            style={{
                              padding: "0.25rem 0.2rem",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: isSelected ? 700 : 500,
                              background: isSelected ? "#00F0FF20" : "#181C28",
                              color: isSelected ? "#00F0FF" : "#94A3B8",
                              border: isSelected ? "1px solid #00F0FF" : "1px solid #282E40",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Slider Contínuo + Botões de Ajuste Fino (- / +) */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(14, customSubtitleFontSize - 2);
                          const nextPreset = nextVal <= 21 ? "small" : nextVal <= 26 ? "medium" : nextVal <= 32 ? "large" : "extra";
                          recordHistory({ customSubtitleFontSize: nextVal, subtitleFontSize: nextPreset });
                          setCustomSubtitleFontSize(nextVal);
                          setSubtitleFontSize(nextPreset);
                        }}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          background: "#1C202E",
                          border: "1px solid #2A3144",
                          color: "#E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                        title="Diminuir fonte (-2px)"
                      >
                        -
                      </button>

                      <input
                        type="range"
                        min="14"
                        max="54"
                        step="1"
                        value={customSubtitleFontSize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const nextPreset = val <= 21 ? "small" : val <= 26 ? "medium" : val <= 32 ? "large" : "extra";
                          setCustomSubtitleFontSize(val);
                          setSubtitleFontSize(nextPreset);
                        }}
                        onMouseUp={() => {
                          recordHistory({ customSubtitleFontSize, subtitleFontSize });
                        }}
                        onTouchEnd={() => {
                          recordHistory({ customSubtitleFontSize, subtitleFontSize });
                        }}
                        style={{
                          flex: 1,
                          accentColor: "#00F0FF",
                          cursor: "pointer",
                          height: "4px",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.min(54, customSubtitleFontSize + 2);
                          const nextPreset = nextVal <= 21 ? "small" : nextVal <= 26 ? "medium" : nextVal <= 32 ? "large" : "extra";
                          recordHistory({ customSubtitleFontSize: nextVal, subtitleFontSize: nextPreset });
                          setCustomSubtitleFontSize(nextVal);
                          setSubtitleFontSize(nextPreset);
                        }}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          background: "#1C202E",
                          border: "1px solid #2A3144",
                          color: "#E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                        title="Aumentar fonte (+2px)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. EMOJIS CONTEXTUAIS AUTOMÁTICOS */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "#151824",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #282E40",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableEmojis}
                    onChange={(e) => {
                      recordHistory({ enableEmojis: e.target.checked });
                      setEnableEmojis(e.target.checked);
                    }}
                    style={{ width: "1rem", height: "1rem", accentColor: "#00F0FF", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.74rem", color: "#E2E8F0" }}>
                    Injetar Emojis Automáticos contextuais na fala (🔥, 💰, 🚀, 💡)
                  </span>
                </label>
              </div>
            )}
          </div>
        </aside>

        {/* DIVISOR REDIMENSIONÁVEL ESQUERDO (segurar com o mouse para deixar mais fino ou mais grosso) */}
        {!isFocusMode && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingLeft(true);
            }}
            onDoubleClick={() => {
              setLeftWidth(300);
              try { localStorage.setItem("clip_editor_left_width", "300"); } catch {}
            }}
            className="w-2.5 hover:w-3.5 -mx-1.5 z-40 cursor-col-resize select-none flex items-center justify-center group transition-colors hover:bg-cyan-500/40 active:bg-cyan-400 bg-transparent shrink-0"
            title="Arraste para redimensionar a seção esquerda (Duplo clique restaura padrão de 300px)"
          >
            <div className="w-[2px] h-8 rounded-full bg-gray-600/70 group-hover:bg-cyan-300 group-hover:scale-y-125 group-active:bg-white transition-all pointer-events-none" />
          </div>
        )}

        {/* COLUNA CENTRAL: PLAYER VIEWPORT COM SAFE ZONES DO TIKTOK */}
        <main className="flex-1 min-w-0 relative flex flex-col items-center justify-center p-3 bg-[#090B10] overflow-hidden min-h-0">
          {/* Container do Player Responsivo (9:16, 1:1, 16:9) que ocupa a altura útil */}
          <div
            className={`relative bg-black rounded-xl overflow-hidden border border-[#202534] shadow-2xl flex items-center justify-center transition-all duration-300 ${
              aspectRatio === "9:16"
                ? "h-full max-h-[calc(100%-48px)] aspect-[9/16] w-auto max-w-full"
                : aspectRatio === "1:1"
                ? "h-full max-h-[calc(100%-48px)] aspect-square w-auto max-w-full"
                : "w-full max-w-full h-auto max-h-[calc(100%-48px)] aspect-video"
            }`}
            style={{
              aspectRatio: aspectRatio === "9:16" ? "9 / 16" : aspectRatio === "1:1" ? "1 / 1" : "16 / 9",
            }}
          >
            {videoSrc ? (
              <>
                {/* Fundo Desfocado (Blur) quando ativado em modo 9:16 */}
                {aspectRatio === "9:16" && verticalMode === "blur" && (
                  <video
                    src={videoSrc}
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-125 pointer-events-none"
                  />
                )}

                <video
                  ref={videoRef}
                  src={videoSrc}
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={togglePlay}
                  style={{
                    objectPosition: aspectRatio === "9:16" ? `${cropX * 100}% 50%` : "50% 50%",
                  }}
                  className={`w-full h-full relative z-10 cursor-pointer ${
                    aspectRatio === "16:9"
                      ? "object-contain"
                      : aspectRatio === "9:16" && verticalMode === "blur"
                      ? "object-contain"
                      : "object-cover"
                  }`}
                />

                {/* Camada Dinâmica de B-Rolls Canvas em Tempo Real */}
                {enableBrollOverlay && (
                  <CanvasBrollOverlay
                    brolls={canvasBrolls}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                  />
                )}

                {/* Camada Dinâmica de Legendas em Tempo Real (Preview ao Vivo da Tipografia do Sistema Selecionada) */}
                {showSubtitlePreview && activeSubtitleData && (
                  <div
                    className="absolute inset-x-0 pointer-events-none flex justify-center z-30 transition-all duration-150 px-4"
                    style={{
                      bottom:
                        subtitlePosition === "center"
                          ? "48%"
                          : subtitlePosition === "center-bottom"
                          ? "28%"
                          : aspectRatio === "16:9"
                          ? "8%"
                          : "14%",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: customSubtitleFontSize >= 34 ? "0.6rem" : "0.35rem",
                        textAlign: "center",
                        fontFamily: `'${activeSystemFont.fontFamily}', sans-serif`,
                        fontWeight: 900,
                        fontSize: `${(customSubtitleFontSize / 16).toFixed(2)}rem`,
                        lineHeight: 1.15,
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                        filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.8))",
                        maxWidth: "92%",
                      }}
                    >
                      {activeSubtitleData.words.map((item, idx) => {
                        const isHighlighted = item.isActive;
                        return (
                          <span
                            key={idx}
                            style={{
                              color: isHighlighted ? highlightColor : primaryColor,
                              textShadow:
                                "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.9)",
                              transform: isHighlighted ? "scale(1.12)" : "scale(1)",
                              transition: "all 0.1s ease-out",
                              display: "inline-block",
                              padding: "0 0.18rem",
                              borderRadius: "4px",
                              background:
                                subtitleStyle === "minimal"
                                  ? "rgba(0, 0, 0, 0.7)"
                                  : isHighlighted && subtitleStyle === "beast"
                                  ? "rgba(0, 0, 0, 0.35)"
                                  : "transparent",
                            }}
                          >
                            {item.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OVERLAY DE SAFE ZONES DISCRETAS (APENAS EM MODO 9:16 VERTICAL - TIKTOK / REELS / SHORTS) */}
                {showSafeZones && aspectRatio === "9:16" && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 z-20">
                    {/* Top Bar Safe Margin Discreta */}
                    <div className="h-10 border-b border-dashed border-white/20 flex items-center justify-center">
                      <span className="text-[10px] font-medium tracking-wider text-white/30 uppercase bg-black/40 px-1.5 py-0.5 rounded">
                        Safe Zone Superior
                      </span>
                    </div>

                    {/* Lateral Direita Discreta */}
                    <div className="absolute right-2 bottom-20 flex flex-col gap-2 items-center opacity-25">
                      <div className="w-5 h-5 rounded-full border border-dashed border-white/60" />
                      <div className="w-5 h-5 rounded-full border border-dashed border-white/60" />
                      <div className="w-5 h-5 rounded-full border border-dashed border-white/60" />
                      <div className="w-4 h-4 rounded-full border border-dashed border-cyan-400" />
                    </div>

                    {/* Bottom Safe Margin Discreta */}
                    <div className="h-16 border-t border-dashed border-white/20 pt-1 flex items-start justify-center">
                      <span className="text-[10px] font-medium text-white/30 uppercase bg-black/40 px-1.5 py-0.5 rounded">
                        Safe Zone Inferior (Legendas)
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-sm font-medium">Vídeo não carregado</div>
            )}
          </div>

          {/* Barra de Controles do Player com Atalhos em Tooltip e Modo Foco */}
          <div className="h-10 mt-2 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => seekRelative(-1)}
              className="bg-[#151822] hover:bg-[#1E2332] border border-[#262B3A] text-gray-200 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              title="Voltar 1 segundo (←)"
            >
              -1s
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105 shadow-lg ${
                isPlaying ? "bg-rose-500 hover:bg-rose-600" : "bg-indigo-600 hover:bg-indigo-500"
              }`}
              title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(1)}
              className="bg-[#151822] hover:bg-[#1E2332] border border-[#262B3A] text-gray-200 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              title="Avançar 1 segundo (→)"
            >
              +1s
            </button>

            <div className="h-4 w-px bg-[#262B3A]" />

            <button
              type="button"
              onClick={() => setIsFocusMode((prev) => !prev)}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isFocusMode
                  ? "bg-indigo-600 text-white border-indigo-400"
                  : "bg-[#151822] hover:bg-[#1E2332] text-gray-400 border-[#262B3A]"
              }`}
              title="Modo Foco: expandir preview ocultando abas laterais (Tecla F)"
            >
              <Maximize2 size={13} />
              <span>{isFocusMode ? "Sair do Foco (F)" : "Modo Foco (F)"}</span>
            </button>
          </div>
        </main>

        {/* DIVISOR REDIMENSIONÁVEL DIREITO (segurar com o mouse para deixar mais fino ou mais grosso) */}
        {!isFocusMode && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingRight(true);
            }}
            onDoubleClick={() => {
              setRightWidth(280);
              try { localStorage.setItem("clip_editor_right_width", "280"); } catch {}
            }}
            className="w-2.5 hover:w-3.5 -mx-1.5 z-40 cursor-col-resize select-none flex items-center justify-center group transition-colors hover:bg-cyan-500/40 active:bg-cyan-400 bg-transparent shrink-0"
            title="Arraste para redimensionar a seção direita (Duplo clique restaura padrão de 280px)"
          >
            <div className="w-[2px] h-8 rounded-full bg-gray-600/70 group-hover:bg-cyan-300 group-hover:scale-y-125 group-active:bg-white transition-all pointer-events-none" />
          </div>
        )}

        {/* COLUNA DIREITA: ACCORDION COM UM BLOCO ABERTO POR VEZ */}
        <aside
          style={{ width: isFocusMode ? 0 : `${rightWidth}px` }}
          className={`bg-[#13161F] border-l border-[#212634] p-3 flex flex-col gap-2 overflow-y-auto shrink-0 transition-[width] duration-75 ${
            isFocusMode ? "invisible opacity-0" : "visible opacity-100"
          }`}
        >
          {/* 1. SEÇÃO ACCORDION: INSPETOR DE ELEMENTOS */}
          <div className="border border-[#262B3B] rounded-lg overflow-hidden bg-[#161924]">
            <button
              type="button"
              onClick={() => setRightAccordionOpen(rightAccordionOpen === "inspector" ? "hook" : "inspector")}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#1A1E2C] hover:bg-[#202537] text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-cyan-400" />
                <span className="text-xs font-bold text-gray-200">Inspetor de Elementos</span>
              </div>
              {rightAccordionOpen === "inspector" ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {rightAccordionOpen === "inspector" && (
              <div className="p-3">
                {selectedBroll ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.74rem", color: "#00F0FF", fontWeight: 700 }}>
                        Item Selecionado:
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBroll(selectedBroll.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#EF4444",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        Excluir
                      </button>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                        Template:
                      </label>
                      <select
                        value={selectedBroll.template}
                        onChange={(e) => updateBroll(selectedBroll.id, { template: e.target.value as CanvasBrollTemplate })}
                        style={{
                          width: "100%",
                          background: "#181B26",
                          border: "1px solid #2A3042",
                          color: "#FFF",
                          padding: "0.35rem",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                        }}
                      >
                        <option value="metric_counter">Contador de Métrica</option>
                        <option value="growth_chart">Gráfico de Crescimento</option>
                        <option value="glass_alert">Alerta Glassmorphism</option>
                        <option value="viral_tag">Tag Viral</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                        Título / Tag:
                      </label>
                      <input
                        type="text"
                        value={selectedBroll.data.title || ""}
                        onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, title: e.target.value } })}
                        style={{
                          width: "100%",
                          background: "#181B26",
                          border: "1px solid #2A3042",
                          color: "#FFF",
                          padding: "0.35rem",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                        Valor em Destaque:
                      </label>
                      <input
                        type="text"
                        value={selectedBroll.data.value || ""}
                        onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, value: e.target.value } })}
                        style={{
                          width: "100%",
                          background: "#181B26",
                          border: "1px solid #2A3042",
                          color: "#00F0FF",
                          fontWeight: 700,
                          padding: "0.35rem",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                        Posição Vertical:
                      </label>
                      <select
                        value={selectedBroll.data.positionY || "top"}
                        onChange={(e) => updateBroll(selectedBroll.id, { data: { ...selectedBroll.data, positionY: e.target.value as any } })}
                        style={{
                          width: "100%",
                          background: "#181B26",
                          border: "1px solid #2A3042",
                          color: "#FFF",
                          padding: "0.35rem",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                        }}
                      >
                        <option value="top">Topo</option>
                        <option value="center">Centro</option>
                        <option value="bottom">Base</option>
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                      <div>
                        <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                          Início (s):
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedBroll.offsetSec}
                          onChange={(e) => updateBroll(selectedBroll.id, { offsetSec: parseFloat(e.target.value) || 0 })}
                          style={{
                            width: "100%",
                            background: "#181B26",
                            border: "1px solid #2A3042",
                            color: "#FFF",
                            padding: "0.35rem",
                            borderRadius: "6px",
                            fontSize: "0.76rem",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.74rem", color: "#94A3B8", display: "block", marginBottom: "0.2rem" }}>
                          Duração (s):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedBroll.durationSec}
                          onChange={(e) => updateBroll(selectedBroll.id, { durationSec: parseFloat(e.target.value) || 1 })}
                          style={{
                            width: "100%",
                            background: "#181B26",
                            border: "1px solid #2A3042",
                            color: "#FFF",
                            padding: "0.35rem",
                            borderRadius: "6px",
                            fontSize: "0.76rem",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-gray-500 text-xs">
                    Clique em um elemento na timeline para editar propriedades.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. SEÇÃO ACCORDION: GANCHO EDITORIAL */}
          <div className="border border-[#262B3B] rounded-lg overflow-hidden bg-[#161924]">
            <button
              type="button"
              onClick={() => setRightAccordionOpen(rightAccordionOpen === "hook" ? "inspector" : "hook")}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#1A1E2C] hover:bg-[#202537] text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-gray-200">Gancho & Análise Viral</span>
              </div>
              {rightAccordionOpen === "hook" ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {rightAccordionOpen === "hook" && (
              <div className="p-3 text-xs flex flex-col gap-2">
                <span className="text-gray-400 text-[11px] block">Gancho Editorial Identificado:</span>
                <p className="m-0 text-gray-200 italic bg-[#0F1118] p-2.5 rounded border border-[#212634]">
                  &quot;{clip.hook || clip.title}&quot;
                </p>
                {clip.reason && (
                  <p className="m-0 text-gray-400 text-[11px] leading-relaxed">
                    {clip.reason}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. SEÇÃO ACCORDION: CLONAGEM DE ESTILO COM IA */}
          <div className="border border-purple-500/30 rounded-lg overflow-hidden bg-[#181528] mt-auto">
            <button
              type="button"
              onClick={() => setRightAccordionOpen(rightAccordionOpen === "clone" ? "inspector" : "clone")}
              className="w-full flex items-center justify-between px-3 py-2 bg-purple-950/40 hover:bg-purple-950/60 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SparklesIcon size={14} className="text-purple-400" />
                <span className="text-xs font-bold text-purple-200">Clonagem de Estilo (IA)</span>
              </div>
              {rightAccordionOpen === "clone" ? <ChevronUp size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-purple-400" />}
            </button>

            {rightAccordionOpen === "clone" && (
              <div className="p-3 flex flex-col gap-2">
                <p className="text-xs text-purple-200/80 m-0 leading-relaxed">
                  Importe ou clone cortes de referências virais, ritmos de transição e paleta de cores para este corte.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCloneModalOpen(true)}
                  className="w-full mt-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-md py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="Abrir o estúdio completo de clonagem de edição com IA"
                >
                  <SparklesIcon size={14} className="text-purple-200" />
                  Abrir Clone Studio
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 3. BARRA DE REDIMENSIONAMENTO DA TIMELINE (DRAG HANDLE) */}
      <div
        onMouseDown={() => setIsResizingTimeline(true)}
        className="h-2 bg-[#12151F] hover:bg-cyan-500/40 border-t border-b border-[#212635] cursor-row-resize flex items-center justify-center transition-colors select-none z-20 group"
        title="Arraste para ajustar a altura da Timeline"
      >
        <div className="w-12 h-1 rounded-full bg-gray-600 group-hover:bg-cyan-400 transition-colors" />
      </div>

      {/* 4. TIMELINE MULTITRACK PROFISSIONAL (REDIMENSIONÁVEL) */}
      <footer
        style={{
          height: `${timelineHeight}px`,
          backgroundColor: "#0F1118",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Barra de Ferramentas da Timeline */}
        <div
          style={{
            height: "36px",
            backgroundColor: "#141722",
            borderBottom: "1px solid #212635",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={setStartToCurrent}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              title="Marcar início do clipe no playhead"
            >
              <Scissors size={13} style={{ color: "#00F0FF" }} /> Split Início
            </button>

            <button
              type="button"
              onClick={setEndToCurrent}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              title="Marcar fim do clipe no playhead"
            >
              <Scissors size={13} style={{ color: "#00F0FF" }} /> Split Fim
            </button>

            {selectedBrollId && (
              <button
                type="button"
                onClick={() => removeBroll(selectedBrollId)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#EF4444",
                  cursor: "pointer",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Trash2 size={13} /> Excluir B-Roll
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Zoom:</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[1, 1.5, 2].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomScale(z)}
                  style={{
                    background: zoomScale === z ? "#6366F1" : "#1C202E",
                    color: zoomScale === z ? "#FFF" : "#94A3B8",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.15rem 0.4rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Régua de Tempo (Time Ruler) */}
        <div
          style={{
            height: "22px",
            backgroundColor: "#0B0D13",
            borderBottom: "1px solid #1C202C",
            position: "relative",
            overflow: "hidden",
            marginLeft: "90px", // Espaço para rótulo das faixas
          }}
        >
          {rulerMarks.map((sec) => {
            const leftPct = (sec / duration) * 100;
            return (
              <div
                key={sec}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: "1px", height: "6px", backgroundColor: "#3B4254" }} />
                <span
                  style={{
                    fontSize: "0.62rem",
                    color: "#64748B",
                    fontFamily: "'JetBrains Mono', monospace",
                    transform: "translateX(-50%)",
                  }}
                >
                  {sec}s
                </span>
              </div>
            );
          })}
        </div>

        {/* Faixas Multitrack Empilhadas */}
        <div
          ref={timelineTracksRef}
          onClick={handleTimelineScrub}
          style={{
            flex: 1,
            position: "relative",
            overflowY: "auto",
            overflowX: "hidden",
            cursor: "pointer",
            backgroundColor: "#0D0F16",
          }}
        >
          {/* Agulha Vertical de Reprodução (Playhead Needle) */}
          <div
            style={{
              position: "absolute",
              left: `calc(90px + ${(currentTime / duration) * 100}% * ((100% - 90px) / 100%))`,
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: "#EF4444",
              boxShadow: "0 0 8px #EF4444",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            {/* Cabeça Triangular do Playhead */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "-5px",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "8px solid #EF4444",
              }}
            />
          </div>

          {/* FAIXA 1: LEGENDAS & TEXTO (AMARELO) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#FACC15",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🔤 Legendas
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "2%",
                  width: "96%",
                  height: "100%",
                  background: "rgba(250, 204, 21, 0.15)",
                  border: "1px solid rgba(250, 204, 21, 0.4)",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "0.5rem",
                  fontSize: "0.68rem",
                  color: "#FDE047",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {clip.hook || clip.title}
              </div>
            </div>
          </div>

          {/* FAIXA 2: B-ROLLS & OVERLAYS (CIANO / ROXO) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#00F0FF",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              ⚡ B-Rolls
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {canvasBrolls.map((b) => {
                const leftPct = (b.offsetSec / duration) * 100;
                const widthPct = Math.max(2, (b.durationSec / duration) * 100);
                const isSelected = b.id === selectedBrollId;
                return (
                  <div
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBrollId(b.id);
                      jumpToTime(b.offsetSec);
                    }}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: "100%",
                      backgroundColor: isSelected ? "#00F0FF" : "rgba(0, 240, 255, 0.35)",
                      color: isSelected ? "#000" : "#FFF",
                      border: `1px solid ${isSelected ? "#FFF" : "#00F0FF"}`,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 0.3rem",
                      boxShadow: isSelected ? "0 0 10px rgba(0, 240, 255, 0.6)" : "none",
                    }}
                    title={`${b.data.title || "B-Roll"} (${b.durationSec}s)`}
                  >
                    {b.data.title || "B-Roll"}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAIXA 3: VÍDEO PRINCIPAL COM TRIM (ÍNDIGO / AZUL) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #181C26",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#818CF8",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🎞 Vídeo
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {/* Trecho Recortado Ativo */}
              <div
                style={{
                  position: "absolute",
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4F46E5, #6366F1)",
                  border: "1px solid #818CF8",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 0.5rem",
                  fontSize: "0.68rem",
                  color: "#FFF",
                  fontWeight: 700,
                }}
              >
                <span>Início: {trimStart.toFixed(1)}s</span>
                <span>Fim: {trimEnd.toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* FAIXA 4: ÁUDIO & SOUND DESIGN (VERDE ESMERALDA) */}
          <div
            style={{
              height: "36px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "90px",
                paddingLeft: "0.75rem",
                fontSize: "0.7rem",
                color: "#10B981",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              🎵 Áudio / SFX
            </div>
            <div style={{ flex: 1, position: "relative", height: "24px" }}>
              {/* Indicador de SFX Ding no Gancho */}
              <div
                style={{
                  position: "absolute",
                  left: "0.5%",
                  width: "12%",
                  height: "100%",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid #10B981",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  color: "#6EE7B7",
                  fontWeight: 700,
                }}
              >
                🔔 Hook Ding
              </div>

              {/* Indicador de Transição Whoosh nos B-Rolls */}
              {canvasBrolls.map((b) => (
                <div
                  key={"sfx-" + b.id}
                  style={{
                    position: "absolute",
                    left: `${(b.offsetSec / duration) * 100}%`,
                    width: "8%",
                    height: "100%",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px dashed #10B981",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.62rem",
                    color: "#6EE7B7",
                  }}
                >
                  💨 Whoosh
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Completo de Clonagem de Edição (DNA de estilo e IA) */}
      {isCloneModalOpen && (
        <CloneStudioModal
          isOpen={isCloneModalOpen}
          onClose={() => setIsCloneModalOpen(false)}
          userId={userId}
          projectId={projectId}
          initialClip={{
            id: clip.id,
            title: clip.title,
            path: clip.file_path || "",
            url: videoSrc,
            position: clip.position,
          }}
          onCreated={() => {
            setIsCloneModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
