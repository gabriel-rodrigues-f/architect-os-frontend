import { createFileRoute } from "@tanstack/react-router";

import {
  EmptyStateCallToAction,
  MenteeFilterCombobox,
  MentoringFollowUp,
  MentoringTimeline,
  NewMentoringSessionDialog,
  PageHeader,
  SectionCard,
  useMentoringTimeline,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { Registration } from "@/lib/registration";
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
        content: "Tema, notas e próximos passos de cada sessão de mentoria.",
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
   * vê as próprias sessões. Registrar sessão é de quem mentora, e ninguém
   * mentora a si mesmo (dono, 2026-09-05). "Preparar a 1:1" também era, e
   * saiu do produto em 2026-09-09 com a IA desta tela.
   */
  const menteeOptions = defaultUiAuthorizationPolicy.mentorableBy(user, store.professionals);
  const { filter, setFilter, sessions } = useMentoringTimeline();
  const mentee = store.professionals.find((professional) => professional.id === filter);
  // Dono (2026-09-08): o cadastro sai do filtro e vai para o centro do quadro.
  const semNinguem = store.professionals.length === 0;

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

      {semNinguem && (
        <EmptyStateCallToAction
          subject={EmptySubject.PROFESSIONAL}
          hint={t("mentor.empty.noProfessionals")}
          registrations={[Registration.PROFESSIONAL]}
        />
      )}

      {/*
        A IA SAI DAQUI (dono, 2026-09-09): *"Em Mentoria e 1:1, pode remover a
        parte da IA, não é útil. Mantenha somente o bloco Linha do Tempo."*

        Aqui morava a "Preparação do 1:1" — um cartão com seletor de perfil de
        geração e o botão "Preparar o 1:1", que respondia na ordem liturgia →
        resumo do perfil → SWOT. Ela reverte o pedido do MESMO dia que mandava
        mantê-la; o mais recente vence.

        A tela fica com a Linha do Tempo e o cadastro, que é o que ele pediu.
      */}
      {!semNinguem && (
        <SectionCard
          title={t("mentor.timeline.title")}
          description={t("mentor.timeline.forPerson", {
            n: sessions.length,
            nome: mentee?.name ?? "",
          })}
          /*
            Dono (2026-09-08): o follow-up é UM só, no canto superior da caixa
            — a evolução é contínua, e a próxima conversa não pende de cada
            linha da história.
          */
          actions={<MentoringFollowUp sessions={sessions} />}
        >
          <MentoringTimeline sessions={sessions} />
        </SectionCard>
      )}
    </>
  );
}
