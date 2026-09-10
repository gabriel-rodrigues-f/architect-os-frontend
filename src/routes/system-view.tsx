import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app";
import { SystemOverview } from "@/components/app/system-overview";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireSystemOperatorReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";

/**
 * `Gestão → Visão do Sistema` — a tela de OPERAÇÃO, com endereço próprio
 * (onda 3 do Painel Executivo).
 *
 * Até aqui ela morava dentro de `/`, escolhida por papel: o administrador que
 * clicava "Painel Executivo" via contagens de cadastro, e o gerente via o
 * painel de negócio. Duas telas, um endereço, e nenhuma das duas alcançável
 * pela outra pessoa. Agora a operação é sua própria rota — de quem opera o
 * sistema, administrador e suporte —, e o Painel de negócio passa a existir
 * também para o administrador.
 */
export const Route = createFileRoute("/system-view")({
  head: () => ({
    meta: [
      { title: "Visão do Sistema — Synapse" },
      {
        name: "description",
        content:
          "O sistema em números: pessoas, times, contas, ciclo vigente e o estado das avaliações e dos PDIs.",
      },
      { property: "og:title", content: "Visão do Sistema — Synapse" },
      {
        property: "og:description",
        content: "O sistema em números, para quem opera o produto.",
      },
    ],
  }),
  beforeLoad: requireSystemOperatorReach,
  component: SystemViewPage,
});

function SystemViewPage() {
  const { t } = useI18n();
  const help = usePageHelp("systemView");
  const user = useCurrentUser();
  const operatesTheSystem = defaultUiAuthorizationPolicy.operatesTheSystem(user);

  if (!operatesTheSystem) {
    return (
      <>
        <PageHeader title={t("dash.ops.title")} help={help} />
        <p className="text-body text-muted-foreground">{t("systemView.outOfReach")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("dash.ops.title")} description={t("dash.ops.subtitle")} help={help} />
      <SystemOverview />
    </>
  );
}
