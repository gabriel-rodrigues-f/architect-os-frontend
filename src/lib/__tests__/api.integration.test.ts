import { beforeAll, describe, expect, it } from "vitest";

import { api, API_URL, authApi, setAuthToken, type AppState } from "../api";
import { createSelectors } from "../selectors";

/**
 * Contrato entre o payload real do backend e a store do front.
 * Rodam com o backend no ar: `RUN_INTEGRATION=1 npm test`.
 */
const enabled = process.env["RUN_INTEGRATION"] === "1";

describe.skipIf(!enabled)(`store contra a API real (${API_URL})`, () => {
  let state: AppState;
  let token: string;

  beforeAll(async () => {
    // Conta descartável só para este teste — o backend exige autenticação.
    const email = `front-teste-${Date.now()}@architect-os.local`;
    const session = await authApi.register({
      name: "Teste do front",
      email,
      password: "senha-de-teste-123",
    });
    token = session.token;
    setAuthToken(token);
    state = await api.getState();
  }, 30_000);

  it("sem token, a API recusa o snapshot", async () => {
    setAuthToken(null);
    try {
      await expect(api.getState()).rejects.toMatchObject({ status: 401 });
    } finally {
      setAuthToken(token);
    }
  });

  it("o snapshot traz todas as coleções que a store espera", () => {
    for (const key of [
      "categories",
      "competencies",
      "architects",
      "assessments",
      "cycles",
      "swots",
      "plans",
      "okrs",
      "learningPaths",
      "mentoringSessions",
      "evidences",
      "certifications",
    ] as const) {
      expect(Array.isArray(state[key])).toBe(true);
    }
    expect(typeof state.activeCycleId).toBe("string");
    expect(Array.isArray(state.philosophy.stages)).toBe(true);
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
      expect(sel.domainAverages(architect.id)).toHaveLength(state.categories.length);
      const score = sel.developmentScore(architect.id);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
