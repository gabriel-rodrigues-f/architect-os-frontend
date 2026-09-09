import { describe, expect, it } from "vitest";

import type { TeamLevelRule } from "@/lib/domain";
import {
  ProgressionMinimumPresenter,
  QualifiedCapabilityMinimum,
  ReadyCompetencyShortfall,
} from "@/lib/presenters";

/**
 * Onda 35, item 12 — a régua não pode exigir mais competências prontas do
 * que existem. A conta "quantas faltam" mora aqui, e não na tela, porque é
 * ela que decide se Salvar acende e qual frase o link mostra.
 */

const regra = (id: string, teamId: string, minimo: number): TeamLevelRule => ({
  id,
  teamId,
  careerLevelId: "junior",
  minimumQualifiedCapabilities: minimo,
});

describe("ReadyCompetencyShortfall", () => {
  it("conta quantas competências prontas faltam para o mínimo", () => {
    const falta = ReadyCompetencyShortfall.between(5, 2);
    expect(falta.missing).toBe(3);
    expect(falta.blocksSaving).toBe(true);
    expect(falta.messageKey).toBe("policy.row.shortfall.many");
  });

  it("uma só que falte fala no singular", () => {
    expect(ReadyCompetencyShortfall.between(3, 2).messageKey).toBe("policy.row.shortfall.one");
  });

  it("mínimo dentro do pronto não falta nada e não bloqueia", () => {
    const nada = ReadyCompetencyShortfall.between(2, 2);
    expect(nada.missing).toBe(0);
    expect(nada.blocksSaving).toBe(false);
  });

  it("rascunho que ainda não é número não inventa falta", () => {
    expect(ReadyCompetencyShortfall.between(Number.NaN, 2).blocksSaving).toBe(false);
  });

  /**
   * Dono (2026-09-08, regra 12): *"Não haverá mais valor mínimo."* Existe
   * Trainee com zero, e zero NÃO é alerta de "falta competência" — é uma régua
   * que não exige capacidade qualificada nenhuma.
   */
  it("mínimo ZERO não falta nada, mesmo com o catálogo vazio — não é erro, é a régua", () => {
    const zero = ReadyCompetencyShortfall.between(0, 0);
    expect(zero.missing).toBe(0);
    expect(zero.blocksSaving).toBe(false);
  });
});

describe("QualifiedCapabilityMinimum — o piso acabou", () => {
  it("aceita zero e recusa negativo e quebrado", () => {
    expect(QualifiedCapabilityMinimum.FLOOR).toBe(0);
    expect(QualifiedCapabilityMinimum.admits(0)).toBe(true);
    expect(QualifiedCapabilityMinimum.admits(3)).toBe(true);
    expect(QualifiedCapabilityMinimum.admits(-1)).toBe(false);
    expect(QualifiedCapabilityMinimum.admits(1.5)).toBe(false);
  });

  it("sabe quando o mínimo é ZERO — é a tela que precisa dizer isso sem parecer erro", () => {
    expect(QualifiedCapabilityMinimum.demandsNothing(0)).toBe(true);
    expect(QualifiedCapabilityMinimum.demandsNothing(1)).toBe(false);
  });
});

describe("ProgressionMinimumPresenter.shortfall", () => {
  it("com vários times, a falta é medida pelo MAIOR mínimo — o vinculante", () => {
    const presenter = ProgressionMinimumPresenter.forCareerLevel(
      [regra("a", "plataforma", 3), regra("b", "integracoes", 5)],
      "junior",
    );
    expect(presenter.shortfall(2).missing).toBe(3);
  });

  it("sem régua nenhuma não falta nada", () => {
    const presenter = ProgressionMinimumPresenter.forCareerLevel([], "junior");
    expect(presenter.shortfall(0).blocksSaving).toBe(false);
  });
});
