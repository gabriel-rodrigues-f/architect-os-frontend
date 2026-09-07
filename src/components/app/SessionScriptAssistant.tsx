import { useState } from "react";

import {
  AiGenerateButton,
  AiRunResult,
  GenerationProfileField,
  PersonAdviceBody,
} from "@/components/app/ai-shared";
import { SectionCard } from "@/components/app/ui-bits";
import { useAssistantRun } from "@/hooks/use-assistant-run";
import { personAssistantsApi } from "@/lib/api";
import {
  GenerationProfileChoice,
  type GenerationProfileName,
  type SessionAgenda,
} from "@/lib/assistants";
import type {
  SessionScriptAdvice,
  SessionScriptRequest,
} from "@/lib/gateways/person-assistants.gateway";
import { useI18n } from "@/lib/i18n";

/**
 * O roteiro sugerido mora ONDE a pauta acontece (dono, 2026-09-07): o de 1:1
 * em Mentoria e 1:1, o de PDI no Plano Individual de Desenvolvimento — e não
 * mais na ficha de Talentos do Time. A pauta é fixa por tela, por isso cada
 * instância mostra UM botão: são duas operações de negócio com roteiros de
 * forma diferente (ADR-0087), e um `<select>` de "tipo" esconderia isso de
 * quem usa.
 *
 * O seletor de perfil de geração (Empírico | Moderado | Metodológico, Moderado
 * por padrão) vem ANTES de gerar; o resultado é SUGESTÃO, com "copiar" como
 * próximo passo — a operação que grava está na própria tela, logo ao lado.
 *
 * Quem alcança é a LIDERANÇA da pessoa — a mesma régua do servidor, que
 * responde 403 a qualquer outro. A tela decide isso; o componente só desenha.
 */
export class SessionScriptAgenda {
  private constructor(
    readonly name: SessionAgenda,
    readonly titleKey: `ai.scripts.${"oneOnOne" | "developmentPlan"}.title`,
    readonly actionKey: `ai.scripts.${"oneOnOne" | "developmentPlan"}`,
  ) {}

  static readonly ONE_ON_ONE = new SessionScriptAgenda(
    "one-on-one",
    "ai.scripts.oneOnOne.title",
    "ai.scripts.oneOnOne",
  );

  static readonly DEVELOPMENT_PLAN = new SessionScriptAgenda(
    "development-plan",
    "ai.scripts.developmentPlan.title",
    "ai.scripts.developmentPlan",
  );

  static of(name: SessionAgenda): SessionScriptAgenda {
    return name === "one-on-one" ? this.ONE_ON_ONE : this.DEVELOPMENT_PLAN;
  }
}

export function SessionScriptAssistant({
  architectId,
  personName,
  agenda,
  className,
}: {
  architectId: string;
  personName: string;
  agenda: SessionAgenda;
  className?: string;
}) {
  const { t } = useI18n();
  const pauta = SessionScriptAgenda.of(agenda);
  const [profile, setProfile] = useState<GenerationProfileName>(GenerationProfileChoice.DEFAULT);
  const run = useAssistantRun<SessionScriptRequest, SessionScriptAdvice>(
    ["assistants", "session-script", architectId, agenda],
    (request) => personAssistantsApi.writeSessionScript(request),
  );

  return (
    <SectionCard
      title={t(pauta.titleKey)}
      description={t("ai.scripts.subtitle", { nome: personName })}
      {...(className === undefined ? {} : { className })}
    >
      <GenerationProfileField value={profile} onChange={setProfile} disabled={run.running} />
      <div className="mt-3">
        <AiGenerateButton
          label={t(pauta.actionKey)}
          running={run.running}
          onGenerate={() => {
            run.generate({ architectId, agenda, profile });
          }}
        />
      </div>
      <AiRunResult run={run}>
        {(advice) => <PersonAdviceBody advice={advice} transcriptHeadline={t(pauta.actionKey)} />}
      </AiRunResult>
    </SectionCard>
  );
}
