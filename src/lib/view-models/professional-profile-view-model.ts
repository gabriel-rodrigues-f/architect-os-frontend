/**
 * OS PRÓXIMOS PASSOS DA FICHA — o que a ficha de carreira pede a quem a abre.
 *
 * Cada passo tem um dono declarado: os dois primeiros são de quem AGE sobre a
 * ficha (`canEditOwn`, `UiAuthorizationPolicy.canActOnCareerFileOf`), e o
 * terceiro é de quem LIDERA a pessoa (`leadsProfessional`, `isLeadOf`) — a
 * avaliação que espera calibração é notícia de quem lidera, não ato de ficha.
 *
 * Os dois sinais andavam juntos porque a revisão de evidência morava aqui; com
 * a evidência fora do produto (dono, 2026-09-08, regra 17) cada guarda passou a
 * dizer só o que é dela, para a calibração não sair de cena junto com a
 * evidência.
 */
export type NextStep =
  | { kind: "itemsNotStarted"; count: number }
  | { kind: "gapsNotInPlan"; count: number }
  | { kind: "assessmentAwaiting" };

export interface NextStepSignals {
  canEditOwn: boolean;
  leadsProfessional: boolean;
  itemsNotStartedCount: number;
  gapsNotInPlanCount: number;
  assessmentAwaitingCalibration: boolean;
}

export class ProfessionalProfileViewModel {
  nextSteps(input: NextStepSignals): NextStep[] {
    const steps: NextStep[] = [];
    if (input.canEditOwn) {
      if (input.itemsNotStartedCount > 0) {
        steps.push({ kind: "itemsNotStarted", count: input.itemsNotStartedCount });
      }
      if (input.gapsNotInPlanCount > 0) {
        steps.push({ kind: "gapsNotInPlan", count: input.gapsNotInPlanCount });
      }
    }
    if (input.leadsProfessional && input.assessmentAwaitingCalibration) {
      steps.push({ kind: "assessmentAwaiting" });
    }
    return steps;
  }
}

/** A ficha não depende de serviço nenhum: os passos são função pura dos sinais. */
export const professionalProfileViewModel = new ProfessionalProfileViewModel();
