import { describe, expect, it } from "vitest";

import type { AppState } from "@/lib/api";
import { createSelectors } from "@/lib/selectors";
import { fixtureState } from "../helpers/fixtures";

/**
 * LEG-02 — `training-needs.tsx` afirmava `n.competency!` em sete lugares. A
 * garantia existia, mas 300 linhas adiante e em outro arquivo: um
 * `.filter((need) => !!need.competency)` que o TypeScript não lia como
 * estreitamento. Quem editasse a tela não tinha como saber disso.
 *
 * A garantia passou para o tipo (`TrainingNeed.competency: Competency`) via
 * filtro com predicado. Este teste trava a regra de negócio que o tipo agora
 * promete: necessidade sem competência resolvível não é listada — o time não
 * recebe uma linha de treinamento anônima.
 */

const withOrphanAssessmentItem = (): AppState => ({
  ...fixtureState,
  assessments: fixtureState.assessments.map((assessment) =>
    assessment.id !== "ana-h2"
      ? assessment
      : {
          ...assessment,
          items: [
            ...assessment.items,
            {
              competencyId: "competencia-removida-do-catalogo",
              self: 1,
              leader: 1,
              target: 4,
              final: 1,
              comments: [],
            },
          ],
        },
  ),
});

describe("teamTrainingNeeds — competência fora do catálogo", () => {
  it("não lista necessidade cuja competência sumiu do catálogo e não tem nome guardado", () => {
    const needs = createSelectors(withOrphanAssessmentItem()).teamTrainingNeeds();

    expect(needs.map((need) => need.competency.id)).not.toContain(
      "competencia-removida-do-catalogo",
    );
    expect(needs.every((need) => need.competency.name.length > 0)).toBe(true);
  });

  it("mantém a necessidade quando o item guardou o nome da competência removida", () => {
    const state = withOrphanAssessmentItem();
    const withName: AppState = {
      ...state,
      assessments: state.assessments.map((assessment) =>
        assessment.id !== "ana-h2"
          ? assessment
          : {
              ...assessment,
              items: assessment.items.map((item) =>
                item.competencyId === "competencia-removida-do-catalogo"
                  ? { ...item, competencyName: "Competência arquivada" }
                  : item,
              ),
            },
      ),
    };

    const need = createSelectors(withName)
      .teamTrainingNeeds()
      .find((n) => n.competency.id === "competencia-removida-do-catalogo");

    expect(need?.competency.name).toBe("Competência arquivada");
  });
});
