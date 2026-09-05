import { describe, expect, it } from "vitest";

import { isLeadCapable, type SessionUser, type UserRole } from "@/lib/api";
import type { TeamMembership } from "@/lib/gateways/auth.gateway";
import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
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
      expect(policy.canActFor(fixtureUnassignedTechLeadUser, anaAsArchitect)).toBe(false);
    });

    it("lead age sobre arquiteto com time — o recorte do servidor (ADR-0035) só lhe entrega times que ele lidera", () => {
      expect(policy.canActFor(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(true);
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
      expect(policy.isLeadOf({ ...fixtureMemberUser, role: "tech_lead" }, anaInLedTeam)).toBe(
        false,
      );
    });

    it("lead responde true para arquiteto com time, false para arquiteto sem time", () => {
      expect(policy.isLeadOf(fixtureUnassignedTechLeadUser, anaAsArchitect)).toBe(false);
      expect(policy.isLeadOf(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(true);
    });
  });

  describe("isAssignedTechLeadOf", () => {
    it("NÃO tem bypass de admin — reabertura de PDI é só do Tech Lead responsável", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAdminUser, anaInLedTeam)).toBe(false);
    });

    it("o Tech Lead COM vínculo naquele time responde true", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAssignedTechLeadUser, anaInLedTeam)).toBe(true);
    });

    it("o Tech Lead SEM vínculo responde false — o poder estrito não herda o alcance", () => {
      expect(policy.isAssignedTechLeadOf(fixtureUnassignedTechLeadUser, anaInLedTeam)).toBe(false);
    });

    it("arquiteto sem time responde false", () => {
      expect(policy.isAssignedTechLeadOf(fixtureAssignedTechLeadUser, anaAsArchitect)).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("só a conta admin responde true", () => {
      expect(policy.isAdmin(fixtureAdminUser)).toBe(true);
      expect(policy.isAdmin(fixtureMemberUser)).toBe(false);
      expect(policy.isAdmin(fixtureUnassignedTechLeadUser)).toBe(false);
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

  it("CONCEDE para lead COM vínculo de gestor no time — gestor multi-time é N vínculos", () => {
    const gestor = {
      ...fixtureAssignedTechLeadUser,
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
 * o lead-arquiteto que lidera o PRÓPRIO time não se distinguia, e a UI lhe
 * escondia ações que o backend permitia. Com `memberships` na sessão ele
 * passa a se distinguir — e só quando o vínculo existe.
 */
describe("o lead-arquiteto que lidera o próprio time", () => {
  const policy = new UiAuthorizationPolicy();
  const eleMesmo = { id: "ana", teamId: "time-plataforma" };
  const leadArquiteto = {
    ...fixtureAssignedTechLeadUser,
    architectId: "ana",
    memberships: [{ teamId: "time-plataforma", role: "tech_lead" as const }],
  };

  /**
   * 2026-09-05 — virou: NA PRÓPRIA FICHA, NINGUÉM É LÍDER. O dono viu gestor e
   * tech lead na própria ficha com roteiro de 1:1 consigo mesmos e "revisar"
   * as próprias evidências. O vínculo com o time continua valendo para os
   * OUTROS do time; para si, não há liderança.
   */
  it("NÃO é lead de si mesmo, mesmo liderando o próprio time", () => {
    expect(policy.isLeadOf(leadArquiteto, eleMesmo)).toBe(false);
  });

  it("a própria ficha não tem ação: nem para o líder, nem para o admin com arquiteto", () => {
    expect(policy.canActOnCareerFileOf(leadArquiteto, eleMesmo)).toBe(false);
    expect(policy.canActOnCareerFileOf({ ...fixtureAdminUser, architectId: "ana" }, eleMesmo)).toBe(
      false,
    );
    expect(policy.isLeadOf({ ...fixtureAdminUser, architectId: "ana" }, eleMesmo)).toBe(false);
  });

  it("na ficha de um liderado, o líder continua agindo e liderando", () => {
    const liderado = { id: "bruno", teamId: "time-plataforma" };
    expect(policy.isLeadOf(leadArquiteto, liderado)).toBe(true);
    expect(policy.canActOnCareerFileOf(leadArquiteto, liderado)).toBe(true);
  });

  it("sem vínculo, nada muda: continua não sendo lead de si mesmo", () => {
    expect(policy.isLeadOf({ ...leadArquiteto, memberships: [] }, eleMesmo)).toBe(false);
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
 *   liderança (gestor OU tech lead);
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
    architectId: null,
    role,
    memberships,
  });

  const gestor = conta("manager", [{ teamId: TIME, role: "manager" }]);
  const techLead = conta("tech_lead", [{ teamId: TIME, role: "tech_lead" }]);
  const doisChapeus = conta("manager", [
    { teamId: TIME, role: "manager" },
    { teamId: OUTRO_TIME, role: "tech_lead" },
  ]);

  it("o gestor alcança o roster do time onde tem vínculo", () => {
    expect(policy.isLeadOf(gestor, anaNoTime)).toBe(true);
    expect(policy.canActFor(gestor, anaNoTime)).toBe(true);
  });

  it("o tech lead alcança o roster do time onde tem vínculo", () => {
    expect(policy.isLeadOf(techLead, anaNoTime)).toBe(true);
    expect(policy.canActFor(techLead, anaNoTime)).toBe(true);
  });

  it("os dois regem a régua do time onde têm vínculo", () => {
    expect(policy.canConfigureRulesOf(gestor, TIME)).toBe(true);
    expect(policy.canConfigureRulesOf(techLead, TIME)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(gestor)).toBe(true);
    expect(policy.canConfigureAnyTeamRules(techLead)).toBe(true);
  });

  it("a conta de dois chapéus alcança os DOIS times — alcance é a união dos vínculos", () => {
    expect([...(policy.configurableTeamIds(doisChapeus) as ReadonlySet<string>)].sort()).toEqual([
      OUTRO_TIME,
      TIME,
    ]);
  });

  it("member com vínculo de liderança continua sem alcance — papel E vínculo, juntos", () => {
    const membroComVinculo = conta("member", [{ teamId: TIME, role: "manager" }]);

    expect(policy.isLeadOf(membroComVinculo, anaNoTime)).toBe(false);
    expect(policy.canConfigureRulesOf(membroComVinculo, TIME)).toBe(false);
  });

  it("o poder estrito de tech lead exige papel E vínculo tech_lead — o gestor NÃO passa", () => {
    const gestorComVinculoTecnico = conta("manager", [{ teamId: TIME, role: "tech_lead" }]);

    expect(policy.isAssignedTechLeadOf(techLead, anaNoTime)).toBe(true);
    expect(policy.isAssignedTechLeadOf(gestorComVinculoTecnico, anaNoTime)).toBe(false);
    expect(policy.isAssignedTechLeadOf(doisChapeus, anaNoTime)).toBe(false);
  });

  it("gestor e tech lead são capazes de liderança para o texto de ajuda e o catálogo", () => {
    expect(isLeadCapable("manager")).toBe(true);
    expect(isLeadCapable("tech_lead")).toBe(true);
    expect(isLeadCapable("admin")).toBe(true);
    expect(isLeadCapable("member")).toBe(false);
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

  it("liderança é gestor, tech lead ou admin — o member não é", () => {
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
  it("as abas da ficha são da liderança, inclusive sobre a própria ficha; o member não as abre", () => {
    expect(policy.canOpenCareerTabsOf(fixtureMemberUser, "ana")).toBe(false);
    expect(policy.canOpenCareerTabsOf(fixtureMemberUser, "bruno")).toBe(false);
    expect(policy.canOpenCareerTabsOf(fixtureAdminUser, "ana")).toBe(true);
    expect(policy.canOpenCareerTabsOf(fixtureAssignedTechLeadUser, "ana")).toBe(true);
    expect(
      policy.canOpenCareerTabsOf({ ...fixtureAssignedTechLeadUser, architectId: "ana" }, "ana"),
    ).toBe(true);
  });

  /**
   * DEVOLVER O ACESSO (onda de 2026-09-04) — o espelho da régua de
   * `POST /auth/users/:id/access-recovery`, que pode recusar com
   * `ACCESS_RESTORE_FORBIDDEN`. O botão só aparece para quem alcança: um 403
   * não pode ser a primeira vez que a pessoa descobre que não podia.
   */
  describe("canRestoreAccessOf", () => {
    const contaAtiva = { id: "conta-ana", status: "active" };

    it("quem administra devolve o acesso de outra pessoa", () => {
      expect(policy.canRestoreAccessOf(fixtureAdminUser, contaAtiva)).toBe(true);
    });

    it("ninguém devolve o acesso à própria conta — quem está logado já entrou", () => {
      expect(
        policy.canRestoreAccessOf(fixtureAdminUser, {
          id: fixtureAdminUser.id,
          status: "active",
        }),
      ).toBe(false);
    });

    it("conta desativada não tem acesso a devolver — o caminho dela é ser reativada", () => {
      expect(
        policy.canRestoreAccessOf(fixtureAdminUser, { id: "conta-ana", status: "disabled" }),
      ).toBe(false);
    });

    it("a LIDERANÇA devolve acesso — é a mesma régua da admissão, no backend", () => {
      // O backend (ADR-0094) autoriza quem poderia cadastrar a pessoa naquele
      // time: administrador, gestor e tech lead. A tela não conhece o vínculo
      // de time de cada linha, então mostra o botão para a liderança e deixa o
      // recorte fino com a autoridade — esconder de gestor e tech lead tiraria
      // deles exatamente a operação que o dono pediu.
      expect(policy.canRestoreAccessOf(fixtureAssignedTechLeadUser, contaAtiva)).toBe(true);
      expect(policy.canRestoreAccessOf(fixtureUnassignedTechLeadUser, contaAtiva)).toBe(true);
      expect(policy.canRestoreAccessOf({ ...fixtureAdminUser, role: "manager" }, contaAtiva)).toBe(
        true,
      );
    });

    it("quem não lidera ninguém não devolve acesso de ninguém", () => {
      expect(policy.canRestoreAccessOf(fixtureMemberUser, contaAtiva)).toBe(false);
    });
  });
});
