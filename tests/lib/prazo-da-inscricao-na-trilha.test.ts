import { describe, expect, it } from "vitest";

import type { LearningPath } from "@/lib/domain";
import {
  CompletionDeadlineInput,
  LearningPathEnrollmentReading,
} from "@/lib/learning-path-enrollment";

/**
 * FATIA PRAZOS, item 2 — a conta do prazo na TELA é a mesma do backend.
 *
 * A tela não decide o prazo (o servidor recusa o avanço de quem venceu), mas
 * precisa fazer a mesma conta para não oferecer um controle que a escrita vai
 * negar. Este teste é o espelho literal de
 * `backend/tests/modules/learning-paths/domain/o-prazo-da-trilha-conta-do-ingresso.test.ts`:
 * mesmos instantes, mesmos resultados. Se um dos dois mudar sozinho, a tela e
 * o servidor passam a discordar sobre quem ainda está na trilha.
 */
const INGRESSO_EM_MARCO = "2026-03-01T12:00:00.000Z";
const INGRESSO_EM_AGOSTO = "2026-08-01T12:00:00.000Z";

const trilha = (
  completionDeadlineDays: number | null,
): Pick<LearningPath, "enrollments" | "completionDeadlineDays"> => ({
  enrollments: [
    { professionalId: "ana", enrolledAt: INGRESSO_EM_MARCO },
    { professionalId: "bruno", enrolledAt: INGRESSO_EM_AGOSTO },
  ],
  completionDeadlineDays,
});

describe("o prazo da inscrição, lido pela tela", () => {
  it("duas pessoas na mesma trilha vencem em dias diferentes — o relógio é do ingresso", () => {
    expect(LearningPathEnrollmentReading.of(trilha(30), "ana")?.dueAt).toBe(
      "2026-03-31T12:00:00.000Z",
    );
    expect(LearningPathEnrollmentReading.of(trilha(30), "bruno")?.dueAt).toBe(
      "2026-08-31T12:00:00.000Z",
    );
  });

  it("quem estourou está vencido; quem está dentro do prazo, não", () => {
    const emAbril = new Date("2026-04-15T12:00:00.000Z");

    expect(LearningPathEnrollmentReading.of(trilha(30), "ana")?.expiredAt(emAbril)).toBe(true);
    expect(LearningPathEnrollmentReading.of(trilha(30), "bruno")?.expiredAt(emAbril)).toBe(false);
  });

  it("o que falta é contado em dias, arredondando para cima", () => {
    const inscricao = LearningPathEnrollmentReading.of(trilha(30), "ana");

    expect(inscricao?.daysLeftAt(new Date("2026-03-01T12:00:00.000Z"))).toBe(30);
    expect(inscricao?.daysLeftAt(new Date("2026-03-31T00:00:00.000Z"))).toBe(1);
    expect(inscricao?.daysLeftAt(new Date("2026-04-05T12:00:00.000Z"))).toBe(-5);
  });

  it("no instante EXATO do vencimento a inscrição ainda vale — vence quando passa", () => {
    const inscricao = LearningPathEnrollmentReading.of(trilha(30), "ana");

    expect(inscricao?.expiredAt(new Date("2026-03-31T12:00:00.000Z"))).toBe(false);
    expect(inscricao?.expiredAt(new Date("2026-03-31T12:00:00.001Z"))).toBe(true);
  });

  it("trilha sem prazo configurado não vence nunca", () => {
    const inscricao = LearningPathEnrollmentReading.of(trilha(null), "ana");

    expect(inscricao?.hasDeadline).toBe(false);
    expect(inscricao?.dueAt).toBeUndefined();
    expect(inscricao?.daysLeftAt(new Date("2036-01-01T00:00:00.000Z"))).toBeUndefined();
    expect(inscricao?.expiredAt(new Date("2036-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("quem não está inscrito não tem inscrição — e não tem prazo", () => {
    expect(LearningPathEnrollmentReading.of(trilha(30), "quem-nao-entrou")).toBeUndefined();
  });
});

describe("o campo de prazo do formulário", () => {
  it("vazio é SEM PRAZO — e é assim que a trilha continua sem vencer", () => {
    expect(CompletionDeadlineInput.toDays("")).toBeNull();
    expect(CompletionDeadlineInput.toDays("   ")).toBeNull();
  });

  it("zero e negativo também são sem prazo — zero venceria no instante do ingresso", () => {
    expect(CompletionDeadlineInput.toDays("0")).toBeNull();
    expect(CompletionDeadlineInput.toDays("-5")).toBeNull();
  });

  it("texto que não é número não vira prazo", () => {
    expect(CompletionDeadlineInput.toDays("trinta")).toBeNull();
  });

  it("número vira dias inteiros", () => {
    expect(CompletionDeadlineInput.toDays("30")).toBe(30);
    expect(CompletionDeadlineInput.toDays(" 45 ")).toBe(45);
    expect(CompletionDeadlineInput.toDays("30.9")).toBe(30);
  });

  it("a volta ao formulário mostra vazio quando não há prazo", () => {
    expect(CompletionDeadlineInput.fromDays(null)).toBe("");
    expect(CompletionDeadlineInput.fromDays(30)).toBe("30");
  });
});
