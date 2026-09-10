import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { HelpPopover } from "@/components/app/HelpPopover";
import { SectionHeading } from "@/components/app/SectionHeading";
import { SentenceBlock } from "@/components/app/SentenceBlock";

export interface PageHelpContent {
  title: string;
  what: string;
  comesFrom: string;
  nextStep: string;
}

export function HelpField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <SectionHeading as="p" muted>
        {label}
      </SectionHeading>
      <p className="mt-0.5">
        <SentenceBlock text={text} />
      </p>
    </div>
  );
}

export function PageHelp({
  content,
}: {
  content: { lead: PageHelpContent; member: PageHelpContent };
}) {
  /**
   * O "?" pergunta QUEM está lendo para escolher entre o texto da liderança e o
   * do profissional — e por isso ele é o primeiro a cair quando a sessão some
   * debaixo da tela.
   *
   * Isso não é hipótese: acontece ao trocar a própria senha (Minha Conta →
   * Segurança). Senha nova encerra a sessão de propósito (dono, 2026-09-06:
   * "a pessoa volta pela tela de login, nunca entra direto"), e entre o fim da
   * sessão e o portão desenhar o login há uma pintura em que a página ainda
   * está montada sem ninguém. `useCurrentUser` lança ali, e a tela quebrava em
   * vez de dar lugar ao login.
   *
   * Sem sessão não há página, e sem página não há "?" — ele some, calado. Quem
   * decide o que aparece nessa hora é o portão, não a ajuda de uma tela que já
   * está de saída.
   */
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;
  const persona = defaultUiAuthorizationPolicy.isLeadership(user) ? content.lead : content.member;

  return (
    <HelpPopover label={t("pageHelp.ariaLabel", { tela: persona.title })} title={persona.title}>
      <HelpField label={t("pageHelp.what")} text={persona.what} />
      <HelpField label={t("pageHelp.comesFrom")} text={persona.comesFrom} />
      <HelpField label={t("pageHelp.nextStep")} text={persona.nextStep} />
    </HelpPopover>
  );
}
