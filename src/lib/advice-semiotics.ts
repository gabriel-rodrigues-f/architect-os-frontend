/**
 * Pedagogia semiótica na sugestão da IA (dono, 2026-09-05): um sinal colorido
 * ao lado do título diz, antes da leitura, se o bloco pede AÇÃO, avisa de
 * RISCO ou só situa. O emoji nunca substitui o texto — acompanha.
 *
 * A escolha é por palavra-chave do título, sem acento e sem caixa, e a
 * primeira regra que casa vence: "Riscos e próximos passos" é aviso antes de
 * ser ação. Título que não casa com nada fica sem sinal — silêncio é melhor
 * que sinal errado.
 */
export class AdviceSemiotics {
  private static readonly RULES: readonly { emoji: string; words: readonly string[] }[] = [
    { emoji: "⚠️", words: ["risco", "alerta", "atencao", "cuidado", "sinal", "estagna"] },
    {
      emoji: "🎯",
      words: [
        "proximo passo",
        "proximos passos",
        "acao",
        "acoes",
        "o que fazer",
        "sugest",
        "propost",
        "recomend",
        "por onde comecar",
      ],
    },
    {
      emoji: "💪",
      words: ["forca", "forte", "destaque", "conquista", "avanco", "evolu", "progresso"],
    },
    { emoji: "💬", words: ["pergunta", "conversa", "abertura", "como abrir", "fala", "roteiro"] },
    { emoji: "📉", words: ["distancia", "falta", "abaixo", "o que falta"] },
    { emoji: "📎", words: ["evidencia", "comprova"] },
    { emoji: "🗺️", words: ["plano", "pdi", "meta", "trilha", "prazo", "dedicacao"] },
    { emoji: "🤝", words: ["mentoria", "1:1", "acompanhamento"] },
    { emoji: "⚖️", words: ["calibra", "diverg", "notas"] },
    { emoji: "🪜", words: ["prontidao", "elegiv", "nivel", "senioridade", "transicao"] },
    { emoji: "🧹", words: ["repetid", "vago", "duplic", "fora de lugar", "catalogo"] },
    { emoji: "🧭", words: ["contexto", "situacao", "onde esta", "cenario", "resumo", "leitura"] },
  ];

  static emojiFor(heading: string): string | null {
    const plain = AdviceSemiotics.plain(heading);
    for (const rule of AdviceSemiotics.RULES) {
      if (rule.words.some((word) => AdviceSemiotics.startsAWord(plain, word))) return rule.emoji;
    }
    return null;
  }

  /**
   * A palavra-chave tem de começar uma palavra do título: "considerações"
   * contém "ações", e não é ação.
   */
  private static startsAWord(text: string, word: string): boolean {
    const at = text.indexOf(word);
    if (at < 0) return false;
    return at === 0 || !/[a-z0-9]/.test(text.charAt(at - 1));
  }

  private static plain(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
}

/**
 * Enquanto o provedor escreve, a tela não sabe quanto falta — o servidor não
 * transmite progresso. O que ela sabe é o RELÓGIO: a maioria das respostas
 * chega entre 5 e 20 s (teto do servidor). A barra sobe rápido no começo e
 * desacelera, sem nunca chegar a 100 antes da resposta: é uma estimativa
 * honesta, e o último trecho é da resposta de verdade.
 */
export class AiProgressEstimate {
  private static readonly CEILING = 95;
  private static readonly HALF_LIFE_MS = 7_000;
  private static readonly WRITING_AFTER_MS = 3_000;
  private static readonly FINISHING_AFTER_MS = 12_000;

  static percentAt(elapsedMs: number): number {
    if (elapsedMs <= 0) return 0;
    const fraction = 1 - Math.exp((-elapsedMs * Math.LN2) / AiProgressEstimate.HALF_LIFE_MS);
    return Math.min(AiProgressEstimate.CEILING, Math.round(fraction * 100));
  }

  static stageAt(elapsedMs: number): "reading" | "writing" | "finishing" {
    if (elapsedMs >= AiProgressEstimate.FINISHING_AFTER_MS) return "finishing";
    if (elapsedMs >= AiProgressEstimate.WRITING_AFTER_MS) return "writing";
    return "reading";
  }
}
