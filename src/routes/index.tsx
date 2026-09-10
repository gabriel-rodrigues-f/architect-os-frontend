import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  CapabilityRadar,
  DashboardCardHelp,
  EmptyStateCallToAction,
  GapBadge,
  PageHeader,
  QuerySection,
  RevealSequence,
  SectionCard,
  StatCard,
} from "@/components/app";
import { ExecutivePanel } from "@/components/app/executive-panel";
import { SystemOverview } from "@/components/app/system-overview";
import { useQuery } from "@tanstack/react-query";
import { executiveDashboardApi, type UserRole } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { DashboardEntrance } from "@/lib/dashboard-entrance";
import { PersonalDashboardPresenter } from "@/lib/presenters";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { Registration } from "@/lib/registration";
import type { DevelopmentPlan } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors, useStore } from "@/lib/store";
import { RadarRows } from "@/lib/view-models";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Executivo — Synapse" },
      {
        name: "description",
        content:
          "Painel por papel: a operação do sistema, o time que você lidera ou a sua própria carreira.",
      },
      { property: "og:title", content: "Painel Executivo — Synapse" },
      {
        property: "og:description",
        content:
          "Painel por papel: a operação do sistema, o time que você lidera ou a sua própria carreira.",
      },
    ],
  }),
  component: Dashboard,
});

const PAINEL_CONTEXTS: readonly ContextScopeRequest[] = [
  "professionals",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "activeCycle",
  "plans",
  "learningPaths",
  "mentoringSessions",
];

/**
 * ONDA 3 DO PAINEL EXECUTIVO — o ADMINISTRADOR passa a ver o Painel de
 * negócio, e a operação do sistema sai daqui.
 *
 * Até esta onda `/` despachava três telas por papel, e o administrador — o
 * papel do dono — caía na "Visão do Sistema", que é contagem de cadastro por
 * desenho. Era o que ele tinha na frente quando escreveu "muitos números
 * absolutos". Agora a Visão do Sistema tem endereço próprio (`/system-view`)
 * e quem lê a organização inteira lê também o negócio.
 *
 * O SUPORTE continua fora do Painel de negócio, e é régua, não esquecimento:
 * ele opera o sistema e não lê a carreira de ninguém (papéis, 2026-09-08,
 * adendo 2). O painel dele é a operação, e é a mesma tela do endereço novo.
 */
const HOME_BY_ROLE = {
  admin: LeadHome,
  support: OperationsHome,
  manager: LeadHome,
  tech_lead: LeadHome,
  member: MemberHome,
} satisfies Record<UserRole, () => ReactNode>;

function Dashboard() {
  const user = useCurrentUser();
  const Home = HOME_BY_ROLE[user.role];
  // A entrada orquestrada é da PRIMEIRA abertura depois do login: a marca é
  // consumida uma vez, na montagem — recarregar ou voltar pelo menu não repete.
  const [entrance] = useState(() => DashboardEntrance.consume(user));
  return (
    <ContextScope contexts={PAINEL_CONTEXTS}>
      <RevealSequence enabled={entrance}>
        <Home />
      </RevealSequence>
    </ContextScope>
  );
}

function usePersonalDashboardPresenter() {
  const store = useStore();
  const sel = useSelectors();
  return useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
}

/**
 * O Painel de quem opera o sistema é a VISÃO DO SISTEMA, e ela agora tem
 * endereço próprio (`/system-view`). Aqui fica só o despacho: o suporte que
 * abre o Painel vê a operação, que é o painel dele — a mesma tela, um
 * componente só (regra de reuso).
 */
function OperationsHome() {
  const { t } = useI18n();
  const help = usePageHelp("systemView");
  return (
    <>
      <PageHeader title={t("dash.ops.title")} description={t("dash.ops.subtitle")} help={help} />
      <SystemOverview />
    </>
  );
}

function PlanStatusChip({ status }: { status: DevelopmentPlan["status"] }) {
  const labels = useLabels();
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
        {labels.planStatus[status]}
      </span>
    </div>
  );
}

