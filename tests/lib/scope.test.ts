import { describe, expect, it } from "vitest";

import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureTeamLeadUser,
  fixtureUnassignedLeadUser,
} from "../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 70) — `scope.ts` virou `UiAuthorizationPolicy`. OO3-08 — as funções
 * soltas de compatibilidade foram removidas junto com a migração dos call
 * sites; estes testes cobrem a classe diretamente.
 */
describe("UiAuthorizationPolicy", () => {
  const policy = new UiAuthorizationPolicy();
  const anaAsArchitect = { id: "ana", teamId: null };
  const anaInLedTeam = { id: "ana", teamId: "time-plataforma" };

  describe("canActFor", () => {
    it("admin pode agir sobre qualquer pessoa", () => {
      expect(policy.canActFor(fixtureAdminUser, anaAsArchitect)).toBe(true);
    });

    it("a própria pessoa pode agir sobre si mesma", () => {
      expect(policy.canActFor(fixtureMemberUser, anaAsArchitect)).toBe(true);
    });

    it("lead não age sobre arquiteto SEM TIME — a Fase 2 trocou o vínculo: sem time, sem dono", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
    });

    it("lead age sobre arquiteto com time — o recorte do servidor (ADR-0035) só lhe entrega times que ele lidera", () => {
      expect(policy.canActFor(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
    });

    it("sem architect, ninguém além do admin pode agir", () => {
      expect(policy.canActFor(fixtureMemberUser, undefined)).toBe(false);
      expect(policy.canActFor(fixtureAdminUser, undefined)).toBe(true);
    });
  });

  describe("isLeadOf", () => {
    it("admin conta como lead (bypass de dono)", () => {
      expect(policy.isLeadOf(fixtureAdminUser, anaAsArchitect)).toBe(true);
    });

    it("a própria pessoa NÃO é lead de si mesma", () => {
      expect(policy.isLeadOf(fixtureMemberUser, anaAsArchitect)).toBe(false);
      expect(policy.isLeadOf({ ...fixtureMemberUser, role: "lead" }, anaInLedTeam)).toBe(false);
    });

    it("lead responde true para arquiteto com time, false para arquiteto sem time", () => {
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
      expect(policy.isLeadOf(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
    });
  });

  describe("isAssignedTechLeadOf", () => {
    it("NÃO tem bypass de admin — reabertura de PDI é só do lead responsável", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(false);
    });

    it("o lead do time responde true", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedLeadUser, anaInLedTeam)).toBe(true);
    });

    it("arquiteto sem time responde false", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedLeadUser, anaAsArchitect)).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("só a conta admin responde true", () => {
      expect(policy.isAdmin(fixtureAdminUser)).toBe(true);
      expect(policy.isAdmin(fixtureMemberUser)).toBe(false);
      expect(policy.isAdmin(fixtureUnassignedLeadUser)).toBe(false);
    });
  });
});

/**
 * Fase C, tela 1 — quem rege a régua de um time. É o invariante de SEGURANÇA
 * da tela: na onda 17 a calibração abriu para `member` por URL direta e virou
 * o primeiro "NÃO mergear" do projeto. Aqui os DOIS eixos do ADR-0035 são
 * exigidos juntos, como o backend os exige em `isLeadOfTeam`: o papel diz o
 * que a conta PODE, o vínculo (`memberships`, onda 17.1) diz ONDE ela vale.
 */
