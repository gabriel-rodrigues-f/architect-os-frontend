import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import ptMessages from "@/locales/pt.json";
import { GapBadge } from "@/components/app/ui-bits";
import { GAP_SEVERITY_MESSAGE_KEY, gapSeverityOf } from "@/lib/domain";
import { I18nProvider } from "@/lib/i18n";
import { TeamReportPresenter, type T, type TeamReportInput } from "@/lib/presenters";
import type { ConsolidatedGapRow } from "@/lib/selectors";

/**
 * OO3-11j — o conteúdo do relatório do time (antes 8 funções soltas em
 * `team-report-shared.ts`, sem teste) e a régua única de severidade
 * (OO3-11i, antes copiada em 3 lugares).
 */
const fakeT: T = (key, params) => (params ? `${key}|${JSON.stringify(params)}` : String(key));

const gapRow = (overrides: Partial<ConsolidatedGapRow> = {}): ConsolidatedGapRow => ({
  competencyId: "c1",
  name: "Kubernetes",
  capabilityId: "cloud",
  requirementType: "RESTRICTIVE",
  people: 2,
  architectNames: ["Ana", "Bruno"],
  totalGap: 3,
  maxGap: 2,
  avgGap: 1.5,
  avgFinal: 2.5,
  avgTarget: 4,
  ...overrides,
});

const input = (overrides: Partial<TeamReportInput> = {}): TeamReportInput => ({
  scopeLabel: "Time inteiro",
  generatedAt: new Date("2026-08-26T02:00:00Z"),
  architects: [{ id: "ana", name: "Ana" }],
  capabilities: [
    { id: "cloud", name: "Cloud", short: "Cld" },
    { id: "security", name: "Security", short: "Cld" },
  ],
  capabilityAveragesFor: () => [],
  blocking: [],
  opportunity: [],
  mastery: [],
  ...overrides,
});

describe("TeamReportPresenter", () => {
  it("heatmapHead deduplica siglas repetidas do catálogo", () => {
    const presenter = new TeamReportPresenter(fakeT, input());
    expect(presenter.heatmapHead).toEqual(["col.architect", "Cld", "Cld (2)"]);
  });

  it('heatmapBody usa "—" para média ausente — nunca 0', () => {
    const cap = { id: "cloud", name: "Cloud", short: "Cld" };
    const presenter = new TeamReportPresenter(
      fakeT,
      input({
        capabilities: [cap],
        capabilityAveragesFor: () => [
          { capability: cap as never, avg: undefined, target: undefined },
        ],
      }),
    );
    expect(presenter.heatmapBody).toEqual([["Ana", "—"]]);
  });

  it('a coluna "Tipo" some em mastery, e gapRows segue exatamente a ordem de gapColumns', () => {
    const presenter = new TeamReportPresenter(fakeT, input());
    expect(presenter.gapColumns(false)).toHaveLength(8);
    expect(presenter.gapColumns(true)).toHaveLength(7);
    expect(presenter.gapColumns(true)).not.toContain("col.type");

    const row = gapRow();
    expect(presenter.gapRows([row], false)[0]).toHaveLength(presenter.gapColumns(false).length);
    expect(presenter.gapRows([row], true)[0]).toHaveLength(presenter.gapColumns(true).length);
    // ordem: competência, capacidade, [tipo], pessoas, médias, gap, classificação
    expect(presenter.gapRows([row], false)[0]!.slice(0, 4)).toEqual([
      "Kubernetes",
      "Cloud",
      "gap.type.blocking",
      2,
    ]);
  });

  it("filename usa a data UTC do relatório", () => {
    const presenter = new TeamReportPresenter(fakeT, input());
    expect(presenter.filename("csv")).toBe("progressao-time-2026-08-26.csv");
    expect(presenter.filename("pdf")).toBe("progressao-time-2026-08-26.pdf");
  });
});

describe("régua única de severidade (OO3-11i)", () => {
  it("gapSeverityOf cobre os 4 degraus, com gap = 0 na fronteira de ok", () => {
    expect(gapSeverityOf(-1)).toBe("ok");
    expect(gapSeverityOf(0)).toBe("ok");
    expect(gapSeverityOf(1)).toBe("low");
    expect(gapSeverityOf(2)).toBe("high");
    expect(gapSeverityOf(3)).toBe("critical");
    expect(gapSeverityOf(5)).toBe("critical");
  });

  it("GapBadge e o presenter devolvem o MESMO rótulo para o mesmo gap — fim da régua dupla", () => {
    const gap = 2;
    // CFG-02 — `GapBadge` consulta a régua efetiva via `useGapSeverityRuler`
    // (React Query); sem resposta de `/api/config/bands`, cai no default do
    // seed — o comportamento que este teste sempre exerceu.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(I18nProvider, null, createElement(GapBadge, { gap })),
      ),
    );
    const badgeText = screen.getByText(/Gap 2/).textContent;

    // Presenter com um `t` real de pt (as mesmas mensagens que o I18nProvider serve).
    const ptT: T = (key, params) => {
      let text = (ptMessages as Record<string, string>)[key] ?? String(key);
      for (const [nome, valor] of Object.entries(params ?? {})) {
        text = text.replaceAll(`{${nome}}`, String(valor));
      }
      return text;
    };
    const presenter = new TeamReportPresenter(ptT, input());
    const classification = presenter.gapRows([gapRow({ maxGap: gap })], false)[0]!.at(-1);
    expect(classification).toBe(badgeText);
    expect(GAP_SEVERITY_MESSAGE_KEY[gapSeverityOf(gap)]).toBe("gap.highPriority");
  });
});
