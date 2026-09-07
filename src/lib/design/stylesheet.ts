import { SCALES } from "./scale";
import { ShellHeader } from "./shell";

export function renderScales(): string {
  return [`:root {`, ...SCALES.flatMap((e) => e.toCssLines()), ShellHeader.cssLine, `}`].join("\n");
}
