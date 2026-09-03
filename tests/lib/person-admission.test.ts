import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import type { SessionUser } from "@/lib/gateways/auth.gateway";
import type { TeamSummary } from "@/lib/gateways/teams.gateway";
import {
  AdmissionRefusal,
  PersonAdmission,
  PersonAdmissionPolicy,
  type PersonAdmissionValues,
} from "@/lib/person-admission";

/**
 * ONDA 37 — o cadastro unificado, do lado da tela. Pedido literal do dono:
 * *"O cadastro deve ser uma coisa só, ou seja, o que fazemos em Time e em
 * Usuários precisa estar conectado"*, e a escada de quem cadastra quem:
 * *"admin cadastra Gerente, Tech Lead e Membro em qualquer time; Gerente
 * cadastra Tech Lead e Membro só no seu time; Tech Lead cadastra Membro só
 * no seu time"*.
 *
 * A régua é do backend (`TeamStaffingGuard`, ADR-0084) e continua sendo — o
 * que estas classes fazem é impedir que a tela OFEREÇA o que o serviço vai
 * recusar. Por isso a política mora numa classe e não em `if` dentro do JSX
 * (frontend/REGRAS.md 4): a mesma pergunta é feita pelo seletor de cargo,
 * pelo seletor de time e pelo botão de salvar.
 */

