import { describe, expect, it } from "vitest";

import { Selection, type SelectionScope } from "@/lib/selection";

/**
 * OO3-09b (Fase OO-3) — `Selection<TId>` é o tipo único de recorte que
 * unificou o `string[]` ambíguo das telas (gap/compare/roster: `[]` =
 * ninguém) com o `SelectionScope` do fluxo de Evolução (chips: `[]` =
 * todas). Cobre a semântica de vazio de cada construtor e as conversões
 * de/para o shape wire — a cobertura de tela existente (`gap-scope.test.ts`,
 * `architect-filter-select-all.test.tsx`, `evolution-filters-select.test.tsx`)
 * continua sendo a characterization do comportamento por tela.
 */
const items = [{ id: "ana" }, { id: "bruno" }, { id: "carla" }];

describe("Selection.explicit — pertencimento explícito ([] = ninguém)", () => {
  it("vazio significa ninguém, nunca 'todos' por atalho", () => {
    const none = Selection.explicit<string>([]);
    expect(none.apply(items)).toEqual([]);
    expect(none.isNone).toBe(true);
    expect(none.isAllVisible).toBe(false);
    expect(none.contains("ana")).toBe(false);
  });

  it("recorta por pertencimento preservando a ordem dos itens (contrato do applyArchitectFilter)", () => {
    const sel = Selection.explicit<string>(["carla", "ana"]);
    expect(sel.apply(items)).toEqual([{ id: "ana" }, { id: "carla" }]);
    expect(sel.contains("bruno")).toBe(false);
  });

  it("id que não existe mais no roster não quebra nem seleciona ninguém por acidente", () => {
    expect(Selection.explicit<string>(["fantasma"]).apply(items)).toEqual([]);
  });

  it("Selection.none é o vazio explícito", () => {
    expect(Selection.none<string>().apply(items)).toEqual([]);
    expect(Selection.none<string>().isNone).toBe(true);
  });
});

describe("Selection.allVisible", () => {
  it("contém qualquer id e devolve todos os itens", () => {
    const all = Selection.allVisible<string>();
    expect(all.apply(items)).toEqual(items);
    expect(all.contains("qualquer")).toBe(true);
    expect(all.isAllVisible).toBe(true);
    expect(all.isNone).toBe(false); // "todos" nunca é "ninguém"
  });
});

describe("Selection.fromToggleList — semântica de chips (Evolução)", () => {
  it("[] = todas visíveis (nada marcado = sem filtro), o único lugar onde vazio vira 'todos'", () => {
    expect(Selection.fromToggleList<string>([]).isAllVisible).toBe(true);
    expect(Selection.fromToggleList<string>([]).apply(items)).toEqual(items);
  });

  it("qualquer chip marcado vira pertencimento explícito", () => {
    const sel = Selection.fromToggleList<string>(["bruno"]);
    expect(sel.isAllVisible).toBe(false);
    expect(sel.apply(items)).toEqual([{ id: "bruno" }]);
  });
});

describe("conversões de/para SelectionScope (wire do fluxo de Evolução)", () => {
  it("toScope produz o shape byte-idêntico ao contrato existente", () => {
    expect(JSON.stringify(Selection.allVisible<string>().toScope())).toBe('{"mode":"ALL_VISIBLE"}');
    expect(JSON.stringify(Selection.explicit<string>(["cap-1", "cap-2"]).toScope())).toBe(
      '{"mode":"SELECTED","ids":["cap-1","cap-2"]}',
    );
    // O caso concreto da tela: chips vazios sempre viraram ALL_VISIBLE no payload.
    expect(JSON.stringify(Selection.fromToggleList<string>([]).toScope())).toBe(
      '{"mode":"ALL_VISIBLE"}',
    );
  });

  it("fromScope reidrata e faz o ciclo completo sem perder nada", () => {
    const selected: SelectionScope = { mode: "SELECTED", ids: ["ana"] };
    expect(Selection.fromScope(selected).toScope()).toEqual(selected);
    expect(Selection.fromScope({ mode: "ALL_VISIBLE" }).isAllVisible).toBe(true);
    // SELECTED vazio no wire continua sendo "ninguém" (Seção 44: nunca [] = todos).
    expect(Selection.fromScope({ mode: "SELECTED", ids: [] }).isNone).toBe(true);
  });

  it("toScope devolve uma cópia — mutar o payload não contamina a seleção", () => {
    const sel = Selection.explicit<string>(["ana"]);
    const scope = sel.toScope();
    if (scope.mode === "SELECTED") scope.ids.push("intruso");
    expect(sel.contains("intruso")).toBe(false);
    expect(sel.toScope()).toEqual({ mode: "SELECTED", ids: ["ana"] });
  });
});
