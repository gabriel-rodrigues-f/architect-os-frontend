import type { ReactNode } from "react";

import type { Architect } from "@/lib/domain";
import type { PageHelpContent } from "@/components/app/PageHelp";
import { cn } from "@/lib/utils";

import { DeactivatedPersonNotice } from "./DeactivatedPersonNotice";
import { StablePageFrame } from "./PageFrame";
import { PageHeader, ProfileTabs } from "./ui-bits";

/**
 * O cabeçalho da ficha da pessoa — nome, posição/nível e abas — num bloco
 * FIXO enquanto o corpo rola (referência FIAP 2026-09-06, §2 item 7). Antes,
 * as quatro abas da ficha (Visão geral, Evolução, Extrato, Roteiro)
 * repetiam a mesma trinca `PageHeader` + `DeactivatedPersonNotice` +
 * `ProfileTabs`; regra da casa: o que serve a 2 lugares vira componente.
 *
 * O bloco se prende logo abaixo do cabeçalho do shell, pela constante do
 * `StablePageFrame` — a regra "mudança de menu nunca desloca a tela" vale
 * também para o que fica fixo. As margens negativas cobrem o respiro do
 * frame para que o conteúdo não apareça por trás ao rolar.
 */
export function ProfileHeader({
  architect,
  title,
  description,
  help,
  actions,
  active,
}: {
  architect: Pick<Architect, "id" | "active">;
  title: string;
  description?: string;
  help?: { lead: PageHelpContent; member: PageHelpContent };
  actions?: ReactNode;
  active: Parameters<typeof ProfileTabs>[0]["active"];
}) {
  return (
    <div
      data-pinned
      className={cn(
        StablePageFrame.pinnedUnderHeaderClass,
        "-mx-5 -mt-6 bg-background px-5 pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8",
      )}
    >
      <PageHeader title={title} description={description} help={help} actions={actions} />
      <DeactivatedPersonNotice active={architect.active} />
      <ProfileTabs architectId={architect.id} active={active} />
    </div>
  );
}
