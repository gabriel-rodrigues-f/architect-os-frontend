import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend, Varredura } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [A-01]: o anel de foco é UM — a utility
 * `focus-ring` (borda primária + halo de `--focus-ring-width` a 8%), sempre
 * por `focus-visible:`. Antes cada componente trazia o seu: `ring-1 ring-ring`
 * no `Input`, `ring-2 ring-primary/70` no `PasswordInput`, `ring-2 ring-ring`
 * no `FieldLabel` — três anéis, três larguras, três cores.
 *
 * Duas réguas: em `components/ui/` (as primitivas, inclusive o `Select`) o
 * `ring-1`/`ring-2` solto é ZERO, sem baseline; no resto de `src/` é catraca
 * só-desce (o `ring-1 ring-destructive` de campo inválido em
 * `mentoring-shared`/`PersonCombobox` vai para o PR 10). Prova do vermelho no
 * dia: 7 ocorrências em 5 arquivos com a fixture vazia (a régua olha só
 * `.ts`/`.tsx`: em `styles.css` o `ring-1` aparece em comentário).
 *
 * Regravar: `ATUALIZAR_BASELINE_FOCUS_RING=1 npx vitest run tests/architecture/focus-ring-unico.test.ts`
 */
const ANEL_SOLTO = /(?<![\w-])(?:[a-z-]+:)*ring-[12]\b/g;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "focus-ring-unico.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_FOCUS_RING",
  conta: (arquivo) => arquivo.ocorrencias(ANEL_SOLTO),
  consome: (arquivo) => arquivo.eFonteDeTela && !arquivo.chave.endsWith(".css"),
});

describe("anel de foco único", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("nenhum `ring-1`/`ring-2` solto em components/ui", () => {
    const primitivas = new Varredura().contagem(
      (arquivo) => arquivo.ocorrencias(ANEL_SOLTO),
      (arquivo) => arquivo.chave.startsWith("src/components/ui/"),
    );
    expect(primitivas).toEqual({});
  });

  it("a régua reconhece o anel com e sem variante, e ignora `focus-ring`", () => {
    expect("focus-visible:ring-2 ring-1 ring-destructive".match(ANEL_SOLTO)).toEqual([
      "focus-visible:ring-2",
      "ring-1",
    ]);
    expect(
      "focus-visible:focus-ring ring-offset-2 --focus-ring-width".match(ANEL_SOLTO),
    ).toBeNull();
  });
});