describe("canConfigureRulesOf — o dono da régua do time", () => {
  const policy = new UiAuthorizationPolicy();
  const TIME = "time-plataforma";
  const OUTRO_TIME = "time-integracao";

  it("NEGA para member, sempre — a régua nunca foi dele", () => {
    expect(policy.canConfigureRulesOf(fixtureMemberUser, TIME)).toBe(false);
  });

  it("NEGA para member mesmo com vínculo de tech lead no time — papel E vínculo, juntos", () => {
    const memberComVinculo = {
      ...fixtureMemberUser,
      memberships: [{ teamId: TIME, role: "tech_lead" as const }],
    };

    expect(policy.canConfigureRulesOf(memberComVinculo, TIME)).toBe(false);
  });

  it("NEGA para lead SEM vínculo com aquele time", () => {
    expect(policy.canConfigureRulesOf(fixtureUnassignedLeadUser, TIME)).toBe(false);
    expect(policy.canConfigureRulesOf(fixtureTeamLeadUser, OUTRO_TIME)).toBe(false);
  });

  it("NEGA para lead cujo vínculo naquele time é só de membro", () => {
    const leadSoMembro = {
      ...fixtureTeamLeadUser,
      memberships: [{ teamId: TIME, role: "member" as const }],
    };

    expect(policy.canConfigureRulesOf(leadSoMembro, TIME)).toBe(false);
  });

  it("CONCEDE para lead COM vínculo de tech lead no time", () => {
    expect(policy.canConfigureRulesOf(fixtureTeamLeadUser, TIME)).toBe(true);
  });

  it("CONCEDE para lead COM vínculo de gestor no time — gestor multi-time é N vínculos", () => {
    const gestor = {
      ...fixtureTeamLeadUser,
      memberships: [
        { teamId: TIME, role: "manager" as const },
        { teamId: OUTRO_TIME, role: "manager" as const },
      ],
    };

    expect(policy.canConfigureRulesOf(gestor, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(gestor, OUTRO_TIME)).toBe(true);
  });

  it("CONCEDE para admin, com ou sem vínculo", () => {
    expect(policy.canConfigureRulesOf(fixtureAdminUser, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(fixtureAdminUser, OUTRO_TIME)).toBe(true);
  });
});

describe("configurableTeamIds — quais réguas a tela pode oferecer", () => {
  const policy = new UiAuthorizationPolicy();

  it("admin alcança todos os times", () => {
    expect(policy.configurableTeamIds(fixtureAdminUser)).toBe("all");
  });

  it("lead alcança só os times onde tem vínculo que concede escopo", () => {
    const escopo = policy.configurableTeamIds(fixtureTeamLeadUser);

    expect(escopo).not.toBe("all");
    expect([...(escopo as ReadonlySet<string>)]).toEqual(["time-plataforma"]);
  });

  it("member não alcança time nenhum", () => {
    expect([...(policy.configurableTeamIds(fixtureMemberUser) as ReadonlySet<string>)]).toEqual([]);
  });

  it("canConfigureAnyTeamRules resume o alcance para a guarda de rota", () => {
    expect(policy.canConfigureAnyTeamRules(fixtureAdminUser)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(fixtureTeamLeadUser)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(fixtureUnassignedLeadUser)).toBe(false);
    expect(policy.canConfigureAnyTeamRules(fixtureMemberUser)).toBe(false);
  });
});

/**
 * O limite que o cabeçalho de `scope.ts` registrava como pergunta de contrato:
 * o lead-arquiteto que lidera o PRÓPRIO time não se distinguia, e a UI lhe
 * escondia ações que o backend permitia. Com `memberships` na sessão ele
 * passa a se distinguir — e só quando o vínculo existe.
 */
describe("o lead-arquiteto que lidera o próprio time", () => {
  const policy = new UiAuthorizationPolicy();
  const eleMesmo = { id: "ana", teamId: "time-plataforma" };
  const leadArquiteto = {
    ...fixtureTeamLeadUser,
    architectId: "ana",
    memberships: [{ teamId: "time-plataforma", role: "tech_lead" as const }],
  };

  it("é lead de si mesmo quando o vínculo diz que ele lidera aquele time", () => {
    expect(policy.isLeadOf(leadArquiteto, eleMesmo)).toBe(true);
  });

  it("sem vínculo, nada muda: continua não sendo lead de si mesmo", () => {
    expect(policy.isLeadOf({ ...leadArquiteto, memberships: [] }, eleMesmo)).toBe(false);
  });
});
