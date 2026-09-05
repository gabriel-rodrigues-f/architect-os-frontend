import { beforeAll, describe, expect, it } from "vitest";

import { API_URL, authApi, stateContextsApi, type AppState } from "@/lib/api";
import { createSelectors } from "@/lib/selectors";

/**
 * Contrato entre o payload real do backend e a store do front.
 * Rodam com o backend no ar: `RUN_INTEGRATION=1 npm test`.
 */
const enabled = process.env["RUN_INTEGRATION"] === "1";

/**
 * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — a sessão agora vive num
 * cookie HttpOnly; `api.ts` conta com o navegador reenviar esse cookie
 * sozinho (`credentials: "include"`). O `fetch` global do Node (undici),
 * ao contrário do browser, não mantém cookie jar nenhum — sem isto, toda
 * chamada autenticada deste teste veria 401 mesmo logo depois do login.
 * Isto imita só o comportamento do browser para este processo de teste; não
 * é um mecanismo do app (`api.ts` não ganha nenhuma forma de token/cookie
 * manual) — o `Set-Cookie` também não é escondido de `.headers` no Node
 * como seria num browser, então dá para ler e reenviar na mão.
 */
let storedCookie: string | undefined;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (storedCookie) headers.set("cookie", storedCookie);
  const response = await realFetch(input, { ...init, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) storedCookie = setCookie.split(";")[0];
  return response;
};

/** O blob morreu (ADR-0011 encerrado): o snapshot é a soma das fatias, como cada tela monta. */
async function snapshotPelasFatias(): Promise<AppState> {
  const [
    capabilities,
    competencies,
    teamLevelRules,
    architects,
    assessments,
    cycles,
    plans,
    learningPaths,
    mentoringSessions,
    evidences,
    active,
  ] = await Promise.all([
    stateContextsApi.listCapabilities(),
    stateContextsApi.listCompetencies(),
    stateContextsApi.listTeamLevelRules(),
    stateContextsApi.listArchitects(),
    stateContextsApi.listAssessments(),
    stateContextsApi.listCycles(),
    stateContextsApi.listPlans(),
    stateContextsApi.listLearningPaths(),
    stateContextsApi.listMentoringSessions(),
    stateContextsApi.listEvidences(),
    stateContextsApi.activeCycle(),
  ]);
  return {
    capabilities,
    competencies,
    teamLevelRules,
    architects,
    assessments,
    cycles,
    plans,
    learningPaths,
    mentoringSessions,
    evidences,
    activeCycleId: active.cycleId,
  };
}

describe.skipIf(!enabled)(`store contra a API real (${API_URL})`, () => {
  let state: AppState;

  beforeAll(async () => {
    // Conta descartável só para este teste — o backend exige autenticação.
    const email = `front-teste-${Date.now()}@architect-os.local`;
    await authApi.register({
      name: "Teste do front",
      email,
      password: "senha-de-teste-123",
    });
    state = await snapshotPelasFatias();
  }, 30_000);

  it("sem cookie de sessão, a API recusa o snapshot", async () => {
    const savedCookie = storedCookie;
    storedCookie = undefined;
    try {
      await expect(stateContextsApi.listArchitects()).rejects.toMatchObject({ status: 401 });
    } finally {
      storedCookie = savedCookie;
    }
  });

  it("o snapshot traz todas as coleções que a store espera", () => {
    for (const key of [
      "capabilities",
      "competencies",
      "architects",
      "assessments",
      "cycles",
      "plans",
      "learningPaths",
      "mentoringSessions",
      "evidences",
    ] as const) {
      expect(Array.isArray(state[key])).toBe(true);
    }
    expect(typeof state.activeCycleId).toBe("string");
  });

  it("os ciclos chegam com datas ISO (sem deslocamento de fuso)", () => {
    for (const cycle of state.cycles) {
      expect(cycle.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cycle.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("as trilhas trazem autor e data de criação", () => {
    for (const path of state.learningPaths) {
      expect(path).toHaveProperty("createdBy");
      if (path.createdAt) expect(Number.isNaN(new Date(path.createdAt).getTime())).toBe(false);
    }
  });

  it("todo item de assessment aponta para uma competência existente", () => {
    const ids = new Set(state.competencies.map((c) => c.id));
    for (const assessment of state.assessments) {
      for (const item of assessment.items) {
        expect(ids.has(item.competencyId)).toBe(true);
      }
    }
  });

  it("os selectors rodam sobre o payload real sem quebrar", () => {
    const sel = createSelectors(state);
    expect(sel.teamTrainingNeeds()).toBeInstanceOf(Array);

    for (const architect of state.architects) {
      expect(sel.capabilityAverages(architect.id)).toHaveLength(state.capabilities.length);
    }
  });
});
