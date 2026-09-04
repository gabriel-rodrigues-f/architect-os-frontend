import { describe, expect, it } from "vitest";

import { TeamOrLevelChange } from "@/lib/view-models/team-view-model";
import type { Architect } from "@/lib/domain";

/**
 * Pedido do dono (2026-09-03), diante do diálogo "Mudar time ou nível":
 * *"se eu estiver mudando o nível, quero ver 'Por que o nível de carreira
 * está mudando?'; se eu estiver mudando o time, 'Por que o time está
 * mudando?'"*.
 *
 * A pergunta é do que está mudando, e quem sabe o que está mudando é o
 * próprio objeto da mudança — não a tela.
 */
describe("TeamOrLevelChange — a pergunta do motivo segue o que muda", () => {
  const pessoa = {
    id: "arq-1",
    name: "Gabriel Marangoni",
    role: "Pleno",
    teamId: "time-arquitetura",
  } as unknown as Architect;

  it("mudando só o nível, pergunta pelo nível", () => {
    const mudanca = new TeamOrLevelChange(pessoa, "Sênior", "time-arquitetura");

    expect(mudanca.reasonPlaceholderKey).toBe("team.transition.reasonPlaceholder.level");
  });

  it("mudando só o time, pergunta pelo time", () => {
    const mudanca = new TeamOrLevelChange(pessoa, "", "time-basis");

    expect(mudanca.reasonPlaceholderKey).toBe("team.transition.reasonPlaceholder.team");
  });

  it("mudando os dois, pergunta pelos dois", () => {
    const mudanca = new TeamOrLevelChange(pessoa, "Sênior", "time-basis");

    expect(mudanca.reasonPlaceholderKey).toBe("team.transition.reasonPlaceholder");
  });

  it("sem mudança nenhuma, a pergunta é a das duas coisas — nada mudou ainda", () => {
    const mudanca = new TeamOrLevelChange(pessoa, "", "time-arquitetura");

    expect(mudanca.reasonPlaceholderKey).toBe("team.transition.reasonPlaceholder");
  });
});
