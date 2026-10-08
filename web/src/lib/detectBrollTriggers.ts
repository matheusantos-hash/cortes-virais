import type { CanvasBroll, CanvasBrollTemplate } from "./types";

export interface BrollTriggerSuggestion {
  offsetSec: number;
  durationSec: number;
  word: string;
  template: CanvasBrollTemplate;
  suggestedTitle: string;
  suggestedValue: string;
  suggestedSubtitle?: string;
  suggestedColor: "cyan" | "green" | "yellow" | "purple";
}

/** Detecta momentos ideais na fala para inserção de B-Rolls dinâmicos em código/canvas */
export function detectBrollTriggers(
  words: { w: string; s: number; e: number }[] | undefined,
  clipStart: number,
  clipEnd: number
): BrollTriggerSuggestion[] {
  if (!words || !words.length) return [];

  const duration = Math.max(1, clipEnd - clipStart);
  const suggestions: BrollTriggerSuggestion[] = [];
  let lastSuggestedTime = -10; // Garante espaçamento de pelo menos 4s entre sugestões

  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    const text = (item.w || "").trim().toLowerCase();
    const cleanWord = text.replace(/[.,!?;:()]/g, "");
    const offsetSec = Number(Math.max(0, item.s - clipStart).toFixed(1));

    // Ignora se estiver muito no começo (< 1s) ou no final (< 2s do fim)
    if (offsetSec < 1.0 || offsetSec > duration - 2.5) continue;

    // Respeita intervalo mínimo de 4 segundos para não sobrecarregar
    if (offsetSec - lastSuggestedTime < 4.0) continue;

    // 1. Detecta Métricas / Porcentagens / Números
    const isPercent = text.includes("%") || text.includes("porcento");
    const isCurrency = text.includes("r$") || text.includes("$") || text.includes("reais") || text.includes("dólares");
    const isNumber = /\b\d+(\.\d+)?\b/.test(cleanWord) || /\b\d+x\b/.test(cleanWord);
    const isMultiplier = /\b(dobrou|triplicou|multiplicou|quadruplicou)\b/.test(cleanWord);

    if (isPercent || isCurrency || isNumber || isMultiplier) {
      let val = item.w.toUpperCase().replace(/[.,!?;:]/g, "");
      if (isPercent && !val.includes("%")) val += "%";
      if (isMultiplier) val = "2X MAIS";

      suggestions.push({
        offsetSec,
        durationSec: 3.0,
        word: item.w,
        template: "metric_counter",
        suggestedTitle: isCurrency ? "FATURAMENTO" : "RESULTADO",
        suggestedValue: val,
        suggestedSubtitle: "Destaque de retenção no corte",
        suggestedColor: "cyan",
      });
      lastSuggestedTime = offsetSec;
      continue;
    }

    // 2. Detecta Crescimento e Expansão
    const isGrowth = /\b(cresceu|aumentou|subiu|escalou|lucro|faturamento|crescimento|avanço)\b/.test(cleanWord);
    if (isGrowth) {
      suggestions.push({
        offsetSec,
        durationSec: 3.5,
        word: item.w,
        template: "growth_chart",
        suggestedTitle: "CURVA DE CRESCIMENTO",
        suggestedValue: "+380%",
        suggestedSubtitle: "Aceleração exponencial",
        suggestedColor: "green",
      });
      lastSuggestedTime = offsetSec;
      continue;
    }

    // 3. Detecta Atenção, Segredo ou Alerta Crítico
    const isAlert = /\b(segredo|cuidado|erro|atenção|jamais|nunca|perigo|crítico|preste)\b/.test(cleanWord);
    if (isAlert) {
      suggestions.push({
        offsetSec,
        durationSec: 3.0,
        word: item.w,
        template: "glass_alert",
        suggestedTitle: "PONTO DE ATENÇÃO",
        suggestedValue: cleanWord.toUpperCase(),
        suggestedSubtitle: "Informação essencial para o público",
        suggestedColor: "yellow",
      });
      lastSuggestedTime = offsetSec;
      continue;
    }

    // 4. Conceitos Virais e Estratégia
    const isViral = /\b(estratégia|método|resultado|fórmula|passo|técnica)\b/.test(cleanWord);
    if (isViral) {
      suggestions.push({
        offsetSec,
        durationSec: 2.8,
        word: item.w,
        template: "viral_tag",
        suggestedTitle: "MÉTODO VIRAL",
        suggestedValue: cleanWord.toUpperCase(),
        suggestedColor: "purple",
      });
      lastSuggestedTime = offsetSec;
      continue;
    }
  }

  return suggestions;
}
