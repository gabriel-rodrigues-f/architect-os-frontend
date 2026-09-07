import { describe, expect, it } from "vitest";

import { TeamChoice } from "@/lib/team-choice";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
} from "../helpers/fixtures";

/**
 * Dono (2026-09-06): "Com perfil de Gerente e Tech Lead não deve ser possível
 * clicar em menus de mudança de time. O time atual deve ser fixado." Quem
 * lidera mais de um time continua escolhendo entre os dele; o admin escolhe
 * livremente. A decisão "escolhe × travado" mora AQUI, num objeto só, e as
 * três telas (Cadastrar pessoa, Régua do Time, Política de Progressão) só a
 * desenham.
 */
const plataforma = { id: "time-plataforma", name: "Plataforma" };
const dados = { id: "time-dados", name: "Dados" };

describe("TeamChoice — escolhe ou fica travado num time", () => {
  it("gerente de UM time fica travado nele", () => {
    const choice = TeamChoice.for(fixtureAssignedManagerUser, [plataforma]);
    expect(choice.locked).toBe(true);
    expect(choice.lockedTeam).toEqual(plataforma);
    expect(choice.resolve("time-dados")).toBe("time-plataforma");
  });

  it("tech lead de UM time também fica travado", () => {
    expect(TeamChoice.for(fixtureAssignedTechLeadUser, [plataforma]).locked).toBe(true);
  });

  it("quem lidera DOIS times escolhe entre os dele", () => {
    const choice = TeamChoice.for(fixtureAssignedManagerUser, [plataforma, dados]);
    expect(choice.locked).toBe(false);
    expect(choice.lockedTeam).toBeNull();
    expect(choice.resolve("time-dados")).toBe("time-dados");
  });

  it("o admin escolhe livremente — nem com um time só fica travado", () => {
    const choice = TeamChoice.for(fixtureAdminUser, [plataforma]);
    expect(choice.locked).toBe(false);
    expect(choice.resolve(null)).toBe("time-plataforma");
  });

  it("uma escolha fora do alcance cai no padrão: o primeiro time, ou o que a tela mandar", () => {
    const choice = TeamChoice.for(fixtureAssignedManagerUser, [plataforma, dados]);
    expect(choice.resolve("time-que-nao-existe")).toBe("time-plataforma");
    expect(choice.resolve("time-que-nao-existe", null)).toBeNull();
    expect(choice.resolve(null, null)).toBeNull();
  });

  it("sem time nenhum no alcance não há o que travar", () => {
    const choice = TeamChoice.for(fixtureAssignedManagerUser, []);
    expect(choice.locked).toBe(false);
    expect(choice.resolve(null)).toBeNull();
  });
});
