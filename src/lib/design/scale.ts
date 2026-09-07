class Scale<Step extends string> {
  constructor(
    readonly prefix: string,
    private readonly steps: Readonly<Record<Step, number>>,

    private readonly unit: "px" | "rem" | "" = "px",

    readonly utilityNamespace?: string,
  ) {}

  get(step: Step): number {
    return this.steps[step];
  }

  toCssLines(): string[] {
    return Object.entries(this.steps).map(
      ([step, valor]) => `  --${this.prefix}-${step}: ${String(valor)}${this.unit};`,
    );
  }

  toThemeLines(): string[] {
    const namespace = this.utilityNamespace;
    if (!namespace) return [];
    return Object.keys(this.steps).map(
      (step) => `  --${namespace}-${step}: var(--${this.prefix}-${step});`,
    );
  }

  entries(): [Step, number][] {
    return Object.entries(this.steps) as [Step, number][];
  }

  isMonotonic(): boolean {
    const valores = Object.values(this.steps) as number[];
    return valores.every((v, i) => i === 0 || v > (valores[i - 1] as number));
  }
}

export interface TypeStep {
  readonly size: number;
  readonly lineHeight: number;
}

/**
 * Escala tipográfica: cada degrau é o PAR tamanho + altura de linha, e a
 * altura de linha é um token (`--text-X--line-height`) que o Tailwind lê ao
 * gerar `text-X`. Antes só o tamanho era token e `text-meta`, `text-sm` e
 * `text-xs` na mesma linha alternavam altura ([T-03]).
 *
 * A mesma interface da `Scale` numérica (`get`, `entries`, `isMonotonic`,
 * `toCssLines`, `toThemeLines`) para o gerador e os testes tratarem as duas
 * do mesmo jeito; `get` devolve o tamanho, `lineHeight` a altura.
 */
class TypeScale<Step extends string> {
  readonly utilityNamespace = "text";

  constructor(
    readonly prefix: string,
    private readonly steps: Readonly<Record<Step, TypeStep>>,
  ) {}

  get(step: Step): number {
    return this.steps[step].size;
  }

  lineHeight(step: Step): number {
    return this.steps[step].lineHeight;
  }

  /** Nome do token de altura de linha — a convenção `--text-X--line-height` do Tailwind v4. */
  static lineHeightToken(prefix: string, step: string): string {
    return `--${prefix}-${step}--line-height`;
  }

  toCssLines(): string[] {
    return this.entries().flatMap(([step, size]) => [
      `  --${this.prefix}-${step}: ${String(size)}px;`,
      `  ${TypeScale.lineHeightToken(this.prefix, step)}: ${String(this.lineHeight(step))}px;`,
    ]);
  }

  toThemeLines(): string[] {
    return this.entries().flatMap(([step]) => [
      `  --${this.utilityNamespace}-${step}: var(--${this.prefix}-${step});`,
      `  ${TypeScale.lineHeightToken(this.utilityNamespace, step)}: var(${TypeScale.lineHeightToken(this.prefix, step)});`,
    ]);
  }

  entries(): [Step, number][] {
    return (Object.entries(this.steps) as [Step, TypeStep][]).map(([step, par]) => [
      step,
      par.size,
    ]);
  }

  lineHeights(): [Step, number][] {
    return (Object.entries(this.steps) as [Step, TypeStep][]).map(([step, par]) => [
      step,
      par.lineHeight,
    ]);
  }

  isMonotonic(): boolean {
    const tamanhos = this.entries().map(([, size]) => size);
    return tamanhos.every(
      (valor, indice) => indice === 0 || valor > (tamanhos[indice - 1] as number),
    );
  }
}

export const radius = new Scale("radius", {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
});

export const spacing = new Scale(
  "space",
  {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "6": 24,
    "8": 32,
    "12": 48,
    "16": 64,
  },
  "px",
  "spacing",
);

/**
 * Os dois micro-degraus admitidos fora da grade de 4 ([S-01]): 2 px e 6 px,
 * para o respiro interno de ícone e badge. O Tailwind já os gera
 * (`gap-0.5`, `py-1.5`); aqui eles ganham nome e limite — qualquer outro meio
 * passo (2.5, 3.5, 5, 7, 10) conta na catraca `espacamento-na-grade`.
 */
export const MICRO_STEPS = { "0.5": 2, "1.5": 6 } as const;

/**
 * Display 32/40 · título de página 24/32 · seção 20/28 · subseção 16/24 ·
 * corpo 14/20 · corpo pequeno (tabela) 13/20 · rótulo 12/16 · metadado 11/16.
 * Nada abaixo de 11 px; toda altura de linha é múltiplo de 4 para a grade
 * vertical fechar (o alvo dizia 13/18 para a tabela; 18 quebrava a regra e
 * ficou 20). Os nomes são os da casa — o papel, não a medida.
 */
export const fontSize = new TypeScale("text", {
  meta: { size: 11, lineHeight: 16 },
  label: { size: 12, lineHeight: 16 },
  table: { size: 13, lineHeight: 20 },
  body: { size: 14, lineHeight: 20 },
  subtitle: { size: 16, lineHeight: 24 },
  section: { size: 20, lineHeight: 28 },
  page: { size: 24, lineHeight: 32 },
  kpi: { size: 32, lineHeight: 40 },
});

export const fontWeight = new Scale(
  "weight",
  {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  "",
);

export const SCALES = [radius, spacing, fontSize, fontWeight] as const;
