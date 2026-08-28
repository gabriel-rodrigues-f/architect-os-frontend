import { createFileRoute } from "@tanstack/react-router";

import {
  MenteeFilterCombobox,
  MentoringTimeline,
  NewMentoringSessionDialog,
  PageHeader,
  SectionCard,
  useMentoringTimeline,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/mentoring")({
  head: () => ({
    meta: [
      { title: "Mentoria — Synapse" },
      {
        name: "description",
        content: "Registro e timeline das sessões de mentoria técnica entre arquitetos.",
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
  const sel = useSelectors();

  const menteeOptions = sel.visibleArchitects(user);
  const { filter, setFilter, sessions } = useMentoringTimeline();

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
            <NewMentoringSessionDialog menteeOptions={menteeOptions} />
          </div>
        }
      />

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
