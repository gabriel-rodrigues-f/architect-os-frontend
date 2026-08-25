import { createFileRoute } from "@tanstack/react-router";

import {
  MenteeFilterCombobox,
  MentoringTimeline,
  NewMentoringSessionDialog,
  useMentoringTimeline,
} from "@/components/app/mentoring-shared";
import { PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { canActFor } from "@/lib/scope";
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

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-34 (§12) — a rota vira
 * composição: os ~554 linhas de estado/formulário/linha do tempo que
 * viviam aqui foram para `components/app/mentoring-shared.tsx` (mesmo
 * padrão de `gap-analysis-shared.tsx`, o "melhor padrão do codebase" citado
 * pela auditoria). O que resta aqui é só: quem pode ser mentorado (MENT-001)
 * e como montar o cabeçalho + a seção da linha do tempo.
 */
function MentoringPage() {
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("mentoring");
  // O mentor é quem está registrando a sessão, não um nome fixo no código.
  const user = useCurrentUser();
  const sel = useSelectors();
  /**
   * MENT-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — o
   * backend (`canActFor`, `POST /api/mentoring-sessions`) só aceita a
   * própria pessoa mentorada, o Tech Lead dela, ou admin como autor da
   * sessão; a lista de mentorados nasce restrita ao mesmo escopo, em vez de
   * oferecer qualquer pessoa do roster e devolver 403 só depois de
   * preencher o formulário inteiro.
   */
  const menteeOptions = sel.activeArchitects.filter((a) => canActFor(user, a));
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
