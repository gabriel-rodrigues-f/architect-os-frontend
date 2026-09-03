import { createFileRoute } from "@tanstack/react-router";

import {
  MenteeFilterCombobox,
  MentoringTimeline,
  NewMentoringSessionDialog,
  PageHeader,
  PersonAdviceSection,
  SectionCard,
  useMentoringTimeline,
} from "@/components/app";
import { personAssistantsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { usePageHelp } from "@/lib/page-help";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/mentoring")({
  head: () => ({
    meta: [
      { title: "Mentoria — Synapse" },
      {
        name: "description",
        content: "Registro e timeline das sessões de mentoria técnica entre profissionais.",
      },
      { property: "og:title", content: "Mentoria — Synapse" },
      {
        property: "og:description",
        content: "Temas, decisões, ações e próximos passos de cada sessão de mentoria.",
      },
    ],
  }),
  component: MentoringPage,
});

function MentoringPage() {
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("mentoring");
  const user = useCurrentUser();

  const menteeOptions = store.architects;
  const { filter, setFilter, sessions } = useMentoringTimeline();
  const mentee = store.architects.find((architect) => architect.id === filter);
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
              architects={store.architects}
              selected={filter}
              onChange={setFilter}
            />
            <NewMentoringSessionDialog menteeOptions={menteeOptions} onRegistered={setFilter} />
          </div>
        }
      />

      {canPrepare && (
        <PersonAdviceSection
          className="mb-6"
          title={t("ai.oneOnOne.title")}
          description={t("ai.oneOnOne.subtitle", { nome: mentee.name })}
          actionLabel={t("ai.oneOnOne.action")}
          transcriptHeadline={t("ai.oneOnOne.title")}
          queryKey={["assistants", "one-on-one-preparation", mentee.id]}
          ask={() => personAssistantsApi.prepareOneOnOne(mentee.id)}
        />
      )}

      <SectionCard
        title={t("mentor.timeline.title")}
        description={t("mentor.timeline.forPerson", {
          n: sessions.length,
          nome: store.architects.find((a) => a.id === filter)?.name ?? "",
        })}
      >
        <MentoringTimeline sessions={sessions} />
      </SectionCard>
    </>
  );
}
