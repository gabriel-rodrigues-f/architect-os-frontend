import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [P-02]: não havia tokens semânticos de camada e
 * o código compensava com opacidade sobre token — `border-border/60`,
 * `bg-primary/10`, `hover:bg-primary/90`, `text-sidebar-foreground/70`. Uma
 * opacidade sobre fundo escuro rende OUTRO tom: o claro e o escuro divergem
 * por regra ausente, e o contraste nunca é medido porque a cor final não
 * existe em lugar nenhum.
 *
 * Os tokens agora existem (`surface-elevated`, `border-subtle/strong`,
 * `text-secondary`, `primary-hover/active/subtle`, `danger-subtle`, `info`).
 * A troca das ocorrências é por arquivo (PR 2 e PR 10); esta catraca garante
 * que o número só desce. Prova do vermelho no dia em que nasceu: 81
 * ocorrências em 34 arquivos com a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_OPACIDADE=1 npx vitest run tests/architecture/opacidade-sobre-token.test.ts`
 */
const OPACIDADE_SOBRE_TOKEN =
  /\b(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide|placeholder|accent|caret)-[a-z][a-z0-9-]*\/\d{1,3}\b/g;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "opacidade-sobre-token.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_OPACIDADE",
  conta: (arquivo) => arquivo.ocorrencias(OPACIDADE_SOBRE_TOKEN),
});

describe("opacidade sobre token de cor só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece a opacidade com e sem variante, e ignora a cor cheia", () => {
    expect(
      "border-border/60 hover:bg-primary/90 text-sidebar-foreground/70".match(
        OPACIDADE_SOBRE_TOKEN,
      ),
    ).toEqual(["border-border/60", "hover:bg-primary/90", "text-sidebar-foreground/70"]);
    expect(
      "bg-primary-subtle text-secondary border-border-subtle w-1/2".match(OPACIDADE_SOBRE_TOKEN),
    ).toBeNull();
  });
});
