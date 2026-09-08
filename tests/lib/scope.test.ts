import { describe, expect, it } from "vitest";

import type { SessionUser, UserRole } from "@/lib/api";
import type { TeamMembership } from "@/lib/gateways/auth.gateway";
import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
} from "../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 70) — `scope.ts` virou `UiAuthorizationPolicy`. OO3-08 — as funções
 * soltas de compatibilidade foram removidas junto com a migração dos call
 * sites; estes testes cobrem a classe diretamente.
 */
describe("UiAuthorizationPolicy", () => {
  const policy = new UiAuthorizationPolicy();
  const anaAsProfessional = { id: "ana", teamId: null };
  const anaInLedTeam = { id: "ana", teamId: "time-plataforma" };

  describe("canActFor", () => {
    it("o administrador (ADMIN) age por qualquer pessoa, com ou sem time — ela faz tudo (dono, 2026-09-08, regra 6)", () => {
      expect(policy.canActFor(fixtureAdminUser, anaAsProfessional)).toBe(true);
      expect(policy.canActFor(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.canReadAbout(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.actsForTheOrganization(fixtureAdminUser)).toBe(true);
    });

    it("o suporte NÃO age por ninguém — opera o sistema, não as pessoas (D1, 2026-09-05)", () => {
      expect(policy.canActFor(fixtureSupportUser, anaAsProfessional)).toBe(false);
      expect(policy.canActFor(fixtureSupportUser, anaInLedTeam)).toBe(false);
      expect(policy.actsForTheOrganization(fixtureSupportUser)).toBe(false);
      // Só LÊ, em modo de suporte — a tela pede o motivo antes de abrir a ficha.
      expect(policy.canReadAbout(fixtureSupportUser, anaInLedTeam)).toBe(true);
    });

    it("o limite de todos vale para o administrador: não age sobre si", () => {
      const diretoraComFicha = { ...fixtureAdminUser, professionalId: "ana" };
      expect(policy.canActFor(diretoraComFicha, anaInLedTeam)).toBe(false);
      expect(policy.isLeadOf(diretoraComFicha, anaInLedTeam)).toBe(false);
      expect(policy.decidesCareerOf(diretoraComFicha, anaInLedTeam)).toBe(false);
      expect(policy.canActFor(diretoraComFicha, { id: "bruno", teamId: null })).toBe(true);
    });

    it("ninguém age sobre si — nem o profissional (dono, 2026-09-06): a autoavaliação, a evidência e o PDI dele são registrados por quem o lidera", () => {
      expect(policy.canActFor(fixtureMemberUser, anaAsProfessional)).toBe(false);
      expect(policy.actsOnSelf(fixtureMemberUser, "ana")).toBe(false);
      // Ele continua LENDO tudo o que é dele.
      expect(policy.readsOwn(fixtureMemberUser, "ana")).toBe(true);
      expect(policy.canReadAbout(fixtureMemberUser, anaAsProfessional)).toBe(true);
    });

    it("exceção mantida (dono, 2026-09-06): o progresso na PRÓPRIA trilha é do profissional — e de quem o lidera", () => {
      expect(policy.recordsTrailProgressOf(fixtureMemberUser, anaAsProfessional)).toBe(true);
      expect(policy.recordsTrailProgressOf(fixtureAssignedTechLeadUser, anaInLedTeam)).toBe(true);
      const techLeadAna = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };
      expect(policy.recordsTrailProgressOf(techLeadAna, anaInLedTeam)).toBe(false);
    });

    it("quem ESCOLHE pessoa é quem lidera; o profissional não busca outros membros em parte nenhuma (dono, 2026-09-06)", () => {
      expect(policy.picksPeople(fixtureMemberUser)).toBe(false);
      expect(policy.picksPeople(fixtureAssignedTechLeadUser)).toBe(true);
      expect(policy.picksPeople(fixtureAssignedManagerUser)).toBe(true);
    });

    it("o tech lead NUNCA age sobre si (dono, 2026-09-06): não se avalia, não abre PDI nem roteiro próprio; só lê", () => {
      const techLeadAna = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };
      expect(policy.canActFor(techLeadAna, anaInLedTeam)).toBe(false);
      expect(policy.isLeadOf(techLeadAna, anaInLedTeam)).toBe(false);
      expect(policy.isAssignedTechLeadOf(techLeadAna, anaInLedTeam)).toBe(false);
      expect(policy.assessableBy(techLeadAna, [anaInLedTeam])).toEqual([]);
      expect(policy.canReadAbout(techLeadAna, anaInLedTeam)).toBe(true);
    });

    it("lead não age sobre profissional SEM TIME — a Fase 2 trocou o vínculo: sem time, sem dono", () => {
      expect(policy.canActFor(fixtureUnassignedTechLeadUser, anaAsProfessional)).toBe(false);
    });

    it("lead age sobre profissional com time SÓ com vínculo naquele time — o atalho 'qualquer outra pessoa' morreu (inconsistência G)", () => {
      expect(policy.canActFor(fixtureAssignedTechLeadUser, anaInLedTeam)).toBe(true);
      expect(policy.canActFor(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(false);
    });

    it("sem professional, ninguém age", () => {
      expect(policy.canActFor(fixtureMemberUser, undefined)).toBe(false);
      expect(policy.canActFor(fixtureAdminUser, undefined)).toBe(false);
    });
  });

  describe("isLeadOf", () => {
    it("o administrador lidera qualquer pessoa (regra 6); o suporte, ninguém (D1)", () => {
      expect(policy.isLeadOf(fixtureAdminUser, anaAsProfessional)).toBe(true);
      expect(policy.isLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.isLeadOf(fixtureSupportUser, anaAsProfessional)).toBe(false);
      expect(policy.isLeadOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
    });

    it("a própria pessoa NÃO é lead de si mesma", () => {
      expect(policy.isLeadOf(fixtureMemberUser, anaAsProfessional)).toBe(false);
      expect(policy.isLeadOf({ ...fixtureMemberUser, role: "tech_lead" }, anaInLedTeam)).toBe(
        false,
      );
    });

    it("lead responde true para profissional do time onde tem vínculo, false sem time e sem vínculo", () => {
      expect(policy.isLeadOf(fixtureAssignedTechLeadUser, anaAsProfessional)).toBe(false);
      expect(policy.isLeadOf(fixtureAssignedTechLeadUser, anaInLedTeam)).toBe(true);
      expect(policy.isLeadOf(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(false);
    });
  });

  /**
   * Dono, 2026-09-05: "gerente pode ver tech lead e profissionais; tech lead vê
   * profissionais; nunca a si mesmos nessa tela". Quem lidera avalia e mentora
   * OUTRA pessoa; o profissional continua vendo a si mesmo em Avaliações,
   * porque a autoavaliação é dele.
   */
  describe("assessableBy — quem aparece no seletor de Avaliações", () => {
    const ana = { id: "ana", teamId: "time-plataforma" };
    const bia = { id: "bia", teamId: "time-plataforma" };

    it("tech lead com ficha própria NÃO se vê na lista — ele não se avalia (dono, 2026-09-06)", () => {
      const techLeadAna = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };
      expect(policy.assessableBy(techLeadAna, [bia, ana])).toEqual([bia]);
    });

    it("gerente com ficha própria também não se vê — só os liderados", () => {
      const managerAna = {
        ...fixtureAssignedManagerUser,
        professionalId: "ana",
      };
      expect(policy.assessableBy(managerAna, [bia, ana])).toEqual([bia]);
    });

    it("o profissional vê só a si mesmo — em leitura (dono, 2026-09-06)", () => {
      expect(policy.assessableBy(fixtureMemberUser, [ana])).toEqual([ana]);
      expect(policy.assessableBy(fixtureMemberUser, [ana, bia])).toEqual([ana]);
    });

    it("liderança sem ficha vê todo o alcance", () => {
      expect(policy.assessableBy(fixtureAssignedTechLeadUser, [ana, bia])).toEqual([ana, bia]);
    });
  });

  describe("mentorableBy — quem pode ser mentorado", () => {
    const ana = { id: "ana", teamId: "time-plataforma" };
    const bia = { id: "bia", teamId: "time-plataforma" };

    it("ninguém mentora a si mesmo, nem o profissional", () => {
      const techLeadAna = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };
      expect(policy.mentorableBy(techLeadAna, [ana, bia])).toEqual([bia]);
      expect(policy.mentorableBy(fixtureMemberUser, [ana])).toEqual([]);
    });
  });

  describe("isAssignedTechLeadOf", () => {
    it("o administrador dispensa o vínculo estrito (regra 6); o suporte não tem bypass — reabertura de PDI é do Tech Lead responsável", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.isAssignedManagerOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.isAssignedTechLeadOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
      expect(policy.isAssignedManagerOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
    });

    it("o Tech Lead COM vínculo naquele time responde true", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAssignedTechLeadUser, anaInLedTeam)).toBe(true);
    });

    it("o Tech Lead SEM vínculo responde false — o poder estrito não herda o alcance", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(false);
    });

    it("profissional sem time responde false", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAssignedTechLeadUser, anaAsProfessional)).toBe(
        false,
      );
    });
  });

  /**
   * PR 5 (adendo do dono, 2026-09-08, item 2) — `isAdmin` morreu porque fazia
   * duas perguntas com um nome só. `operatesTheSystem` é o que o antigo admin
   * fazia (contas, times, catálogo, ciclos, configurações) e vale para ADMIN
   * e SUPPORT; `readsTheOrganization` é só do administrador.
   */
  describe("operatesTheSystem / readsTheOrganization", () => {
    it("ADMIN e SUPPORT operam o sistema; os papéis de time não", () => {
      expect(policy.operatesTheSystem(fixtureAdminUser)).toBe(true);
      expect(policy.operatesTheSystem(fixtureSupportUser)).toBe(true);
      expect(policy.operatesTheSystem(fixtureAssignedManagerUser)).toBe(false);
      expect(policy.operatesTheSystem(fixtureMemberUser)).toBe(false);
      expect(policy.operatesTheSystem(fixtureUnassignedTechLeadUser)).toBe(false);
    });

    it("só ADMIN lê a organização inteira", () => {
      expect(policy.readsTheOrganization(fixtureAdminUser)).toBe(true);
      expect(policy.readsTheOrganization(fixtureSupportUser)).toBe(false);
      expect(policy.readsTheOrganization(fixtureAssignedManagerUser)).toBe(false);
    });

    it("SUPPORT lê sobre pessoas SÓ em modo de suporte, por ticket; ADMIN lê sem ticket", () => {
      expect(policy.readsPeopleOnlyInSupportMode(fixtureSupportUser)).toBe(true);
      expect(policy.readsPeopleOnlyInSupportMode(fixtureAdminUser)).toBe(false);
      expect(policy.readsPeopleOnlyInSupportMode(fixtureAssignedManagerUser)).toBe(false);
      expect(policy.canReadAbout(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.canReadAbout(fixtureSupportUser, anaInLedTeam)).toBe(true);
      expect(policy.canReadPersonnelFileOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.canReadPersonnelFileOf(fixtureSupportUser, anaInLedTeam)).toBe(true);
    });

    it("ADMIN age, lidera, calibra, decide, agenda follow-up e edita trilha; SUPPORT nada disso (regra 6)", () => {
      expect(policy.canActFor(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.isLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.canCalibrate(fixtureAdminUser)).toBe(true);
      expect(policy.decidesCareerOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.managesTeam(fixtureAdminUser, "time-plataforma")).toBe(true);
      expect(policy.schedulesMentoringFollowUpOf(fixtureAdminUser, { mentorUserId: "x" })).toBe(
        true,
      );
      expect(policy.createsLearningPath(fixtureAdminUser)).toBe(true);
      expect(policy.editsLearningPath(fixtureAdminUser, { createdByUserId: "x" })).toBe(true);
      expect(policy.mentorableBy(fixtureAdminUser, [anaInLedTeam, anaAsProfessional])).toEqual([
        anaInLedTeam,
        anaAsProfessional,
      ]);
      expect(policy.assessableBy(fixtureAdminUser, [anaInLedTeam])).toEqual([anaInLedTeam]);

      expect(policy.canActFor(fixtureSupportUser, anaInLedTeam)).toBe(false);
      expect(policy.isLeadOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
      expect(policy.canCalibrate(fixtureSupportUser)).toBe(false);
      expect(policy.decidesCareerOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
      expect(policy.managesTeam(fixtureSupportUser, "time-plataforma")).toBe(false);
      expect(policy.schedulesMentoringFollowUpOf(fixtureSupportUser, { mentorUserId: "x" })).toBe(
        false,
      );
      expect(policy.createsLearningPath(fixtureSupportUser)).toBe(false);
      expect(policy.editsLearningPath(fixtureSupportUser, { createdByUserId: null })).toBe(false);
      expect(policy.mentorableBy(fixtureSupportUser, [anaInLedTeam])).toEqual([]);
      expect(policy.assessableBy(fixtureSupportUser, [anaInLedTeam])).toEqual([]);
    });

    it("ADMIN lê a organização: análise de time, Avaliações, PDI e Mentoria sem vínculo; SUPPORT sem vínculo não", () => {
      expect(policy.canAnalyzeTeam(fixtureAdminUser)).toBe(true);
      expect(policy.worksWithPeople(fixtureAdminUser)).toBe(true);
      expect(policy.canAnalyzeTeam(fixtureSupportUser)).toBe(false);
      expect(policy.worksWithPeople(fixtureSupportUser)).toBe(false);
    });

    it("os dois administram contas e times e alcançam todos os times; só o administrador decide carreira", () => {
      for (const conta of [fixtureAdminUser, fixtureSupportUser]) {
        expect(policy.canAdministerPeople(conta), conta.role).toBe(true);
        expect(policy.configurableTeamIds(conta), conta.role).toBe("all");
        expect(policy.composableTeamIds(conta), conta.role).toBe("all");
      }
      expect(policy.decidesCareerOf(fixtureAdminUser, anaInLedTeam)).toBe(true);
      expect(policy.decidesCareerOf(fixtureSupportUser, anaInLedTeam)).toBe(false);
    });

    it("Métricas da Plataforma: todos menos o member (adendo 5, 2026-09-08)", () => {
      expect(policy.readsPlatformMetrics(fixtureAdminUser)).toBe(true);
      expect(policy.readsPlatformMetrics(fixtureSupportUser)).toBe(true);
      expect(policy.readsPlatformMetrics(fixtureAssignedManagerUser)).toBe(true);
      expect(policy.readsPlatformMetrics(fixtureUnassignedTechLeadUser)).toBe(true);
      expect(policy.readsPlatformMetrics(fixtureMemberUser)).toBe(false);
    });

    it("o seletor de papel: SUPPORT não atribui ADMIN; ADMIN atribui todos; o gerente não atribui papel", () => {
      expect(policy.assignableRoles(fixtureAdminUser)).toEqual([
        "admin",
        "support",
        "manager",
        "tech_lead",
        "member",
      ]);
      expect(policy.assignableRoles(fixtureSupportUser)).toEqual([
        "support",
        "manager",
        "tech_lead",
        "member",
      ]);
      expect(policy.assignableRoles(fixtureAssignedManagerUser)).toEqual([]);
    });

    it("SUPPORT não muda o status de uma conta de ADMIN; ADMIN muda a de qualquer outra pessoa", () => {
      const contaDoAdministrador = { id: "diretor", status: "active", role: "admin" };
      const contaDoSuporte = { id: "outro-suporte", status: "active", role: "support" };
      expect(policy.administersAccount(fixtureSupportUser, contaDoAdministrador)).toBe(false);
      expect(policy.administersAccount(fixtureSupportUser, contaDoSuporte)).toBe(true);
      expect(policy.administersAccount(fixtureAdminUser, contaDoAdministrador)).toBe(true);
      expect(policy.administersAccount(fixtureAdminUser, contaDoSuporte)).toBe(true);
      // O gerente não altera conta de organização nem de gerente.
      expect(policy.administersAccount(fixtureAssignedManagerUser, contaDoSuporte)).toBe(false);
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
    expect(policy.canConfigureRulesOf(fixtureUnassignedTechLeadUser, TIME)).toBe(false);
    expect(policy.canConfigureRulesOf(fixtureAssignedTechLeadUser, OUTRO_TIME)).toBe(false);
  });

  it("NEGA para lead cujo vínculo naquele time é só de membro", () => {
    const leadSoMembro = {
      ...fixtureAssignedTechLeadUser,
      memberships: [{ teamId: TIME, role: "member" as const }],
    };

    expect(policy.canConfigureRulesOf(leadSoMembro, TIME)).toBe(false);
  });

  it("CONCEDE para lead COM vínculo de tech lead no time", () => {
    expect(policy.canConfigureRulesOf(fixtureAssignedTechLeadUser, TIME)).toBe(true);
  });

  it("CONCEDE para lead COM vínculo de gerente no time — gerente multi-time é N vínculos", () => {
    const gerente = {
      ...fixtureAssignedManagerUser,
      memberships: [
        { teamId: TIME, role: "manager" as const },
        { teamId: OUTRO_TIME, role: "manager" as const },
      ],
    };

    expect(policy.canConfigureRulesOf(gerente, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(gerente, OUTRO_TIME)).toBe(true);
  });

  it("CONCEDE para o administrador em qualquer time (regra 6); NEGA para o suporte, que só lê", () => {
    expect(policy.canConfigureRulesOf(fixtureAdminUser, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(fixtureAdminUser, OUTRO_TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(fixtureSupportUser, TIME)).toBe(false);
    expect(policy.canConfigureRulesOf(fixtureSupportUser, OUTRO_TIME)).toBe(false);
  });
});

describe("configurableTeamIds — quais réguas a tela pode oferecer", () => {
  const policy = new UiAuthorizationPolicy();

  it("admin alcança todos os times", () => {
    expect(policy.configurableTeamIds(fixtureAdminUser)).toBe("all");
  });

  it("lead alcança só os times onde tem vínculo que concede escopo", () => {
    const escopo = policy.configurableTeamIds(fixtureAssignedTechLeadUser);

    expect(escopo).not.toBe("all");
    expect([...(escopo as ReadonlySet<string>)]).toEqual(["time-plataforma"]);
  });

  it("member não alcança time nenhum", () => {
    expect([...(policy.configurableTeamIds(fixtureMemberUser) as ReadonlySet<string>)]).toEqual([]);
  });

  it("canConfigureAnyTeamRules resume o alcance para a guarda de rota", () => {
    expect(policy.canConfigureAnyTeamRules(fixtureAdminUser)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(fixtureAssignedTechLeadUser)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(fixtureUnassignedTechLeadUser)).toBe(false);
    expect(policy.canConfigureAnyTeamRules(fixtureMemberUser)).toBe(false);
  });
});

/**
 * O limite que o cabeçalho de `scope.ts` registrava como pergunta de contrato:
 * o lead-profissional que lidera o PRÓPRIO time não se distinguia, e a UI lhe
 * escondia ações que o backend permitia. Com `memberships` na sessão ele
 * passa a se distinguir — e só quando o vínculo existe.
 */
describe("o lead-profissional que lidera o próprio time", () => {
  const policy = new UiAuthorizationPolicy();
  const eleMesmo = { id: "ana", teamId: "time-plataforma" };
  const leadProfissional = {
    ...fixtureAssignedTechLeadUser,
    professionalId: "ana",
    memberships: [{ teamId: "time-plataforma", role: "tech_lead" as const }],
  };

  /**
   * 2026-09-05 — virou: NA PRÓPRIA FICHA, NINGUÉM É LÍDER. O dono viu gerente e
   * tech lead na própria ficha com roteiro de 1:1 consigo mesmos e "revisar"
   * as próprias evidências. O vínculo com o time continua valendo para os
   * OUTROS do time; para si, não há liderança.
   */
  it("NÃO é lead de si mesmo, mesmo liderando o próprio time", () => {
    expect(policy.isLeadOf(leadProfissional, eleMesmo)).toBe(false);
  });

  it("a própria ficha não tem ação: nem para o líder, nem para o admin com profissional", () => {
    expect(policy.canActOnCareerFileOf(leadProfissional, eleMesmo)).toBe(false);
    expect(
      policy.canActOnCareerFileOf({ ...fixtureAdminUser, professionalId: "ana" }, eleMesmo),
    ).toBe(false);
    expect(policy.isLeadOf({ ...fixtureAdminUser, professionalId: "ana" }, eleMesmo)).toBe(false);
  });

  it("na ficha de um liderado, o líder continua agindo e liderando", () => {
    const liderado = { id: "bruno", teamId: "time-plataforma" };
    expect(policy.isLeadOf(leadProfissional, liderado)).toBe(true);
    expect(policy.canActOnCareerFileOf(leadProfissional, liderado)).toBe(true);
  });

  it("sem vínculo, nada muda: continua não sendo lead de si mesmo", () => {
    expect(policy.isLeadOf({ ...leadProfissional, memberships: [] }, eleMesmo)).toBe(false);
  });
});

/**
 * ADR-0047 do backend — `users.role` deixou de ser `(admin, lead, member)` e
 * passou a `(admin, manager, tech_lead, member)`. Nenhum zod valida
 * `/auth/me` aqui: com o backend novo e a política velha não há erro de
 * parse, o ramo errado é escolhido em silêncio. Estes casos são o oráculo
 * dos dois eixos do ADR:
 *
 *   ALCANCE = união dos times com vínculo de liderança, exigido papel de
 *   liderança (gerente OU tech lead);
 *   PODER ESTRITO = papel global E vínculo NAQUELE time, os dois iguais.
 */
describe("os quatro papéis — alcance é união, poder é estrito", () => {
  const policy = new UiAuthorizationPolicy();
  const TIME = "time-plataforma";
  const OUTRO_TIME = "time-integracao";
  const anaNoTime = { id: "ana", teamId: TIME };

  const conta = (role: UserRole, memberships: readonly TeamMembership[]): SessionUser => ({
    ...fixtureMemberUser,
    id: `conta-${role}`,
    professionalId: null,
    role,
    memberships,
  });

  const gerente = conta("manager", [{ teamId: TIME, role: "manager" }]);
  const techLead = conta("tech_lead", [{ teamId: TIME, role: "tech_lead" }]);
  const doisChapeus = conta("manager", [
    { teamId: TIME, role: "manager" },
    { teamId: OUTRO_TIME, role: "tech_lead" },
  ]);

  it("o gerente alcança o roster do time onde tem vínculo", () => {
    expect(policy.isLeadOf(gerente, anaNoTime)).toBe(true);
    expect(policy.canActFor(gerente, anaNoTime)).toBe(true);
  });

  it("o tech lead alcança o roster do time onde tem vínculo", () => {
    expect(policy.isLeadOf(techLead, anaNoTime)).toBe(true);
    expect(policy.canActFor(techLead, anaNoTime)).toBe(true);
  });

  it("os dois regem a régua do time onde têm vínculo", () => {
    expect(policy.canConfigureRulesOf(gerente, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(techLead, TIME)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(gerente)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(techLead)).toBe(true);
  });

  /**
   * PR 5 (adendo do dono, 2026-09-08, itens 3 e 4) — "um tech lead nunca
   * está em mais de um time" e um gerente lidera N times COMO gerente. A
   * conta de dois chapéus morreu: o vínculo que concede alcance é o do
   * PRÓPRIO papel. Um gerente com vínculo de tech lead noutro time não
   * alcança aquele time por esse vínculo.
   */
  it("não há conta de dois chapéus — o alcance vem só dos vínculos do próprio papel", () => {
    expect([...(policy.configurableTeamIds(doisChapeus) as ReadonlySet<string>)]).toEqual([TIME]);
    expect(policy.canConfigureRulesOf(doisChapeus, OUTRO_TIME)).toBe(false);
    expect(policy.isLeadOf(doisChapeus, { id: "bia", teamId: OUTRO_TIME })).toBe(false);
  });

  it("member com vínculo de liderança continua sem alcance — papel E vínculo, juntos", () => {
    const membroComVinculo = conta("member", [{ teamId: TIME, role: "manager" }]);

    expect(policy.isLeadOf(membroComVinculo, anaNoTime)).toBe(false);
    expect(policy.canConfigureRulesOf(membroComVinculo, TIME)).toBe(false);
  });

  it("o poder estrito de tech lead exige papel E vínculo tech_lead — o gerente NÃO passa", () => {
    const gestorComVinculoTecnico = conta("manager", [{ teamId: TIME, role: "tech_lead" }]);

    expect(policy.isAssignedTechLeadOf(techLead, anaNoTime)).toBe(true);
    expect(policy.isAssignedTechLeadOf(gestorComVinculoTecnico, anaNoTime)).toBe(false);
    expect(policy.isAssignedTechLeadOf(doisChapeus, anaNoTime)).toBe(false);
  });

  it("gerente, tech lead, suporte e administrador são liderança para o texto de ajuda e o catálogo", () => {
    const as = (role: UserRole): SessionUser => ({ ...fixtureMemberUser, role });
    expect(policy.isLeadership(as("manager"))).toBe(true);
    expect(policy.isLeadership(as("tech_lead"))).toBe(true);
    expect(policy.isLeadership(as("admin"))).toBe(true);
    expect(policy.isLeadership(as("support"))).toBe(true);
    expect(policy.isLeadership(as("member"))).toBe(false);
  });
});

/**
 * Onda 31 — o dono tirou do profissional os próprios números (2026-09-01):
 * "eu não quero que o profissional veja seus números de avaliação. isso
 * pode influenciá-lo negativamente" · "o profissional não pode ver os menus
 * 'time' e 'política de Progressão'". Duas perguntas novas para a política,
 * e as duas nascem aqui antes de qualquer menu ou guarda as consultar.
 */
describe("o profissional não vê os próprios números", () => {
  const policy = new UiAuthorizationPolicy();

  it("liderança é gerente, tech lead ou admin — o member não é", () => {
    expect(policy.isLeadership(fixtureAdminUser)).toBe(true);
    expect(policy.isLeadership(fixtureAssignedTechLeadUser)).toBe(true);
    expect(policy.isLeadership(fixtureUnassignedTechLeadUser)).toBe(true);
    expect(policy.isLeadership({ ...fixtureAdminUser, role: "manager" })).toBe(true);
    expect(policy.isLeadership(fixtureMemberUser)).toBe(false);
  });

  /**
   * 2026-09-05 — o dono devolveu "Minha carreira" ao profissional, em leitura.
   * A Visão geral deixou de ter guarda (a de outra pessoa é negada pelo recorte
   * do servidor, como antes de 01/09); o que fica com a liderança são as ABAS —
   * Evolução, Extrato e Roteiro —, leituras que o servidor reserva a quem lidera.
   */
  it("as abas da ficha abrem para a própria pessoa (D2) e para quem lidera; o member não abre as de outra", () => {
    expect(policy.canOpenCareerTabsOf(fixtureMemberUser, "ana")).toBe(true);
    expect(policy.canOpenCareerTabsOf(fixtureMemberUser, "bruno")).toBe(false);
    expect(policy.canOpenCareerTabsOf(fixtureAdminUser, "ana")).toBe(true);
    expect(policy.canOpenCareerTabsOf(fixtureAssignedTechLeadUser, "ana")).toBe(true);
    expect(
      policy.canOpenCareerTabsOf({ ...fixtureAssignedTechLeadUser, professionalId: "ana" }, "ana"),
    ).toBe(true);
  });

  /**
   * DEVOLVER O ACESSO (onda de 2026-09-04) — o espelho da régua de
   * `POST /auth/users/:id/access-recovery`, que pode recusar com
   * `ACCESS_RESTORE_FORBIDDEN`. O botão só aparece para quem alcança: um 403
   * não pode ser a primeira vez que a pessoa descobre que não podia.
   */
  describe("canRestoreAccessOf", () => {
    const contaAtiva = { id: "conta-ana", status: "active", role: "member" };

    it("quem administra devolve o acesso de outra pessoa", () => {
      expect(policy.canRestoreAccessOf(fixtureAdminUser, contaAtiva)).toBe(true);
    });

    it("ninguém devolve o acesso à própria conta — quem está logado já entrou", () => {
      expect(
        policy.canRestoreAccessOf(fixtureAdminUser, {
          id: fixtureAdminUser.id,
          status: "active",
          role: "admin",
        }),
      ).toBe(false);
    });

    it("conta desativada não tem acesso a devolver — o caminho dela é ser reativada", () => {
      expect(
        policy.canRestoreAccessOf(fixtureAdminUser, {
          id: "conta-ana",
          status: "disabled",
          role: "member",
        }),
      ).toBe(false);
    });

    it("quem ADMINISTRA pessoas devolve acesso: admin e gerente com vínculo — o tech lead não cadastra (D4, 2026-09-05)", () => {
      // O backend autoriza quem poderia cadastrar a pessoa naquele time:
      // administrador e gerente com vínculo. A tela não conhece o time de
      // cada linha, então mostra o botão a quem administra e deixa o recorte
      // fino com a autoridade.
      expect(policy.canRestoreAccessOf(fixtureAssignedManagerUser, contaAtiva)).toBe(true);
      expect(policy.canRestoreAccessOf(fixtureAssignedTechLeadUser, contaAtiva)).toBe(false);
      expect(policy.canRestoreAccessOf(fixtureUnassignedTechLeadUser, contaAtiva)).toBe(false);
      expect(policy.canRestoreAccessOf({ ...fixtureAdminUser, role: "manager" }, contaAtiva)).toBe(
        false,
      );
    });

    it("o gerente não mexe em conta de GERENTE — cadastrar e alterar gerentes é do administrador (dono, 2026-09-06)", () => {
      const outroGerente = { id: "conta-g2", status: "active", role: "manager" };
      const techLead = { id: "conta-tl", status: "active", role: "tech_lead" };
      expect(policy.administersAccount(fixtureAssignedManagerUser, outroGerente)).toBe(false);
      expect(policy.administersAccount(fixtureAssignedManagerUser, techLead)).toBe(true);
      expect(policy.administersAccount(fixtureAdminUser, outroGerente)).toBe(true);
      expect(
        policy.administersAccount(fixtureAdminUser, { ...outroGerente, id: fixtureAdminUser.id }),
      ).toBe(false);
      expect(policy.canRestoreAccessOf(fixtureAssignedManagerUser, outroGerente)).toBe(false);
    });

    it("quem não lidera ninguém não devolve acesso de ninguém", () => {
      expect(policy.canRestoreAccessOf(fixtureMemberUser, contaAtiva)).toBe(false);
    });
  });
});
