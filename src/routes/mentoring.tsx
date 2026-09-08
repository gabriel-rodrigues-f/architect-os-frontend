import { createFileRoute } from "@tanstack/react-router";

import {
  MenteeFilterCombobox,
  MentoringTimeline,
  NewMentoringSessionDialog,
  OneOnOnePreparationNarration,
  PageHeader,
  ProfiledAdviceSection,
  SectionCard,
  useMentoringTimeline,
} from "@/components/app";
import { personAssistantsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { usePageHelp } from "@/lib/page-help";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/mentoring")({
  head: () => ({
    meta: [
      { title: "Mentoria e 1:1 — Synapse" },
      {
        name: "description",
        content: "Registro e timeline das sessões de mentoria técnica entre profissionais.",
      },
      { property: "og:title", content: "Mentoria e 1:1 — Synapse" },
      {
        property: "og:description",
        content: "Temas, decisões, ações e próximos passos de cada sessão de mentoria.",
      },
    ],
  }),
  component: MentoringPage,
});

const MENTORING_CONTEXTS: readonly ContextScopeRequest[] = [
  ...SELECTOR_CONTEXTS,
  "mentoringSessions",
];

function MentoringPage() {
  return (
    <ContextScope contexts={MENTORING_CONTEXTS}>
      <MentoringScreen />
    </ContextScope>
  );
}

function MentoringScreen() {
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("mentoring");
  const user = useCurrentUser();

  /**
   * A linha do tempo é de LEITURA e mostra todo o alcance — quem foi mentorado
   * vê as próprias sessões. Registrar sessão e preparar a 1:1 são de quem
   * mentora, e ninguém mentora a si mesmo (dono, 2026-09-05).
   */
  const menteeOptions = defaultUiAuthorizationPolicy.mentorableBy(user, store.professionals);
  const { filter, setFilter, sessions } = useMentoringTimeline();
  const mentee = store.professionals.find((professional) => professional.id === filter);
  const canPrepare = mentee !== undefined && defaultUiAuthorizationPolicy.isLeadOf(user, mentee);

  return (
    <>
      <PageHeader
        title={t("mentor.title")}
        description={t("mentor.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MenteeFilterCombobox
              professionals={store.professionals}
              selected={filter}
              onChange={setFilter}
            />
            {menteeOptions.length > 0 && (
              <NewMentoringSessionDialog menteeOptions={menteeOptions} onRegistered={setFilter} />
            )}
          </div>
        }
      />

      {/*
        Um cartão só de IA (dono, 2026-09-07): o roteiro de 1:1 se consolidou
        na preparação, que responde na ordem liturgia → resumo do perfil →
        SWOT, com o perfil de geração que o roteiro tinha.
      */}
      {canPrepare && (
        <ProfiledAdviceSection
          className="mb-6"
          title={t("ai.oneOnOne.title")}
          description={t("ai.oneOnOne.subtitle", { nome: mentee.name })}
          actionLabel={t("ai.oneOnOne.action")}
          transcriptHeadline={t("ai.oneOnOne.title")}
          queryKey={["assistants", "one-on-one-preparation", mentee.id]}
          ask={(profile) =>
            personAssistantsApi.prepareOneOnOne({ professionalId: mentee.id, profile })
          }
          narration={(text) => <OneOnOnePreparationNarration text={text} />}
        />
      )}

      <SectionCard
        title={t("mentor.timeline.title")}
        description={t("mentor.timeline.forPerson", {
          n: sessions.length,
          nome: mentee?.name ?? "",
        })}
      >
        <MentoringTimeline sessions={sessions} />
      </SectionCard>
    </>
  );
}
