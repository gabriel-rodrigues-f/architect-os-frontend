import { SCALES } from "./scale";
import { DarkTheme, LightTheme, renderTheme, type ThemeStrategy } from "./tokens";

/**
 * Monta o bloco de fundações do stylesheet — escalas numéricas e tokens de cor
 * dos dois temas.
 *
 * O CSS é *gerado* a partir daqui e colado em `styles.css`; nada resolve cor ou
 * medida em tempo de execução. O navegador já faz isso melhor por variável CSS,
 * e uma camada de objetos no meio custaria re-render e quebraria o SSR.
 */
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

export function renderThemeBlock(strategy: ThemeStrategy): string {
  return renderTheme(strategy);
}
