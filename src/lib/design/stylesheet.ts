import { SCALES } from "./scale";

export function renderScales(): string {
  return [`:root {`, ...SCALES.flatMap((e) => e.toCssLines()), `}`].join("\n");
}
