import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";

import {
  Callout,
  type CardsOrTable,
  EmptyState,
  EmptyStateCallToAction,
  KeyFigureCard,
  OutOfReachScreen,
  PageHeader,
  SectionCard,
  SectionHeading,
  SortableHeader,
  StatTones,
  TruncatedText,
  useCardsAndTableViews,
  ViewToggle,
} from "@/components/app";
import type { Professional, Capability } from "@/lib/domain";
import { CapabilityCoveragePresenter, type RiskState } from "@/lib/presenters";
import { CoverageTableOrder } from "@/lib/view-models";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { Registration } from "@/lib/registration";
import { requireTeamAnalysisReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useScoringBands, useSelectors, useStore } from "@/lib/store";
import { defaultNameFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/capability-map")({
  head: () => ({
    meta: [
      { title: "Risco de Concentração — Synapse" },
      {
        name: "description",
        content:
          "Mapa das capacidades técnicas disponíveis no time, com risco de concentração e competências em evolução.",
      },
      { property: "og:title", content: "Risco de Concentração — Synapse" },
      {
        property: "og:description",
        content:
          "Onde há concentração de conhecimento, dependência de pessoas e ausência de referência técnica.",
      },
    ],
  }),
  beforeLoad: requireTeamAnalysisReach,
  component: CapabilityMapPage,
});

const CAPABILITY_MAP_CONTEXTS: readonly ContextScopeRequest[] = [...SELECTOR_CONTEXTS];

function CapabilityMapPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("capabilityMap");
  const canAnalyzeTeam = defaultUiAuthorizationPolicy.canAnalyzeTeam(user);

  if (!canAnalyzeTeam) {
    return (
      <OutOfReachScreen
        title={t("cap.title")}
        help={help}
        reason={t("cap.teamAnalysisOnly")}
        hint={t("cap.teamAnalysisOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={CAPABILITY_MAP_CONTEXTS}>
      <TeamCapabilityCoverage />
    </ContextScope>
  );
}

function TeamCapabilityCoverage() {
  const store = useStore();
  const sel = useSelectors();
  const { t } = useI18n();
  const help = usePageHelp("capabilityMap");
  const [viewOverride, setViewOverride] = useState<CardsOrTable | null>(null);
  const cardsAndTableViews = useCardsAndTableViews();

  const population = sel.activeProfessionals;

  const scoringBands = useScoringBands();

  const presenter = useMemo(
    () => new CapabilityCoveragePresenter(store.capabilities, sel.capabilityAverages, scoringBands),
    [store.capabilities, sel, scoringBands],
  );
  const [order, setOrder] = useState(() => CoverageTableOrder.catalog());
  const withRisk = order.apply(presenter.areas(population));
  const exposed = withRisk.filter(
    (area) => area.risk === "concentrationRisk" || area.risk === "noReference",
  );
  // Números como afirmação (referência FIAP 2026-09-06, §2 item 2): a pergunta
  // do C-Level é "quantas capacidades dependem de uma pessoa só?".
  const concentrated = withRisk.filter((area) => area.risk === "concentrationRisk").length;

  /**
   * A TABELA É POR ONDE ESTA TELA COMEÇA (dono, 2026-09-09: *"quero que o tipo
   * de visualização inicie com linhas ao invés de blocos"*).
   *
   * Antes a tela escolhia sozinha pelo tamanho — cartões até oito áreas em
   * risco, tabela acima disso. A régua parecia razoável e não era: o modo de
   * leitura mudava debaixo da pessoa conforme o time melhorava ou piorava, e a
   * mesma tela abria de dois jeitos em dias diferentes sem ninguém ter pedido.
   * A pergunta desta tela é de comparação — quais capacidades dependem de
   * poucas pessoas —, e comparar é varrer coluna, não passear por cartão.
   * Quem preferir os blocos continua a um clique.
   */
  const view: CardsOrTable = viewOverride ?? "table";

  return (
    <>
      <PageHeader title={t("cap.title")} description={t("cap.subtitle")} help={help} />

      {store.capabilities.length === 0 ? (
        /* Dono (2026-09-08): sem capacidade nenhuma, o botão de cadastro no
         * CENTRO do quadro principal — é o único próximo passo desta tela. */
        <EmptyStateCallToAction
          subject={EmptySubject.CAPABILITY}
          hint={t("cap.empty.hint")}
          registrations={[Registration.CAPABILITY]}
        />
      ) : population.length === 0 ? (
        <EmptyState
          title={EmptySubject.PROFESSIONAL.titleIn(t, "empty.context.inYourScope")}
          hint={t("cap.empty.noScope.hint")}
        />
      ) : (
        <>
          <KeyFigureCard
            className="mb-6"
            label={t("cap.figure.concentration")}
            value={concentrated}
            tone={StatTones.bySeverity(concentrated)}
            caption={t("cap.figure.caption", { n: withRisk.length })}
          />

          {exposed.length > 0 && <NextStepCallout exposedCount={exposed.length} />}

          <div className="mb-3 flex justify-end">
            <ViewToggle view={view} onChange={setViewOverride} options={cardsAndTableViews} />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {view === "table" ? (
              <div className="scroll-visible surface-card overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <SortableHeader
                        column="capability"
                        label={t("col.capability")}
                        direction={order.directionOf("capability")}
                        onToggle={(column) => setOrder(order.toggled(column))}
                      />
                      {presenter.bands.map((band) => (
                        <SortableHeader
                          key={band.key}
                          column={band.key}
                          label={t(band.labelKey)}
                          direction={order.directionOf(band.key)}
                          onToggle={(column) => setOrder(order.toggled(column))}
                          align="center"
                        />
                      ))}
                      <SortableHeader
                        column="notAssessed"
                        label={t("cap.table.col.notAssessed")}
                        direction={order.directionOf("notAssessed")}
                        onToggle={(column) => setOrder(order.toggled(column))}
                        align="center"
                      />
                      <SortableHeader
                        column="risk"
                        label={t("cap.table.col.risk")}
                        direction={order.directionOf("risk")}
                        onToggle={(column) => setOrder(order.toggled(column))}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {withRisk.map((area) => (
                      <tr key={area.cat.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          <TruncatedText text={area.cat.name} className="block max-w-[220px]" />
                        </td>
                        {area.bands.map((band) => (
                          <td key={band.key} className="px-4 py-3 text-center tabular-nums">
                            {band.people.length}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center tabular-nums">
                          {area.unassessed.length === 0 ? (
                            area.notAssessed
                          ) : (
                            <UnassessedDisclosure
                              capability={area.cat}
                              people={area.unassessed}
                              className="font-medium text-foreground transition-fast hover:text-primary focus-visible:focus-ring"
                            >
                              {area.notAssessed}
                            </UnassessedDisclosure>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <RiskText risk={area.risk} referenceCount={area.references.length} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {withRisk.map((area) => (
                  <SectionCard
                    key={area.cat.id}
                    title={area.cat.name}
                    description={t(`cap.risk.${area.risk}`, { n: area.references.length })}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {area.bands.map((band) => (
                        <Group
                          key={band.key}
                          label={t(band.labelKey)}
                          people={band.people.map((p) => p.professional)}
                          tone={band.tone}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("cap.references.label")}{" "}
                      <ProfileLinkList people={area.references.map((p) => p.professional)} />
                    </p>
                    {area.unassessed.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <UnassessedDisclosure
                          capability={area.cat}
                          people={area.unassessed}
                          className="text-left transition-fast hover:text-foreground focus-visible:focus-ring"
                        >
                          {t("cap.notAssessed", { n: area.notAssessed })}
                        </UnassessedDisclosure>
                      </div>
                    )}
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Dono (2026-09-08, item 3 da fila): *"tirar o aspecto de botão da coluna
 * Risco — parece clicável e não é"*. Era um `Badge`, com moldura, fundo e
 * peso de botão numa coluna que ninguém aciona. Vira TEXTO: só o tom
 * distingue os quatro estados, e a frase inteira — que morava num `title=`
 * nativo, invisível ao toque e ao teclado ([F-02]) — fica visível para quem
 * usa leitor de tela.
 */
const RISK_TONE: Record<RiskState, string> = {
  concentrationRisk: "text-destructive",
  noReference: "text-muted-foreground",
  insufficientData: "text-muted-foreground",
  distributedCoverage: "text-foreground",
};

function RiskText({ risk, referenceCount }: { risk: RiskState; referenceCount: number }) {
  const { t } = useI18n();
  return (
    <>
      <span data-risk={risk} className={cn("font-medium", RISK_TONE[risk])}>
        {t(`cap.risk.badge.${risk}`)}
      </span>
      <span className="sr-only">{t(`cap.risk.${risk}`, { n: referenceCount })}</span>
    </>
  );
}

function Group({
  label,
  people,
  tone,
}: {
  label: string;
  people: readonly Professional[];
  tone: string;
}) {
  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between">
        <SectionHeading as="p" muted>
          {label}
        </SectionHeading>
        <span className={`rounded-md px-1.5 text-xs font-semibold tabular-nums ${tone}`}>
          {people.length}
        </span>
      </div>
      <p className="mt-1 text-sm">
        <ProfileLinkList people={people} emptyLabel="—" />
      </p>
    </div>
  );
}

function UnassessedDisclosure({
  capability,
  people,
  className,
  children,
}: {
  capability: Capability;
  people: readonly Professional[];
  className: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = `cap-unassessed-${capability.id}`;
  const params = { n: people.length, capacidade: capability.name };
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t(open ? "cap.notAssessed.hide" : "cap.notAssessed.reveal", params)}
        className={className}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </button>
      {open && (
        <ul id={listId} aria-label={t("cap.notAssessed.list", params)} className="mt-1 space-y-0.5">
          {people.map((professional) => (
            <li key={professional.id}>
              <Link
                to="/assessments"
                search={{ professionalId: professional.id }}
                title={t("cap.notAssessed.openAssessment", { nome: professional.name })}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {professional.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ProfileLinkList({
  people,
  max = 5,
  emptyLabel,
}: {
  people: readonly Professional[];
  max?: number;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  if (people.length === 0) return <>{emptyLabel ?? t("common.none")}</>;
  const { shown, remaining } = defaultNameFormatter.truncateNames(
    people.map((professional) => professional.name),
    max,
  );
  return (
    <span title={people.map((professional) => professional.name).join(", ")}>
      {people.slice(0, shown.length).map((professional, index) => (
        <span key={professional.id}>
          {index > 0 && ", "}
          <Link
            to="/professionals/$professionalId"
            params={{ professionalId: professional.id }}
            className="underline-offset-2 hover:underline"
          >
            {professional.name}
          </Link>
        </span>
      ))}
      {remaining > 0 && ` ${t("common.andMoreCount", { n: remaining })}`}
    </span>
  );
}

function NextStepCallout({ exposedCount }: { exposedCount: number }) {
  const { t } = useI18n();
  return (
    <Callout tone="warning" className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p>{t("cap.nextStep.exposed", { n: exposedCount })}</p>
      <span className="flex flex-wrap items-center gap-3 font-medium">
        <Link to="/mentoring" className="underline underline-offset-2">
          {t("cap.nextStep.mentoring")}
        </Link>
      </span>
    </Callout>
  );
}
