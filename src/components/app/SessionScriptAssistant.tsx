import { ProfiledAdviceSection } from "@/components/app/ai-shared";
import { personAssistantsApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * O roteiro de PDI sugerido mora ONDE a pauta acontece (dono, 2026-09-07): no
 * Plano de Desenvolvimento Individual. O roteiro de 1:1 que morava em
 * Mentoria se consolidou na "Preparação do 1:1" (pedido do dono do mesmo
 * dia), então esta é a única pauta que sobrou — sem seletor de pauta, porque
 * uma operação de negócio só não precisa de um.
 *
 * O seletor de perfil de geração e os quatro estados vêm de
 * `ProfiledAdviceSection`; o resultado é SUGESTÃO, com "copiar" como próximo
 * passo — a operação que grava está na própria tela, logo ao lado.
 *
 * Quem alcança é a LIDERANÇA da pessoa — a mesma régua do servidor, que
 * responde 403 a qualquer outro. A tela decide isso; o componente só desenha.
 */
export function SessionScriptAssistant({
  professionalId,
  personName,
  className,
}: {
  professionalId: string;
  personName: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <ProfiledAdviceSection
      title={t("ai.scripts.developmentPlan.title")}
      description={t("ai.scripts.subtitle", { nome: personName })}
      actionLabel={t("ai.scripts.developmentPlan")}
      transcriptHeadline={t("ai.scripts.developmentPlan")}
      queryKey={["assistants", "session-script", professionalId]}
      ask={(profile) => personAssistantsApi.writeSessionScript({ professionalId, profile })}
      {...(className === undefined ? {} : { className })}
    />
  );
}
