import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CareerFileHeadingSlot } from "@/components/app/CareerFileHeading";
import { OutOfReachScreen } from "@/components/app/OutOfReachScreen";
import { ProfileHeader } from "@/components/app/ProfileHeader";
import { SupportAccessDialog } from "@/components/app/SupportAccessDialog";
import { Callout } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { CareerFileTabs, type CareerFileTab } from "@/lib/career-file";
import { ContextScope, ContextScopes } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";
import { SupportAccess } from "@/lib/support-access";

/**
 * A ROTA-PAI DA FICHA É O LAYOUT — [FA-08]. Antes ela tinha cinco linhas e
 * cada uma das quatro abas reconstruía a mesma composição: guarda de
 * alcance, `OutOfReachScreen`, passe de suporte, `ContextScope`,
 * `ProfileHeader`. O "cabeçalho imóvel" dependia de cada aba montar igual.
 * Agora a guarda, o passe, o escopo e o cabeçalho existem UMA vez, aqui; as
 * abas são só corpo e publicam o próprio título no cabeçalho
 * (`ProfileHeading`). Trocar de aba não remonta o cabeçalho.
 */
export const Route = createFileRoute("/architects/$architectId")({
  component: CareerFileLayout,
});

function CareerFileLayout() {
  const { architectId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab = CareerFileTabs.fromPathname(pathname);
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp(CareerFileTabs.helpKeyOf(tab));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Dono (2026-09-06): o motivo é pedido a CADA abertura da ficha — não
  // fica lembrado na aba. O que a pessoa concedeu vale para as abas desta
  // visita (Evolução, Extrato, Roteiro), que reaproveitam o mesmo passe.
  const [grantedThisVisit, setGrantedThisVisit] = useState(false);
  const needsSupportAccess =
    defaultUiAuthorizationPolicy.readsPeopleOnlyInSupportMode(user) &&
    user.architectId !== architectId &&
    !grantedThisVisit;

  // Evolução, Extrato e Roteiro são da própria pessoa e de quem a lidera
  // (D2). Com só o id na mão a régua é a do papel; a tela confere o vínculo.
  // A negativa vem ANTES de qualquer escopo: quem não alcança não consulta.
  const canOpenCareerTabs =
    !CareerFileTabs.isLeadershipTab(tab) ||
    defaultUiAuthorizationPolicy.canOpenCareerTabsOf(user, architectId);

  if (!canOpenCareerTabs) {
    return (
      <OutOfReachScreen
        title={t(CareerFileTabs.titleKeyOf(tab))}
        help={help}
        reason={t("arch.careerFile.tabsOutOfReach")}
        hint={t("arch.careerFile.tabsOutOfReachHint")}
      />
    );
  }

  if (needsSupportAccess) {
    return (
      <ContextScope contexts={["architects"]}>
        <SupportAccessGate
          architectId={architectId}
          onGranted={() => {
            void queryClient.invalidateQueries();
            setGrantedThisVisit(true);
          }}
          onCancel={() => void navigate({ to: "/" })}
        />
      </ContextScope>
    );
  }

  return (
    <ContextScope contexts={ContextScopes.careerFileOf(architectId)}>
      <CareerFile architectId={architectId} tab={tab} />
    </ContextScope>
  );
}

/** Pede o motivo com o NOME da pessoa na frente — o diretório já diz quem é. */
function SupportAccessGate({
  architectId,
  onGranted,
  onCancel,
}: {
  architectId: string;
  onGranted: () => void;
  onCancel: () => void;
}) {
  // Só o nome da pessoa: o portão pede a fatia `architects` e nada mais —
  // `useSelectors()` indexaria o estado inteiro antes de o motivo existir.
  const person = useStore().architects.find((architect) => architect.id === architectId);
  return (
    <SupportAccessDialog
      architectId={architectId}
      personName={person?.name ?? architectId}
      onGranted={onGranted}
      onCancel={onCancel}
    />
  );
}

/** O cabeçalho fixo da ficha, montado uma vez, com a aba ativa marcada. */
function CareerFile({ architectId, tab }: { architectId: string; tab: CareerFileTab }) {
  const { t } = useI18n();
  const architect = useSelectors().architectById(architectId);
  const supportGrant = architect ? SupportAccess.grantedFor(architect.id) : null;

  return (
    <CareerFileHeadingSlot>
      {supportGrant && architect && (
        <Callout tone="warning" className="mb-4">
          {t("support.banner", { nome: architect.name })}
        </Callout>
      )}
      {architect && <ProfileHeader architect={architect} active={tab} />}
      <Outlet />
    </CareerFileHeadingSlot>
  );
}
