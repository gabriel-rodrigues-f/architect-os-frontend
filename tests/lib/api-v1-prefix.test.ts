import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, API_URL, authApi, evolutionApi, reportsApi } from "@/lib/api";
import { ApiClient } from "@/lib/api-client";
import { API_PREFIX } from "@/lib/api-path";
import type { EvolutionFilters } from "@/lib/domain";

/**
 * Corte para /api/v1 — o prefixo mora num lugar só (`api-path.ts`) e o
 * `ApiClient` compõe `base + prefixo + recurso`. Os call sites passam apenas
 * o recurso, então nenhum teste daqui pode se contentar com "o mock foi
 * chamado": o que precisa ficar provado é a URL que sai no `fetch`, com o
 * literal `/api/v1` escrito à mão — é ele que o backend combinou servir.
 */

const fetchMock = vi.fn();

const evolutionFilters: EvolutionFilters = {
  range: { from: "2026-01-01", to: "2026-06-30" },
  capabilities: { mode: "ALL_VISIBLE" },
  competencies: { mode: "ALL_VISIBLE" },
  source: "ALL",
};

const chamadas: { nome: string; enviar: () => Promise<unknown>; caminho: string }[] = [
  { nome: "snapshot do estado", enviar: () => api.getState(), caminho: "/api/v1/state" },
  { nome: "sessão corrente", enviar: () => authApi.me(), caminho: "/api/v1/auth/me" },
  { nome: "status de auth", enviar: () => authApi.status(), caminho: "/api/v1/auth/status" },
  {
    nome: "login",
    enviar: () => authApi.login("ana@exemplo.dev", "senha"),
    caminho: "/api/v1/auth/login",
  },
  { nome: "logout", enviar: () => authApi.logout(), caminho: "/api/v1/auth/logout" },
  {
    nome: "cadastro público",
    enviar: () => authApi.register({ name: "Ana", email: "ana@exemplo.dev", password: "senha" }),
    caminho: "/api/v1/auth/register",
  },
  { nome: "lista de usuários", enviar: () => authApi.users(), caminho: "/api/v1/auth/users" },
  {
    nome: "criação de usuário",
    enviar: () => authApi.createUser({ name: "Ana", email: "ana@exemplo.dev", role: "member" }),
    caminho: "/api/v1/auth/users",
  },
  {
    nome: "edição de usuário",
    enviar: () => authApi.updateUser("u-1", { role: "tech_lead" }),
    caminho: "/api/v1/auth/users/u-1",
  },
  {
    nome: "troca de senha",
    enviar: () => authApi.changePassword("antiga", "nova"),
    caminho: "/api/v1/auth/change-password",
  },
  {
    nome: "ciclo ativo",
    enviar: () => api.setActiveCycle("2026-h1"),
    caminho: "/api/v1/settings/active-cycle",
  },
  {
    nome: "remoção de ciclo",
    enviar: () => api.deleteCycle("2026-h1"),
    caminho: "/api/v1/cycles/2026-h1",
  },
  {
    nome: "edição de arquiteto",
    enviar: () => api.updateArchitect("ana", { name: "Ana" }),
    caminho: "/api/v1/architects/ana",
  },
  {
    nome: "desativação de arquiteto",
    enviar: () => api.deactivate("ana", "saiu do time", 1),
    caminho: "/api/v1/architects/ana/deactivate",
  },
  {
    nome: "histórico de nível de carreira",
    enviar: () => api.careerLevelTransitions("ana"),
    caminho: "/api/v1/architects/ana/career-level-transitions",
  },
  {
    nome: "níveis de carreira",
    enviar: () => api.careerLevels(),
    caminho: "/api/v1/career-levels",
  },
  {
    nome: "leitura da régua do time",
    enviar: () => api.teamRule("time-plataforma", "senior"),
    caminho: "/api/v1/teams/time-plataforma/rules/senior",
  },
  {
    nome: "definição da régua do time",
    enviar: () =>
      api.defineTeamRule("time-plataforma", "senior", {
        minimumQualifiedCapabilities: 3,
        capabilityIds: [],
        competencies: [],
      }),
    caminho: "/api/v1/teams/time-plataforma/rules/senior",
  },
  {
    nome: "aderência do arquiteto à régua",
    enviar: () => api.architectAdherence("ana", "senior"),
    caminho: "/api/v1/architects/ana/adherence?careerLevelId=senior",
  },
  {
    nome: "remoção de capacidade",
    enviar: () => api.deleteCapability("cloud"),
    caminho: "/api/v1/capabilities/cloud",
  },
  {
    nome: "remoção de competência",
    enviar: () => api.deleteCompetency("cloud-k8s"),
    caminho: "/api/v1/competencies/cloud-k8s",
  },
  {
    nome: "importação de catálogo",
    enviar: () => api.importCatalog({ capabilities: [] }),
    caminho: "/api/v1/catalog/import",
  },
  { nome: "faixas de pontuação", enviar: () => api.bands(), caminho: "/api/v1/config/bands" },
  { nome: "modelos de texto", enviar: () => api.templates(), caminho: "/api/v1/config/templates" },
  {
    nome: "edição de modelo de texto",
    enviar: () => api.updateTextTemplate("pdi.objective.fromGap", "pt", "texto"),
    caminho: "/api/v1/config/templates/pdi.objective.fromGap/pt",
  },
  {
    nome: "política de curadoria",
    enviar: () => api.curationPolicy(),
    caminho: "/api/v1/config/curation-policy",
  },
  {
    nome: "parâmetros operacionais",
    enviar: () => api.settings(),
    caminho: "/api/v1/config/settings",
  },
  {
    nome: "edição de parâmetro operacional",
    enviar: () => api.updateSetting("cycle.cadence", "SEMIANNUAL"),
    caminho: "/api/v1/config/settings/cycle.cadence",
  },
  {
    nome: "vocabulários",
    enviar: () => api.vocabularies(),
    caminho: "/api/v1/config/vocabularies",
  },
  {
    nome: "abertura de avaliação",
    enviar: () => api.openAssessment("ana", "2026-h1"),
    caminho: "/api/v1/assessments",
  },
  {
    nome: "elegibilidade da avaliação",
    enviar: () => api.assessmentEligibility("ana-h1"),
    caminho: "/api/v1/assessments/ana-h1/eligibility",
  },
  {
    nome: "remoção de capacidade da avaliação",
    enviar: () => api.removeAssessmentCapability("ana-h1", "cloud", true),
    caminho: "/api/v1/assessments/ana-h1/capabilities/cloud?force=true",
  },
  {
    nome: "eventos do PDI",
    enviar: () => api.planEvents("pdi-ana"),
    caminho: "/api/v1/plans/pdi-ana/events",
  },
  {
    nome: "edição de item do PDI",
    enviar: () => api.patchPlanItem("pdi-ana", "item-1", {}, 1),
    caminho: "/api/v1/plans/pdi-ana/items/item-1",
  },
  {
    nome: "remoção de item do PDI",
    enviar: () => api.removePlanItem("pdi-ana", "item-1"),
    caminho: "/api/v1/plans/pdi-ana/items/item-1",
  },
  {
    nome: "revisões da evidência",
    enviar: () => api.evidenceReviews("ev-1"),
    caminho: "/api/v1/evidences/ev-1/reviews",
  },
  {
    nome: "remoção de trilha",
    enviar: () => api.deleteLearningPath("lp-1"),
    caminho: "/api/v1/learning-paths/lp-1",
  },
  {
    nome: "progresso de item da trilha",
    enviar: () => api.patchLearningItemProgress("lp-1", "ana", "item-1", 50),
    caminho: "/api/v1/learning-paths/lp-1/progress/ana/item-1",
  },
  {
    nome: "follow-up de mentoria",
    enviar: () => api.scheduleMentoringFollowUp("m-1", null),
    caminho: "/api/v1/mentoring-sessions/m-1",
  },
  {
    nome: "evolução do arquiteto",
    enviar: () => evolutionApi.architect("ana", evolutionFilters),
    caminho: "/api/v1/evolution/architect",
  },
  {
    nome: "evolução do time",
    enviar: () => evolutionApi.team({ mode: "ALL_VISIBLE" }, evolutionFilters),
    caminho: "/api/v1/evolution/team",
  },
  {
    nome: "PDF de evolução",
    enviar: () => reportsApi.exportEvolutionPdf("ana", evolutionFilters),
    caminho: "/api/v1/reports/evolution/pdf",
  },
];

describe("prefixo /api/v1 — URL emitida no fetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("o prefixo combinado com o backend é exatamente /api/v1", () => {
    expect(API_PREFIX).toBe("/api/v1");
  });

  it("o ApiClient compõe base + prefixo + recurso", () => {
    expect(new ApiClient("http://api.local").urlOf("/cycles/2026-h1")).toBe(
      "http://api.local/api/v1/cycles/2026-h1",
    );
  });

  it.each(chamadas)("$nome sai para $caminho", async ({ enviar, caminho }) => {
    await enviar().catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${API_URL}${caminho}`);
  });

  it("nenhum gateway emite /api sem versão nem duplica o prefixo", async () => {
    for (const { enviar } of chamadas) await enviar().catch(() => undefined);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toHaveLength(chamadas.length);
    expect(urls.filter((url) => !url.startsWith(`${API_URL}/api/v1/`))).toEqual([]);
    expect(urls.filter((url) => /\/api\/v1\/(api|v1)\b/.test(url))).toEqual([]);
  });
});
