/**
 * Escalas numéricas do sistema — raio, espaçamento e tipografia.
 *
 * Ficam aqui pela mesma razão das cores: valor espalhado pelo código vira
 * valor arbitrário. Uma escala declarada num lugar só pode ser conferida,
 * testada e regenerada; `p-[13px]` no meio de um componente, não.
 *
 * A classe é genérica de propósito — raio e espaçamento têm a mesma forma
 * (degraus nomeados que viram variáveis CSS) e não justificam duas abstrações.
 */
export class Scale<Step extends string> {
  constructor(
    /** Prefixo da variável CSS: `radius` vira `--radius-sm`. */
    readonly prefix: string,
    private readonly steps: Readonly<Record<Step, number>>,
    /** Unidade emitida no CSS; `""` para valores sem unidade, como peso. */
    private readonly unit: "px" | "rem" | "" = "px",
  ) {}

  get(step: Step): number {
    return this.steps[step];
  }

  /** `--radius-md: 6px;` para cada degrau. */
  toCssLines(): string[] {
    return Object.entries(this.steps).map(
      ([step, valor]) => `  --${this.prefix}-${step}: ${String(valor)}${this.unit};`,
    );
  }

  entries(): [Step, number][] {
    return Object.entries(this.steps) as [Step, number][];
  }

  /** Os degraus sobem? Escala fora de ordem confunde quem escolhe o token. */
  isMonotonic(): boolean {
    const valores = Object.values(this.steps) as number[];
    return valores.every((v, i) => i === 0 || v > (valores[i - 1] as number));
  }
}

/**
 * Raio.
 *
 * Os valores caíram: a base era 10px e o `surface-card` usava 14px, o que dava
 * à aplicação inteira o arredondamento de dashboard de template. Ferramenta
 * profissional usa canto discreto — o raio marca a borda do controle, não
 * decora a tela.
 */
export const radius = new Scale("radius", {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
});

/**
 * Espaçamento. Os degraus grandes existem para criar ritmo entre seções — sem
 * eles a página fica com o mesmo respiro em toda parte e nada parece agrupado.
 */
export const spacing = new Scale("space", {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "6": 24,
  "8": 32,
  "12": 48,
  "16": 64,
});

/** Tamanho de fonte por papel, não por medida — `text-kpi`, não `text-30`. */
export const fontSize = new Scale("text", {
  meta: 11,
  label: 12,
  table: 13,
  body: 14,
  subtitle: 15,
  section: 18,
  page: 28,
  kpi: 32,
});

/**
 * Pesos.
 *
 * O teto é 600. `700` como padrão achata a hierarquia: quando tudo é forte,
 * nada se destaca, e a interface passa a parecer gritada em vez de organizada.
 */
export const fontWeight = new Scale(
  "weight",
  {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  "",
);

/** Todas as escalas, na ordem em que saem no stylesheet. */
export const SCALES = [radius, spacing, fontSize, fontWeight] as const;
