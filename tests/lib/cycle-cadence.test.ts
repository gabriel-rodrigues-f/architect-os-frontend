import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CycleCadenceScheme } from "@/lib/cycle-cadence";

/**
 * CFG-05 / B9 — a representação do ciclo por cadência saiu de `cycles.tsx`
 * para este módulo. Guard rail duplo: com SEMIANNUAL, ids/nomes/datas/parse
 * são BYTE-idênticos ao hardcoded antigo (`Half`, `^(\d{4}) (H[12])$`,
 * 01-01→06-30/07-01→12-31, `${year}-h1`); QUARTERLY e ANNUAL derivam da
 * mesma mecânica.
 */

describe("CycleCadenceScheme", () => {
  beforeEach(() => {
    // `nextAvailable`/`parseCycleName` caem no ano corrente — fixado para determinismo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("SEMIANNUAL — byte-idêntico ao hardcoded antigo", () => {
    const scheme = CycleCadenceScheme.of("SEMIANNUAL");

    it("oferece H1 e H2", () => {
      expect(scheme.periods).toEqual(["H1", "H2"]);
      expect(scheme.singlePeriod).toBe(false);
    });

    it("nome e id nascem do par ano/semestre", () => {
      expect(scheme.cycleName(2026, "H1")).toBe("2026 H1");
      expect(scheme.cycleId(2026, "H1")).toBe("2026-h1");
      expect(scheme.cycleId(2027, "H2")).toBe("2027-h2");
    });

    it("datas dos semestres", () => {
      expect(scheme.datesFor(2026, "H1")).toEqual({ start: "2026-01-01", end: "2026-06-30" });
      expect(scheme.datesFor(2026, "H2")).toEqual({ start: "2026-07-01", end: "2026-12-31" });
    });

    it("parse aceita o padrão e cai no ano corrente/H1 fora dele", () => {
      expect(scheme.parseCycleName("2026 H2")).toEqual({ year: 2026, period: "H2" });
      expect(scheme.parseCycleName("qualquer coisa")).toEqual({ year: 2026, period: "H1" });
      expect(scheme.parseCycleName("2026 H3")).toEqual({ year: 2026, period: "H1" });
    });

    it("próximo período livre avança H1→H2→ano seguinte", () => {
      expect(scheme.nextAvailable([])).toEqual({ year: 2026, period: "H1" });
      expect(scheme.nextAvailable([{ id: "2026-h1" }])).toEqual({ year: 2026, period: "H2" });
      expect(scheme.nextAvailable([{ id: "2026-h1" }, { id: "2026-h2" }])).toEqual({
        year: 2027,
        period: "H1",
      });
    });
  });

  describe("QUARTERLY", () => {
    const scheme = CycleCadenceScheme.of("QUARTERLY");

    it("oferece Q1..Q4 com ids e datas de trimestre", () => {
      expect(scheme.periods).toEqual(["Q1", "Q2", "Q3", "Q4"]);
      expect(scheme.cycleName(2026, "Q3")).toBe("2026 Q3");
      expect(scheme.cycleId(2026, "Q3")).toBe("2026-q3");
      expect(scheme.datesFor(2026, "Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
      expect(scheme.datesFor(2026, "Q2")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
      expect(scheme.datesFor(2026, "Q3")).toEqual({ start: "2026-07-01", end: "2026-09-30" });
      expect(scheme.datesFor(2026, "Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    });

    it("parse e próximo livre respeitam os quatro trimestres", () => {
      expect(scheme.parseCycleName("2027 Q4")).toEqual({ year: 2027, period: "Q4" });
      expect(scheme.parseCycleName("2027 H1")).toEqual({ year: 2026, period: "Q1" });
      expect(
        scheme.nextAvailable([{ id: "2026-q1" }, { id: "2026-q2" }, { id: "2026-q3" }]),
      ).toEqual({ year: 2026, period: "Q4" });
      expect(
        scheme.nextAvailable([
          { id: "2026-q1" },
          { id: "2026-q2" },
          { id: "2026-q3" },
          { id: "2026-q4" },
        ]),
      ).toEqual({ year: 2027, period: "Q1" });
    });

    it("ciclos semestrais existentes não colidem com ids trimestrais", () => {
      // Mudança de cadência não reescreve ciclos: `2026-h1` continua existindo
      // e o próximo trimestre livre ignora esses ids (padrão diferente).
      expect(scheme.nextAvailable([{ id: "2026-h1" }, { id: "2026-h2" }])).toEqual({
        year: 2026,
        period: "Q1",
      });
    });
  });

  describe("ANNUAL", () => {
    const scheme = CycleCadenceScheme.of("ANNUAL");

    it("tem um período só — o ano É o nome e o id", () => {
      expect(scheme.singlePeriod).toBe(true);
      expect(scheme.periods).toEqual(["Y"]);
      expect(scheme.cycleName(2026, "Y")).toBe("2026");
      expect(scheme.cycleId(2026, "Y")).toBe("2026");
      expect(scheme.datesFor(2026, "Y")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    });

    it("parse e próximo livre por ano", () => {
      expect(scheme.parseCycleName("2027")).toEqual({ year: 2027, period: "Y" });
      expect(scheme.parseCycleName("2026 H1")).toEqual({ year: 2026, period: "Y" });
      expect(scheme.nextAvailable([{ id: "2026" }])).toEqual({ year: 2027, period: "Y" });
    });
  });
});
