import { SCALES } from "./scale";
import { DarkTheme, LightTheme, renderTheme, type ThemeStrategy } from "./tokens";

export function renderFoundations(): string {
  const escalas = SCALES.flatMap((escala) => escala.toCssLines());
  return [
    `:root {`,
    ...escalas,
    `}`,
    "",
    renderTheme(new LightTheme()),
    "",
    renderTheme(new DarkTheme()),
  ].join("\n");
}

export function renderScales(): string {
  return [`:root {`, ...SCALES.flatMap((e) => e.toCssLines()), `}`].join("\n");
}

export function renderScaleUtilities(): string {
  return [`@theme inline {`, ...SCALES.flatMap((e) => e.toThemeLines()), `}`].join("\n");
}

export function renderThemeBlock(strategy: ThemeStrategy): string {
  return renderTheme(strategy);
}
