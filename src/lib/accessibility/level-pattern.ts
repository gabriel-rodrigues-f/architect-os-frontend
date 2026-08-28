import type { Level } from "@/lib/domain";

export const PATTERN_INK = {
  subtle: 28,

  strong: 55,
} as const;

function hatch(angulo: string, traco: string, periodo: string, tinta: string): string {
  return `repeating-linear-gradient(${angulo}, ${tinta} 0 ${traco}, transparent ${traco} ${periodo})`;
}

export function levelPatternImage(level: Level, intensidade: number): string {
  const tinta = `color-mix(in oklch, var(--level-${String(level)}-fg) ${String(intensidade)}%, transparent)`;
  switch (level) {
    case 1:
      return hatch("45deg", "1px", "9px", tinta);
    case 2:
      return hatch("135deg", "1px", "9px", tinta);
    case 3:
      return hatch("45deg", "2px", "6px", tinta);
    case 4:
      return hatch("135deg", "2px", "6px", tinta);
    case 5:
      return `${hatch("45deg", "2px", "6px", tinta)}, ${hatch("135deg", "2px", "6px", tinta)}`;
  }
}
