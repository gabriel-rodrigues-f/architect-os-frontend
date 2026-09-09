import { describe, expect, it } from "vitest";

import type { CareerLevel } from "@/lib/domain";
import { TeamCareerLadderDraft } from "@/lib/view-models";

/**
 * Dono (2026-09-08): *"ao cadastrar/editar um time, quem administra escolhe
 * quais dos cinco níveis aquele time usa e em que ordem"*.
 *
 * O rascunho é o que a tela edita antes de gravar. As três decisões que ele
 * carrega, e que a tela não deve refazer:
 *
 *  (a) o que está NA escada vem primeiro, na ordem dos degraus; o que ficou de
 *      fora vem depois, na ordem do catálogo — senão marcar um nível o faria
 *      pular de lugar na lista e a pessoa perderia a linha que estava lendo;
 *  (b) marcar acrescenta no FIM da escada. Quem monta uma carreira monta de
 *      baixo para cima, e ordenar sozinho pelo `rank` do catálogo tiraria de
 *      quem administra a decisão que o dono acabou de dar a ele;
 *  (c) escada vazia é inválida — o time sem nível nenhum não tem carreira.
 */
const CATALOGO: readonly CareerLevel[] = [
  { id: "trainee", name: "Trainee", rank: 1 },
  { id: "junior", name: "Júnior", rank: 2 },
  { id: "pleno", name: "Pleno", rank: 3 },
  { id: "senior", name: "Sênior", rank: 4 },
  { id: "especialista", name: "Especialista", rank: 5 },
];

describe("TeamCareerLadderDraft", () => {
  it("lista o que está na escada primeiro, com o degrau, e o resto depois", () => {
    const draft = TeamCareerLadderDraft.of(CATALOGO, ["pleno", "trainee"]);

    expect(draft.rows.map((row) => [row.level.id, row.chosen, row.position])).toEqual([
      ["pleno", true, 1],
      ["trainee", true, 2],
      ["junior", false, null],
      ["senior", false, null],
      ["especialista", false, null],
    ]);
  });

  it("marcar acrescenta no fim da escada; desmarcar tira e reenumera os degraus", () => {
    const draft = TeamCareerLadderDraft.of(CATALOGO, ["trainee", "junior"]);

    expect(draft.toggling("senior").careerLevelIds).toEqual(["trainee", "junior", "senior"]);
    expect(draft.toggling("trainee").careerLevelIds).toEqual(["junior"]);
    expect(draft.toggling("trainee").rows[0]?.position).toBe(1);
  });

  it("sobe e desce um degrau, e não passa das pontas", () => {
    const draft = TeamCareerLadderDraft.of(CATALOGO, ["trainee", "junior", "pleno"]);

    expect(draft.movingUp("junior").careerLevelIds).toEqual(["junior", "trainee", "pleno"]);
    expect(draft.movingDown("junior").careerLevelIds).toEqual(["trainee", "pleno", "junior"]);
    expect(draft.movingUp("trainee").careerLevelIds).toEqual(["trainee", "junior", "pleno"]);
    expect(draft.movingDown("pleno").careerLevelIds).toEqual(["trainee", "junior", "pleno"]);
  });

  it("escada vazia é inválida; um nível já basta", () => {
    expect(TeamCareerLadderDraft.of(CATALOGO, []).isValid).toBe(false);
    expect(TeamCareerLadderDraft.of(CATALOGO, ["trainee"]).isValid).toBe(true);
  });

  it("ignora id que não está no catálogo — escada gravada com nível apagado não derruba a tela", () => {
    const draft = TeamCareerLadderDraft.of(CATALOGO, ["fantasma", "pleno"]);

    expect(draft.careerLevelIds).toEqual(["pleno"]);
  });

  it("sabe se mudou em relação ao que estava gravado — reordenar É mudança", () => {
    const draft = TeamCareerLadderDraft.of(CATALOGO, ["trainee", "junior"]);

    expect(draft.differsFrom(["trainee", "junior"])).toBe(false);
    expect(draft.differsFrom(["junior", "trainee"])).toBe(true);
    expect(draft.toggling("pleno").differsFrom(["trainee", "junior"])).toBe(true);
  });
});
