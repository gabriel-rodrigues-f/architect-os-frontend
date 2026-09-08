import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CareerFileHeadingSlot, ProfileHeading } from "@/components/app/CareerFileHeading";
import { OutOfReachScreen } from "@/components/app/OutOfReachScreen";
import { ProfileHeader } from "@/components/app/ProfileHeader";
import { SupportAccessDialog } from "@/components/app/SupportAccessDialog";
import { Callout } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { CareerFileTabs, type CareerFileTab } from "@/lib/career-file";
import { ContextScope, ContextScopes } from "@/lib/context-scope";
import { useContainer } from "@/lib/dependencies";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSeniorityReading } from "@/lib/seniority";
import { ConnectionError, LoadingState, useSelectors, useStore } from "@/lib/store";
import type { SupportPass } from "@/lib/support-access";

/**
 * A ROTA-PAI DA FICHA É O LAYOUT — [FA-08]. Antes ela tinha cinco linhas e
 * cada uma das quatro abas reconstruía a mesma composição: guarda de
 * alcance, `OutOfReachScreen`, passe de suporte, `ContextScope`,
 * `ProfileHeader`. O "cabeçalho imóvel" dependia de cada aba montar igual.
 * Agora a guarda, o passe, o escopo e o cabeçalho existem UMA vez, aqui; as
 * abas são só corpo e publicam o próprio título no cabeçalho
 * (`ProfileHeading`). Trocar de aba não remonta o cabeçalho.
 *
 * EM MODO DE SUPORTE (PR 6, RBAC-03) o passe abre só a ficha funcional
 * (`GET /professionals/:id`): avaliações, PDI, mentoria, evidências, extrato,
 * evolução e trilhas respondem 403 ao suporte mesmo com passe. A tela não
 * pede o que o serviço recusa — desenha o ramo "indisponível" no lugar das
 * abas (`SupportModeCareerFile`) e a ficha funcional segue.
 */
export const Route = createFileRoute("/professionals/$professionalId")({
  component: CareerFileLayout,
});

function CareerFileLayout() {
  const { professionalId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab = CareerFileTabs.fromPathname(pathname);
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp(CareerFileTabs.helpKeyOf(tab));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { supportAccess } = useContainer();
  // Dono (2026-09-06): o motivo é pedido a CADA abertura da ficha — não
  // fica lembrado na aba. O que a pessoa concedeu vale para as abas desta
  // visita (Evolução, Extrato, Roteiro), que reaproveitam o mesmo passe.
  // PR 6: o passe vence em 15 minutos; quando o serviço o recusa
  // (`SUPPORT_PASS_EXPIRED`), o container apaga o passe e o diálogo volta.
  const [grantedThisVisit, setGrantedThisVisit] = useState(false);
  useEffect(() => {
    supportAccess.whenExpired(() => setGrantedThisVisit(false));
    return () => supportAccess.whenExpired(null);
  }, [supportAccess]);
  const inSupportMode =
    defaultUiAuthorizationPolicy.readsPeopleOnlyInSupportMode(user) &&
    user.professionalId !== professionalId;
  const supportPass =
    inSupportMode && grantedThisVisit ? supportAccess.grantedFor(professionalId) : null;
  const needsSupportAccess = inSupportMode && supportPass === null;

  // Evolução, Extrato e Roteiro são da própria pessoa e de quem a lidera
  // (D2). Com só o id na mão a régua é a do papel; a tela confere o vínculo.
  // A negativa vem ANTES de qualquer escopo: quem não alcança não consulta.
  const canOpenCareerTabs =
    !CareerFileTabs.isLeadershipTab(tab) ||
    defaultUiAuthorizationPolicy.canOpenCareerTabsOf(user, professionalId);

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
      <ContextScope contexts={["professionals"]}>
        <SupportAccessGate
          professionalId={professionalId}
          onGranted={() => {
            void queryClient.invalidateQueries();
            setGrantedThisVisit(true);
          }}
          onCancel={() => void navigate({ to: "/" })}
        />
      </ContextScope>
    );
  }

  if (supportPass) {
    return <SupportModeCareerFile pass={supportPass} tab={tab} help={help} />;
  }

  return (
    <ContextScope contexts={ContextScopes.careerFileOf(professionalId)}>
      <CareerFile professionalId={professionalId} tab={tab} />
    </ContextScope>
  );
}

/**
 * A FICHA FUNCIONAL em modo de suporte: só `GET /professionals/:id` (com os
 * três cabeçalhos do passe), o cabeçalho fixo com nome, posição e status, e
 * o ramo "indisponível" no lugar de qualquer aba. Nenhuma fatia por pessoa é
 * pedida — o serviço a recusaria com 403.
 */
function SupportModeCareerFile({
  pass,
  tab,
  help,
}: {
  pass: SupportPass;
  tab: CareerFileTab;
  help: ReturnType<typeof usePageHelp>;
}) {
  const { t } = useI18n();
  const { professionalsGateway } = useContainer();
  const seniority = useSeniorityReading();
  const query = useQuery({
    queryKey: [
      "professionals",
      pass.professionalId,
      "ficha-funcional",
      pass.issuedAt.toISOString(),
    ],
    queryFn: () => professionalsGateway.professional(pass.professionalId),
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ConnectionError
        error={query.error}
        onRetry={() => void query.refetch()}
        resource="professionals"
      />
    );
  }
  const professional = query.data;
  const heading = {
    title: professional.name,
    description: `${seniority.labelOf(professional.role)} · ${t("arch.yearsOfExperience", { n: professional.yearsAsProfessional })}`,
    help,
  };

  return (
    <CareerFileHeadingSlot>
      <Callout tone="warning" className="mb-4">
        {t("support.banner", { nome: professional.name })}
      </Callout>
      <ProfileHeader professional={professional} active={tab} tabs={false} />
      <ProfileHeading {...heading} />
      <Callout tone="info" role="status">
        {t("support.unavailable")}
      </Callout>
    </CareerFileHeadingSlot>
  );
}

/** Pede o motivo com o NOME da pessoa na frente — o diretório já diz quem é. */
function SupportAccessGate({
  professionalId,
  onGranted,
  onCancel,
}: {
  professionalId: string;
  onGranted: () => void;
  onCancel: () => void;
}) {
  // Só o nome da pessoa: o portão pede a fatia `professionals` e nada mais —
  // `useSelectors()` indexaria o estado inteiro antes de o motivo existir.
  const person = useStore().professionals.find(
    (professional) => professional.id === professionalId,
  );
  return (
    <SupportAccessDialog
      professionalId={professionalId}
      personName={person?.name ?? professionalId}
      onGranted={onGranted}
      onCancel={onCancel}
    />
  );
}

/** O cabeçalho fixo da ficha, montado uma vez, com a aba ativa marcada. */
function CareerFile({ professionalId, tab }: { professionalId: string; tab: CareerFileTab }) {
  const professional = useSelectors().professionalById(professionalId);

  return (
    <CareerFileHeadingSlot>
      {professional && <ProfileHeader professional={professional} active={tab} />}
      <Outlet />
    </CareerFileHeadingSlot>
  );
}
