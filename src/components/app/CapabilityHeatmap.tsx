import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { capHeatmapColumns, HeatmapColumnsNotice } from "@/components/app/gap-analysis-shared";
import { LevelHeatCell, LevelScaleKey } from "@/components/app/level-encoding";
import { useHorizontalOverflow } from "@/hooks";
import type { Capability } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import type { CapabilityAverage } from "@/lib/selectors";
import { useSelectors } from "@/lib/store";

function useHeatmapColumns(
  capabilities: readonly Capability[],
  architects: readonly { id: string }[],
  capabilityAveragesFor: (architectId: string) => readonly CapabilityAverage[],
) {
  const [showAll, setShowAll] = useState(false);
  const visibleCapabilities = showAll
    ? [...capabilities]
    : capHeatmapColumns(capabilities, architects, capabilityAveragesFor);
  const visibleCapabilityIds = new Set(visibleCapabilities.map((c) => c.id));
  return {
    visibleCapabilities,
    visibleCapabilityIds,
    showAll,
    toggle: () => setShowAll((v) => !v),
  };
}

export function CapabilityHeatmap({
  architects,
  capabilities,
  capabilityAveragesFor,
  linkToProfile = false,
}: {
  architects: readonly { id: string; name: string }[];
  capabilities: readonly Capability[];
  capabilityAveragesFor: (architectId: string) => readonly CapabilityAverage[];
  linkToProfile?: boolean;
}) {
  const { t } = useI18n();
  const sel = useSelectors();
  const { visibleCapabilities, visibleCapabilityIds, showAll, toggle } = useHeatmapColumns(
    capabilities,
    architects,
    capabilityAveragesFor,
  );
  const { scrollRef, overflowStart, overflowEnd } = useHorizontalOverflow<HTMLDivElement>();

  return (
    <>
      <HeatmapColumnsNotice
        shown={visibleCapabilities.length}
        total={capabilities.length}
        showAll={showAll}
        onToggle={toggle}
      />
      <LevelScaleKey />
      <div className="relative">
        <div ref={scrollRef} data-testid="heatmap-scroll" className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-20 w-44 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {t("col.architect")}
                </th>
                {visibleCapabilities.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="sticky top-0 z-10 max-w-[64px] truncate bg-card text-center text-[11px] text-muted-foreground"
                    title={c.name}
                  >
                    {sel.capabilityShortLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {architects.map((a) => (
                <tr key={a.id}>
                  {linkToProfile ? (
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card py-1 text-left text-sm font-medium"
                    >
                      <Link
                        to="/architects/$architectId"
                        params={{ architectId: a.id }}
                        className="hover:text-primary"
                      >
                        {a.name}
                      </Link>
                    </th>
                  ) : (
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card text-left text-sm font-medium"
                    >
                      {a.name}
                    </th>
                  )}
                  {capabilityAveragesFor(a.id)
                    .filter((d) => visibleCapabilityIds.has(d.capability.id))
                    .map((d) => (
                      <td key={d.capability.id} className="min-w-[52px]">
                        <LevelHeatCell
                          level={d.avg === undefined ? undefined : Math.round(d.avg)}
                        />
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overflowStart && (
          <div
            aria-hidden="true"
            data-overflow-edge="start"
            className="pointer-events-none absolute inset-y-0 left-44 w-6 bg-gradient-to-r from-card to-transparent"
          />
        )}
        {overflowEnd && (
          <div
            aria-hidden="true"
            data-overflow-edge="end"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
          />
        )}
      </div>
    </>
  );
}
