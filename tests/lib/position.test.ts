import { describe, expect, it } from "vitest";

import { PositionReading } from "@/lib/position";
import { fixtureCareerLevels } from "../helpers/fixtures";

/**
 * Dono (2026-09-06), tela Time: "Senioridade" vira "Posição". Para o
 * profissional, time + número da senioridade ("Integração I", "BTP II");
 * para o tech lead, "Tech Lead"; para o gerente, "Gerente".
 */
const t = (key: string) =>
  ({ "users.role.manager": "Gerente", "users.role.tech_lead": "Tech Lead" })[key] ?? key;
const TIMES = [
  { id: "time-integracao", name: "Integração", active: true },
  { id: "time-btp", name: "BTP", active: true },
];
const reading = new PositionReading(t as never, TIMES, fixtureCareerLevels);

describe("PositionReading — a posição na tela Time", () => {
  it("profissional: nome do time + senioridade em romano", () => {
    expect(
      reading.labelOf({
        cargo: "member",
        teamId: "time-integracao",
        careerLevelId: "arquiteto-de-solucoes-i",
        role: "Júnior",
      }),
    ).toBe("Integração I");
    expect(
      reading.labelOf({
        cargo: "member",
        teamId: "time-btp",
        careerLevelId: "arquiteto-de-solucoes-ii",
        role: "Pleno",
      }),
    ).toBe("BTP II");
  });

  it("tech lead e gerente são a posição, sem time nem senioridade", () => {
    expect(
      reading.labelOf({ cargo: "tech_lead", teamId: "time-btp", careerLevelId: null, role: null }),
    ).toBe("Tech Lead");
    expect(
      reading.labelOf({ cargo: "manager", teamId: "time-btp", careerLevelId: null, role: null }),
    ).toBe("Gerente");
  });

  it("sem time, fica a senioridade; sem nada, o travessão", () => {
    expect(
      reading.labelOf({
        cargo: null,
        teamId: null,
        careerLevelId: "arquiteto-de-solucoes-iii",
        role: "Sênior",
      }),
    ).toBe("III");
    expect(reading.labelOf({ cargo: null, teamId: null, careerLevelId: null, role: null })).toBe(
      "—",
    );
  });

  it("o gerente não é profissional; tech lead, membro e quem não tem conta são", () => {
    expect(PositionReading.isProfessional({ cargo: "manager" })).toBe(false);
    expect(PositionReading.isProfessional({ cargo: "tech_lead" })).toBe(true);
    expect(PositionReading.isProfessional({ cargo: "member" })).toBe(true);
    expect(PositionReading.isProfessional({ cargo: null })).toBe(true);
  });
});
