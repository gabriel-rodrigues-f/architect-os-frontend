import { createFileRoute } from "@tanstack/react-router";

import {
  LevelBadge,
  ProgressionCriteriaRefusal,
  ProgressionCriteriaScreen,
  ScrollPane,
  SectionCard,
  SectionHelp,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { PaneHeight } from "@/lib/design";
import { LEVELS } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { requireLeadershipReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";

/**
 * REFERÊNCIA DO MODELO — a sexta fatia do grupo Critérios de Progressão.
 *
 * A FILA-DO-DONO deixou esta em aberto: *"'Referência do modelo' não é
 * configuração — é leitura… a saída barata é ela continuar sendo um painel
 * dentro de 'Elegibilidade'"*. Ela é ITEM PRÓPRIO, por três motivos medidos
 * no código e não em preferência:
 *
 *   1. **São DOIS cartões, não um.** A escala L1–L5 é de fato a legenda dos
 *      níveis; os CICLOS não são legenda de coisa nenhuma da Elegibilidade —
 *      ali nem entram. Dobrar a referência dentro da Elegibilidade levaria
 *      junto um cartão que não tem o que fazer lá.
 *   2. **O ALCANCE é outro, e é mais largo.** Elegibilidade é de quem rege a
 *      régua de um time; esta leitura é de toda a liderança — o tech lead sem
 *      vínculo consulta o significado de cada nível antes de pontuar. Enfiar
 *      a leitura dentro da Elegibilidade a esconderia justamente de quem mais
 *      a usa, que é o defeito que esta fatia veio consertar.
 *   3. **Achar de fora é metade do pedido.** O dono trocou abas por menus
 *      para *"enxergar o que tem lá"*. Um item de leitura na coluna é a única
 *      forma de a escala de proficiência ser encontrada sem adivinhação.
 *
 * O item de leitura não se disfarça de configuração: não há ação de escrita
 * nesta tela, e cada cartão diz onde se edita o que ele mostra.
 */
export const Route = createFileRoute("/model-reference")({
  head: () => ({
    meta: [
      { title: "Referência do modelo — Synapse" },
      {
        name: "description",
        content:
          "A escala de proficiência L1–L5 usada em toda avaliação e os períodos de desenvolvimento cadastrados.",
      },
      { property: "og:title", content: "Referência do modelo — Synapse" },
      {
        property: "og:description",
        content: "Leitura do modelo de desenvolvimento técnico: escala e ciclos.",
      },
    ],
  }),
  beforeLoad: requireLeadershipReach,
  component: ModelReferencePage,
});

const MODEL_REFERENCE_CONTEXTS: readonly ContextScopeRequest[] = ["cycles"];

function ModelReferencePage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isLeadership = defaultUiAuthorizationPolicy.isLeadership(user);

  if (!isLeadership) {
    return (
      <ProgressionCriteriaRefusal
        slice="modelReference"
        title={t("ref.referenceSectionTitle")}
        reason={t("ref.leadershipOnly")}
        hint={t("ref.leadershipOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={MODEL_REFERENCE_CONTEXTS}>
      <ModelReferenceScreen />
    </ContextScope>
  );
}

function ModelReferenceScreen() {
  const { t } = useI18n();

  return (
    <ProgressionCriteriaScreen
      slice="modelReference"
      title={t("ref.referenceSectionTitle")}
      description={t("ref.reference.subtitle")}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <ProficiencyScaleCard />
        <CyclesReferenceCard />
      </div>
    </ProgressionCriteriaScreen>
  );
}

function ProficiencyScaleCard() {
  const labels = useLabels();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("ref.scale")}
      description={t("ref.scale.subtitle")}
      help={<SectionHelp section="scale" />}
    >
      <ul className="space-y-2">
        {LEVELS.map((nivel) => (
          <li key={nivel.level} className="flex items-start gap-3 surface-inset p-3">
            <LevelBadge level={nivel.level} showName />
            <p className="text-sm text-muted-foreground">{labels.levelDescription[nivel.level]}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function CyclesReferenceCard() {
  const store = useStore();
  const labels = useLabels();
  const { t, locale } = useI18n();

  return (
    <SectionCard
      title={t("ref.cycles")}
      description={t("ref.cycles.subtitle")}
      help={<SectionHelp section="cycles" />}
    >
      <ScrollPane label={t("pane.modelCycles.label")} height={PaneHeight.items(5)}>
        <ul className="space-y-2">
          {store.cycles.map((ciclo) => (
            <li
              key={ciclo.id}
              className="flex items-center justify-between surface-inset p-3 text-sm"
            >
              <span>
                <strong>{ciclo.name}</strong>{" "}
                <span className="text-muted-foreground">
                  {defaultDateFormatter.formatDate(ciclo.start, locale)} →{" "}
                  {defaultDateFormatter.formatDate(ciclo.end, locale)}
                </span>
              </span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.cycleStatus[ciclo.status]}
              </span>
            </li>
          ))}
        </ul>
      </ScrollPane>
    </SectionCard>
  );
}