const admin: SessionUser = {
  id: "conta-admin",
  email: "admin@empresa.com",
  name: "Admin",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const gestor: SessionUser = {
  ...admin,
  id: "conta-gestor",
  name: "Gestor",
  role: "manager",
  memberships: [{ teamId: "plataforma", role: "manager" }],
};

const techLead: SessionUser = {
  ...admin,
  id: "conta-tech-lead",
  name: "Tech Lead",
  role: "tech_lead",
  memberships: [{ teamId: "dados", role: "tech_lead" }],
};

const profissional: SessionUser = { ...admin, id: "conta-membro", name: "Membro", role: "member" };

const times: TeamSummary[] = [
  { id: "plataforma", name: "Plataforma", active: true },
  { id: "dados", name: "Dados", active: true },
  { id: "extinto", name: "Extinto", active: false },
];

const policy = new PersonAdmissionPolicy();

const valores = (patch: Partial<PersonAdmissionValues> = {}): PersonAdmissionValues => ({
  name: "Joana Prado",
  email: "joana@empresa.com",
  cargo: "member",
  careerLevelId: "arquiteto-de-solucoes-i",
  teamId: "plataforma",
  ...patch,
});

describe("quem cadastra quem — os cargos que cada persona pode admitir", () => {
  it("o admin admite gestor, tech lead e profissional", () => {
    expect(policy.admissibleCargos(admin)).toEqual(["manager", "tech_lead", "member"]);
  });

  it("o gestor admite tech lead e profissional — nunca outro gestor", () => {
    expect(policy.admissibleCargos(gestor)).toEqual(["tech_lead", "member"]);
  });

  it("o tech lead admite só profissional", () => {
    expect(policy.admissibleCargos(techLead)).toEqual(["member"]);
  });

  it("quem não lidera nada não admite ninguém", () => {
    expect(policy.admissibleCargos(profissional)).toEqual([]);
    expect(policy.admits(profissional)).toBe(false);
  });
});

describe("onde cada persona cadastra", () => {
  it("o admin vê todos os times ativos", () => {
    expect(policy.admissibleTeams(admin, times).map((team) => team.id)).toEqual([
      "plataforma",
      "dados",
    ]);
  });

  it("o gestor vê só o time em que ele é o gestor", () => {
    expect(policy.admissibleTeams(gestor, times).map((team) => team.id)).toEqual(["plataforma"]);
  });

  it("o tech lead vê só o time em que ele é o tech lead", () => {
    expect(policy.admissibleTeams(techLead, times).map((team) => team.id)).toEqual(["dados"]);
  });

  /**
   * O vínculo tem de falar o MESMO papel do cargo global — é a escada do
   * backend (`teamsOf(actor.id, [actor.role])`). Uma conta de gestor com
   * vínculo de tech lead num time não cadastra naquele time.
   */
  it("vínculo de papel diferente do cargo global não abre time nenhum", () => {
    const gestorComVinculoDeTechLead: SessionUser = {
      ...gestor,
      memberships: [{ teamId: "dados", role: "tech_lead" }],
    };
    expect(policy.admissibleTeams(gestorComVinculoDeTechLead, times)).toEqual([]);
  });

  it("time único já vem escolhido; com mais de um, ninguém escolhe pela pessoa", () => {
    expect(policy.preselectedTeamId(gestor, times)).toBe("plataforma");
    expect(policy.preselectedTeamId(admin, times)).toBeNull();
  });
});

describe("a nomeação: senioridade é do profissional, e só dele", () => {
  it("o profissional exige senioridade", () => {
    const semNivel = new PersonAdmission(valores({ careerLevelId: null }));
    expect(semNivel.seniorityApplies).toBe(true);
    expect(semNivel.isComplete).toBe(false);
    expect(semNivel.pending).toContain("seniority");
  });

  it("gestor e tech lead não têm senioridade — o campo some e não viaja", () => {
    const admissao = new PersonAdmission(
      valores({ cargo: "tech_lead", careerLevelId: "arquiteto-de-solucoes-i" }),
    );
    expect(admissao.seniorityApplies).toBe(false);
    expect(admissao.isComplete).toBe(true);
    expect(admissao.toRequest()).toEqual({
      name: "Joana Prado",
      email: "joana@empresa.com",
      role: "tech_lead",
      teamId: "plataforma",
    });
  });

  it("o time é obrigatório — não se cadastra pessoa fora de time", () => {
    const semTime = new PersonAdmission(valores({ teamId: null }));
    expect(semTime.isComplete).toBe(false);
    expect(semTime.pending).toContain("team");
  });

  it("nome e e-mail continuam obrigatórios", () => {
    const vazio = new PersonAdmission(valores({ name: "  ", email: "sem-arroba" }));
    expect(vazio.pending).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("o profissional completo viaja com a senioridade", () => {
    expect(new PersonAdmission(valores()).toRequest()).toEqual({
      name: "Joana Prado",
      email: "joana@empresa.com",
      role: "member",
      teamId: "plataforma",
      careerLevelId: "arquiteto-de-solucoes-i",
    });
  });
});

describe("a recusa do serviço aparece no campo, e trava o envio", () => {
  const recusa = (code: string, status: number, message: string) =>
    AdmissionRefusal.of(new ApiError(message, status, undefined, code), valores());

  it('"o time já tem gestor" fala no campo Time', () => {
    const refusal = recusa(
      "TEAM_ALREADY_HAS_MANAGER",
      409,
      "Este time já tem um gestor: Marina. Um time tem no máximo um gestor.",
    );
    expect(refusal?.field).toBe("team");
    expect(refusal?.message).toContain("Marina");
  });

  it("o 403 de quem não pode cadastrar aquele cargo fala no campo Cargo", () => {
    expect(recusa("PERSON_ADMISSION_FORBIDDEN", 403, "Como gestor você cadastra…")?.field).toBe(
      "cargo",
    );
  });

  it("e-mail já cadastrado fala no campo E-mail", () => {
    expect(recusa("EMAIL_ALREADY_REGISTERED", 409, "E-mail já cadastrado")?.field).toBe("email");
  });

  it("a recusa de senioridade fala no campo Senioridade", () => {
    expect(recusa("SENIORITY_REQUIRED_FOR_MEMBER", 400, "Escolha a senioridade")?.field).toBe(
      "seniority",
    );
  });

  /** Recusa sem campo conhecido não some: cai no rodapé do formulário. */
  it("recusa desconhecida vira erro de formulário, nunca silêncio", () => {
    expect(recusa("ALGO_NOVO", 500, "Falhou")?.field).toBe("form");
  });

  it("a recusa segura o envio enquanto o campo culpado não mudar", () => {
    const refusal = recusa("EMAIL_ALREADY_REGISTERED", 409, "E-mail já cadastrado");
    expect(refusal?.stillApplies(valores())).toBe(true);
    expect(refusal?.stillApplies(valores({ email: "outra@empresa.com" }))).toBe(false);
  });
});