function MemberHome() {
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const { t } = useI18n();
  const help = usePageHelp("dash");
  const personal = usePersonalDashboardPresenter();
  const professionalId = user.professionalId;
  const professional = professionalId ? sel.professionalById(professionalId) : undefined;

  if (!professionalId || !professional) {
    return (
      <>
        <PageHeader title={t("dash.member.title")} help={help} />
        <SectionCard title={t("dash.member.unlinked.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.member.unlinked.body")}</p>
        </SectionCard>
      </>
    );
  }

  const assessment = sel.assessmentFor(professionalId);
  const plan = sel.planFor(professionalId);
  const itemsByStatus = personal.planItemCounts(professionalId);
  const paths = personal.assignedPaths(professionalId);
  // D2 (dono, 2026-09-05): a pessoa vê os PRÓPRIOS números — radar, distâncias, aderência.
  /*
   * A MESMA RÉGUA DO RADAR COMPARATIVO E DA FICHA (`RadarRows`): sem medida é
   * ausência, nunca zero. Zero é o CENTRO do radar — com o `?? 0` de antes, a
   * capacidade que ninguém tinha medido virava um ponto no meio, a aresta
   * atravessava o polígono, e o Painel afirmava "você tem zero aqui" para
   * quem só não foi avaliado nessa capacidade.
   */
  const ownRadar = RadarRows.currentAgainstTarget(sel.capabilityAverages(professionalId));
  const ownGaps = personal.openGaps(professionalId).slice(0, 6);

  return (
    <>
      <PageHeader
        title={t("dash.member.title")}
        description={t("dash.member.subtitle", { nome: professional.name })}
        help={help}
      />

      {/*
       * Esta faixa era um par — situação da avaliação e evidências pendentes —
       * num `sm:grid-cols-2`. Com a evidência fora do produto (dono,
       * 2026-09-08, regra 17) sobrou um cartão só, e meia largura com um vão
       * ao lado não é layout: a situação da avaliação passa a ocupar a faixa
       * inteira, como o único número que abre o Painel da pessoa.
       */}
      <StatCard
        label={t("dash.member.assessmentStatus")}
        help={<DashboardCardHelp card="memberAssessment" />}
        value={
          assessment ? labels.assessmentStatus[assessment.status] : t("dash.member.noAssessment")
        }
        icon={<ClipboardCheck className="h-4 w-4" />}
        tone={assessment?.status === "Completed" ? "good" : "attention"}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("dash.member.radar.title")}
          description={t("dash.member.radar.subtitle")}
        >
          <CapabilityRadar data={ownRadar} />
        </SectionCard>
        <SectionCard
          title={t("dash.member.priorities.title")}
          description={t("dash.member.priorities.subtitle")}
        >
          {ownGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash.member.priorities.none")}</p>
          ) : (
            <ul className="space-y-2">
              {ownGaps.map((gap) => (
                <li
                  key={gap.item.competencyId}
                  className="flex items-center justify-between gap-3 surface-inset p-2.5"
                >
                  <span className="truncate text-sm">
                    {sel.competencyById(gap.item.competencyId)?.name ?? gap.item.competencyId}
                  </span>
                  <GapBadge gap={gap.gap} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/professionals/$professionalId/roadmap"
            params={{ professionalId }}
            className="mt-3 inline-block text-sm text-primary underline"
          >
            {t("dash.member.roadmap")}
          </Link>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title={t("dash.member.pdi.title")} description={t("dash.member.pdi.subtitle")}>
          {!plan ? (
            <p className="text-sm text-muted-foreground">{t("dash.member.pdi.none")}</p>
          ) : (
            <>
              <PlanStatusChip status={plan.status} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus["Not Started"]}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.notStarted}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus["In Progress"]}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.inProgress}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{labels.planItemStatus.Blocked}</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.blocked}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus.Completed}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.completed}
                  </dd>
                </div>
              </dl>
            </>
          )}
          <Link
            to="/development-plans"
            search={{ professionalId }}
            className="mt-4 inline-block text-xs text-primary hover:underline"
          >
            {t("dash.member.pdi.cta")}
          </Link>
        </SectionCard>

        <SectionCard
          title={t("dash.member.paths.title")}
          description={t("dash.member.paths.subtitle")}
        >
          <ul className="space-y-2">
            {paths.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <Link to="/learning-paths" className="truncate text-sm hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
            {paths.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("dash.member.paths.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

/**
 * O PAINEL EXECUTIVO — um pedido só, sete blocos (onda 3).
 *
 * O que mudou não é a aparência: é DE ONDE vêm os números. Até aqui esta tela
 * baixava nove coleções inteiras e somava no navegador — nenhuma fórmula era
 * contrato de API, nenhuma era testável no servidor, e dois cartões da mesma
 * tela podiam usar recortes diferentes sem que nada reclamasse. Agora tudo
 * vem de `GET /dashboard/executive`, calculado onde há teste.
 *
 * Quem lê: administrador, gerente e tech lead. O recorte de PESSOAS é do
 * servidor — a organização inteira para quem a lê, os times liderados para
 * quem lidera —, então nenhuma contagem desta tela revela gente fora do
 * alcance de quem a abriu.
 */
function LeadHome() {
  const { t } = useI18n();
  const help = usePageHelp("dashLead");
  const { cycles } = useStore();
  const briefing = useQuery({
    queryKey: ["dashboard", "executive"],
    queryFn: () => executiveDashboardApi.briefing(),
    staleTime: 30_000,
    retry: false,
  });

  /*
   * SEM CICLO CADASTRADO, A TELA CONVIDA A CADASTRAR — e a pergunta é feita
   * ao CATÁLOGO de ciclos, nunca ao número da recusa.
   *
   * A tentação era ler o 404 da leitura executiva como "não há ciclo". A
   * regra 18 do dono proíbe: depois dela o 404 diz alcance E inexistente na
   * mesma resposta, de propósito, e quem o engole como ausência faz a recusa
   * sumir sem nada na tela — é o que a catraca do número da recusa guarda. O
   * catálogo de ciclos já chega pela fatia de contexto que esta rota pede —
   * ele responde "não há ciclo" sem ambiguidade nenhuma.
   */
  if (cycles.length === 0) return <NoCycleRegistered title={t("dash.title")} help={help} />;

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.lead.subtitle")} help={help} />
      <QuerySection
        query={briefing}
        errorMessage={t("panel.error")}
        skeleton={<div className="h-24 animate-pulse rounded-md bg-secondary" />}
      >
        {(data) => <ExecutivePanel briefing={data} />}
      </QuerySection>
    </>
  );
}

/**
 * O VAZIO DE CICLO, no molde da casa (dono, 2026-09-08, item 3): linha 1 do
 * assunto, linha 2 desta tela, botão do `Registration`. Ele sobreviveu à onda
 * 3 — o que mudou é QUEM descobre a ausência: antes a tela, somando o que
 * baixou; agora o servidor, que responde "não existe".
 */
function NoCycleRegistered({
  title,
  help,
}: {
  title: string;
  help: ReturnType<typeof usePageHelp>;
}) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={title} help={help} />
      <EmptyStateCallToAction
        subject={EmptySubject.CYCLE}
        hint={t("dash.noCycle.body")}
        registrations={[Registration.CYCLE]}
      />
    </>
  );
}
