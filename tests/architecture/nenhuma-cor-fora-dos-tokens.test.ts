import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Disciplina de cor (referência FIAP 2026-09-06, §2 item 3): "o primário só em
 * CTA e estado ativo; badges e níveis com os tokens de nível; nenhum azul fora
 * dos tokens". A percepção de premium vem da economia de cor — e a economia
 * morre no dia em que alguém escreve `#7cb8ff` num componente porque o token
 * "não tinha o tom certo".
 *
 * A régua é mecânica: nenhum literal de cor (hex, rgb/rgba, oklch) em `src/`
 * fora de `styles.css` (a paleta) e de `src/lib/design/` (o gerador que
 * escreve a paleta — é a fonte, não um consumidor). Tudo o mais lê um token:
 * `var(--x)`, `bg-primary`, `text-level-3-fg`.
 *
 * Desde a revisão mestre de 2026-09-08 ([P-03]) a régua enxerga também a
 * CLASSE de paleta do Tailwind (`text-emerald-600`, `bg-red-500`…): "um acento
 * só" era violável por classe sem escrever literal nenhum. Prova do vermelho no
 * dia: `development-plans.tsx` e `PasswordChoiceFields.tsx` com `text-emerald-*`
 * (2 ocorrências), ambas trocadas por `text-success-fg` na mesma fatia.
 *
 * A baseline gravada na fixture nomeia as exceções que existiam quando a
 * catraca nasceu (fallback de canvas quando o CSS ainda não carregou, página
 * de erro sem stylesheet) e SÓ DESCE. Para regravar após remover literais:
 * `ATUALIZAR_BASELINE_CORES=1 npx vitest run tests/architecture/nenhuma-cor-fora-dos-tokens.test.ts`
 */

const PALETA = join("src", "styles.css");
const GERADOR = `${join("src", "lib", "design")}${sep}`;

const LITERAL_DE_COR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g;

/** As 22 famílias de paleta do Tailwind — nenhuma é token da casa. */
const FAMILIAS_DE_PALETA =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const CLASSE_DE_PALETA = new RegExp(
  `\\b(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide|placeholder|accent|caret)-(?:${FAMILIAS_DE_PALETA})-\\d{2,3}\\b`,
  "g",
);

const catraca = new Catraca({
  fixture: join(
    raizDoFrontend,
    "tests",
    "architecture",
    "nenhuma-cor-fora-dos-tokens.fixture.json",
  ),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_CORES",
  conta: (arquivo) => arquivo.ocorrencias(LITERAL_DE_COR) + arquivo.ocorrencias(CLASSE_DE_PALETA),
  consome: (arquivo) =>
    arquivo.eFonteDeTela && arquivo.caminho !== PALETA && !arquivo.caminho.startsWith(GERADOR),
});

describe("nenhuma cor literal fora dos tokens", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a paleta continua sendo a única fonte de oklch fora do gerador", () => {
    const css = readFileSync(join(raizDoFrontend, PALETA), "utf8");
    expect(css.match(/oklch\(/g)?.length ?? 0).toBeGreaterThan(50);
  });

  it("a régua enxerga classe de paleta do Tailwind, com ou sem variante", () => {
    expect("text-emerald-600 hover:bg-red-500 dark:text-sky-300".match(CLASSE_DE_PALETA)).toEqual([
      "text-emerald-600",
      "hover:bg-red-500",
      "dark:text-sky-300",
    ]);
    expect("text-success-fg bg-level-3 border-border".match(CLASSE_DE_PALETA)).toBeNull();
  });
});
