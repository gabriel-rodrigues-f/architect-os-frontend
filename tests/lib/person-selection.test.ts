import { describe, expect, it } from "vitest";

import type { Professional } from "@/lib/domain";
import { PersonPicker } from "@/lib/person-selection";

/**
 * Dono, 2026-09-06: "Progressão > Progressão do time: quando não há ninguém
 * cadastrado ainda vejo 'Todo o time'. Quero ver apenas a mensagem de Não há
 * pessoas cadastradas. ... não aplicamos orientação a objeto em todos estes
 * seletores ... Precisamos corrigir isso orientado a objeto e GoF tanto para a
 * mensagem quanto para o formato da combobox apresentado."
 *
 * `PersonPicker` é esse objeto: a forma (uma pessoa / várias com "Todo o time"
 * / várias com teto) é uma Strategy; o alcance vazio é tratado uma vez só, no
 * contexto — nenhuma forma oferece "Todo o time" de ninguém.
 */
const pessoa = (id: string, name: string): Professional => ({
  id,
  name,
  role: "Pleno",
  yearsAsProfessional: 3,
  specialization: "",
  email: `${id}@a.com`,
  active: true,
  version: 1,
});

const bruno = pessoa("bruno", "Bruno Almeida");
const ana = pessoa("ana", "Ana Martins");
const carla = pessoa("carla", "Carla Souza");
const time = [bruno, ana, carla];

describe("PersonPicker — alcance vazio (dono, 2026-09-06)", () => {
  it.each([
    ["uma pessoa", PersonPicker.one([], null)],
    ["várias com 'Todo o time'", PersonPicker.many([], [])],
    ["várias com teto", PersonPicker.upTo(2, [], [])],
  ])("na forma %s não há 'Todo o time' e o resumo é 'vazio'", (_forma, picker) => {
    expect(picker.isEmpty).toBe(true);
    expect(picker.offersWholeTeam).toBe(false);
    expect(picker.summary).toEqual({ kind: "empty" });
  });
});

describe("PersonPicker — uma pessoa", () => {
  it("escolher troca a pessoa, nunca acumula", () => {
    const picker = PersonPicker.one(time, "ana");
    expect(picker.pick("bruno")).toEqual(["bruno"]);
    expect(picker.isPicked("ana")).toBe(true);
    expect(picker.offersWholeTeam).toBe(false);
    expect(picker.many).toBe(false);
  });

  it("sem ninguém escolhido o resumo é 'ninguém'; com alguém, é o nome", () => {
    expect(PersonPicker.one(time, null).summary).toEqual({ kind: "none" });
    expect(PersonPicker.one(time, "").summary).toEqual({ kind: "none" });
    expect(PersonPicker.one(time, "ana").summary).toEqual({ kind: "one", name: "Ana Martins" });
  });

  it("a lista sai em ordem alfabética, seja qual for a ordem do alcance", () => {
    expect(PersonPicker.one(time, null).people.map((person) => person.id)).toEqual([
      "ana",
      "bruno",
      "carla",
    ]);
  });
});

describe("PersonPicker — várias com 'Todo o time'", () => {
  it("oferece 'Todo o time' quando há alguém no alcance", () => {
    expect(PersonPicker.many(time, []).offersWholeTeam).toBe(true);
  });

  it("'Todo o time' é um alternador de verdade: tudo marcado → nada; senão → todos", () => {
    expect(PersonPicker.many(time, ["ana", "bruno", "carla"]).toggleWholeTeam()).toEqual([]);
    expect(PersonPicker.many(time, ["ana"]).toggleWholeTeam()).toEqual(["ana", "bruno", "carla"]);
    expect(PersonPicker.many(time, []).toggleWholeTeam()).toEqual(["ana", "bruno", "carla"]);
  });

  it("a marca do mestre segue a seleção visível: marcado, desmarcado, indeterminado", () => {
    expect(PersonPicker.many(time, ["ana", "bruno", "carla"]).wholeTeamMark).toBe("checked");
    expect(PersonPicker.many(time, []).wholeTeamMark).toBe("unchecked");
    expect(PersonPicker.many(time, ["ana"]).wholeTeamMark).toBe("indeterminate");
  });

  it("um id que já saiu do alcance não conta como pessoa selecionada", () => {
    const picker = PersonPicker.many([ana, bruno], ["ana", "ninguem-mais"]);
    expect(picker.wholeTeamMark).toBe("indeterminate");
    expect(picker.summary).toEqual({ kind: "one", name: "Ana Martins" });
  });

  it("escolher alterna só a pessoa; o resumo conta pessoas", () => {
    expect(PersonPicker.many(time, []).pick("bruno")).toEqual(["bruno"]);
    expect(PersonPicker.many(time, ["ana", "bruno"]).pick("ana")).toEqual(["bruno"]);
    expect(PersonPicker.many(time, ["ana", "bruno"]).summary).toEqual({ kind: "count", n: 2 });
    expect(PersonPicker.many(time, ["ana", "bruno", "carla"]).summary).toEqual({
      kind: "wholeTeam",
      n: 3,
    });
    expect(PersonPicker.many(time, []).summary).toEqual({ kind: "none" });
  });
});

describe("PersonPicker — várias com teto (Comparativo)", () => {
  it("com teto não há 'Todo o time', mesmo com gente no alcance", () => {
    expect(PersonPicker.upTo(2, time, []).offersWholeTeam).toBe(false);
    expect(PersonPicker.upTo(2, time, []).max).toBe(2);
  });

  it("batido o teto, quem não está escolhido não pode ser marcado — e escolher não muda nada", () => {
    const picker = PersonPicker.upTo(2, time, ["ana", "bruno"]);
    expect(picker.canPick("carla")).toBe(false);
    expect(picker.pick("carla")).toEqual(["ana", "bruno"]);
  });

  it("desmarcar continua funcionando com o teto batido — senão a pessoa fica presa", () => {
    const picker = PersonPicker.upTo(2, time, ["ana", "bruno"]);
    expect(picker.canPick("ana")).toBe(true);
    expect(picker.pick("ana")).toEqual(["bruno"]);
  });
});

describe("PersonPicker.peopleIn — o recorte que a tela desenha", () => {
  it("seleção explícita: vazio é ninguém, ids fora do alcance somem", () => {
    expect(PersonPicker.peopleIn(time, [])).toEqual([]);
    expect(PersonPicker.peopleIn(time, ["bruno", "ninguem"]).map((person) => person.id)).toEqual([
      "bruno",
    ]);
  });
});
