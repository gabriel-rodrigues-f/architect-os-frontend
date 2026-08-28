export class Oklch {
  constructor(
    readonly l: number,

    readonly c: number,

    readonly h: number,

    readonly alpha = 1,
  ) {}

  static parse(css: string): Oklch {
    const m = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i.exec(css);
    const [, lightness, chroma, hue, alpha] = m ?? [];
    if (lightness === undefined) throw new Error(`cor OKLCH inválida: ${css}`);
    const num = (v: string) => (v.endsWith("%") ? Number(v.slice(0, -1)) / 100 : Number(v));
    return new Oklch(num(lightness), Number(chroma), Number(hue), alpha ? num(alpha) : 1);
  }

  with(patch: Partial<{ l: number; c: number; h: number; alpha: number }>): Oklch {
    return new Oklch(
      patch.l ?? this.l,
      patch.c ?? this.c,
      patch.h ?? this.h,
      patch.alpha ?? this.alpha,
    );
  }

  lighten(delta: number): Oklch {
    return this.with({ l: clamp01(this.l + delta) });
  }

  darken(delta: number): Oklch {
    return this.lighten(-delta);
  }

  desaturate(factor: number): Oklch {
    return this.with({ c: Math.max(0, this.c * (1 - factor)) });
  }

  toCss(): string {
    const base = `oklch(${round(this.l)} ${round(this.c)} ${round(this.h)}`;
    return this.alpha >= 1 ? `${base})` : `${base} / ${round(this.alpha)})`;
  }

  private toLinearRgb(): [number, number, number] {
    const h = (this.h * Math.PI) / 180;
    const a = this.c * Math.cos(h);
    const b = this.c * Math.sin(h);

    const l_ = this.l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = this.l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = this.l - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;

    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  luminance(): number {
    const [r, g, b] = this.toLinearRgb();
    return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
  }

  contrastWith(other: Oklch): number {
    const a = this.luminance();
    const b = other.luminance();
    const [claro, escuro] = a > b ? [a, b] : [b, a];
    return (claro + 0.05) / (escuro + 0.05);
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export const CONTRAST = {
  text: 4.5,

  large: 3,
} as const;
