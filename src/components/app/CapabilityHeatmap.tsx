import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { capHeatmapColumns, HeatmapColumnsNotice } from "@/components/app/gap-analysis-shared";
import { LevelCell } from "@/components/app/ui-bits";
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

  return (
    <>
      <HeatmapColumnsNotice
        shown={visibleCapabilities.length}
        total={capabilities.length}
        showAll={showAll}
        onToggle={toggle}
      />
      {}
      <div className="max-h-[480px] overflow-auto">
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
                  <td className="sticky left-0 z-10 bg-card py-1">
                    <Link
                      to="/architects/$architectId"
                      params={{ architectId: a.id }}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {a.name}
                    </Link>
                  </td>
                ) : (
                  <td className="sticky left-0 z-10 bg-card text-sm font-medium">{a.name}</td>
                )}
                {capabilityAveragesFor(a.id)
                  .filter((d) => visibleCapabilityIds.has(d.capability.id))
                  .map((d) => (
                    <td key={d.capability.id} className="min-w-[52px]">
                      <LevelCell level={d.avg === undefined ? undefined : Math.round(d.avg)} />
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
