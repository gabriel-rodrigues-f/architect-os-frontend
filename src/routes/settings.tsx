import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  ACTION_TYPES,
  EVIDENCE_TYPES,
  LEVELS,
  roleShort,
  type CareerLevel,
  type Level,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useCareerLevelsByRank, useStore } from "@/lib/store";
import { formatDate } from "@/lib/text";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Política de Progressão — Synapse" },
      {
        name: "description",
        content:
          "Referência do modelo: escala de proficiência, perfis por cargo, tipos de ação e evidência.",
      },
      { property: "og:title", content: "Política de Progressão — Synapse" },
      {
        property: "og:description",
        content: "Configuração e glossário do modelo de desenvolvimento técnico.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const labels = useLabels();
  const { t, locale } = useI18n();
  const help = usePageHelp("settings");
  const isAdmin = useCurrentUser().role === "admin";

  return (
    <>
      <PageHeader title={t("ref.title")} description={t("ref.subtitle")} help={help} />

      <div className="grid gap-6 xl:grid-cols-2">
        <CareerPolicySection isAdmin={isAdmin} />
      </div>

      {/* R2-TXT-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o menu chama esta
          tela de "Política de Progressão" (título acima já reflete isso); o
          restante da página é glossário read-only, por isso ganha um
          cabeçalho interno próprio em vez de se misturar visualmente com a
          política editável. */}
      <h2 className="mb-4 mt-6 font-display text-lg font-semibold">
        {t("ref.referenceSectionTitle")}
      </h2>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("ref.scale")} description={t("ref.scale.subtitle")}>
          <ul className="space-y-2">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-start gap-3 surface-inset p-3">
                <LevelBadge level={l.level} showName />
                <p className="text-sm text-muted-foreground">{labels.levelDescription[l.level]}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("ref.cycles")} description={t("ref.cycles.subtitle")}>
          <ul className="space-y-2">
            {store.cycles.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between surface-inset p-3 text-sm"
              >
                <span>
                  <strong>{c.name}</strong>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(c.start, locale)} → {formatDate(c.end, locale)}
                  </span>
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {labels.cycleStatus[c.status]}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("ref.profiles")} description={t("ref.profiles.subtitle")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("ref.capability")}
                  </th>
                  {careerLevels.map((cl) => (
                    <th key={cl.id} scope="col" className="py-2 text-center">
                      {roleShort(cl.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {store.capabilities.map((cat) => {
                  const comps = store.competencies.filter((c) => c.capabilityId === cat.id);
                  return (
                    <tr key={cat.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{cat.name}</td>
                      {careerLevels.map((cl) => {
                        // B-38 — `expected` não garante mais a chave presente
                        // (nível de carreira sem curadoria ainda nesta
                        // competência); a média considera só quem TEM valor,
                        // nunca trata ausência como 0 (mesma filosofia de
                        // MISSING ≠ 0 do resto do app).
                        const values = comps
                          .map((c) => c.expected[cl.id])
                          .filter((v): v is Level => v !== undefined);
                        const avg = values.length
                          ? values.reduce((s, v) => s + v, 0) / values.length
                          : undefined;
                        return (
                          <td key={cl.id} className="py-2 text-center tabular-nums">
                            {avg === undefined ? "—" : avg.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title={t("ref.taxonomies.title")} description={t("ref.taxonomies.subtitle")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ref.taxonomies.actionTypes")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ACTION_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.actionType[a]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ref.taxonomies.evidenceTypes")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EVIDENCE_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.evidenceType[a]}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

/**
 * ORIENTACAO-NONA-RODADA, Seção 16 (ENT-09-009) — "Política de Progressão":
 * existia API (`PATCH /api/career-levels/:id/policy`) desde a rodada
 * anterior, mas nenhuma tela administrativa. Cada nível edita só a própria
 * linha — otimista o bastante para não precisar de um formulário separado,
 * mas com estado de erro de verdade (o piso global de 3 é aplicado no
 * servidor, `career_level_policies` CHECK, Seção 9).
 */
function CareerPolicySection({ isAdmin }: { isAdmin: boolean }) {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const readyCapabilities = store.capabilities.filter((c) => c.curation.status === "READY").length;
  const { t } = useI18n();

  return (
    <SectionCard title={t("policy.title")} description={t("policy.subtitle")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2">
                {t("policy.col.careerLevel")}
              </th>
              <th scope="col" className="py-2 text-center">
                {t("policy.col.minimumQualified")}
              </th>
              {isAdmin && <th scope="col" className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {careerLevels.map((level) => {
              const policy = store.careerLevelPolicies.find((p) => p.careerLevelId === level.id);
              return (
                <CareerPolicyRow
                  key={level.id}
                  level={level}
                  minimum={policy?.minimumQualifiedCapabilities}
                  readyCapabilities={readyCapabilities}
                  isAdmin={isAdmin}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function CareerPolicyRow({
  level,
  minimum,
  readyCapabilities,
  isAdmin,
}: {
  level: CareerLevel;
  minimum: number | undefined;
  readyCapabilities: number;
  isAdmin: boolean;
}) {
  const store = useStore();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(minimum ?? 3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftValue = Number(draft);
  const canSave = Number.isInteger(draftValue) && draftValue >= 3;
  const impossible = minimum !== undefined && minimum > readyCapabilities;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await store.updateCareerLevelPolicy(level.id, draftValue);
      toast.success(`Política do ${level.name} atualizada.`);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível salvar a política.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-2">
        <p className="font-medium">{level.name}</p>
        <p className="text-xs text-muted-foreground">
          {t("policy.row.hint", { nivel: level.name, minimo: minimum ?? "—" })}
        </p>
        {impossible && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {t("policy.row.warning", { minimo: minimum, prontas: readyCapabilities })}
          </p>
        )}
      </td>
      <td className="py-2 text-center">
        {editing ? (
          <input
            type="number"
            min={3}
            step={1}
            disabled={saving}
            className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <span className="tabular-nums">{minimum ?? "—"}</span>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </td>
      {isAdmin && (
        <td className="py-2 text-right">
          {editing ? (
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(String(minimum ?? 3));
                  setError(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={!canSave || saving} onClick={() => void save()}>
                {saving ? t("team.transition.submitting") : t("common.save")}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}
