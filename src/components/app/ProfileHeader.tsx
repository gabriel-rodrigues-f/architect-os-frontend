import type { Architect } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { useHeadingSlotMount } from "./CareerFileHeading";
import { DeactivatedPersonNotice } from "./DeactivatedPersonNotice";
import { StablePageFrame } from "./PageFrame";
import { ProfileTabs } from "./ui-bits";

/**
 * O cabeçalho da ficha da pessoa — nome, posição/nível e abas — num bloco
 * FIXO enquanto o corpo rola (referência FIAP 2026-09-06, §2 item 7). Desde
 * [FA-08] ele é da ROTA-PAI (`architects.$architectId.tsx`) e é montado UMA
 * vez: as quatro abas (Visão geral, Evolução, Extrato, Roteiro) só publicam o
 * próprio título no encaixe (`ProfileHeading`), e trocar de aba não remonta
 * o bloco.
 *
 * O bloco se prende logo abaixo do cabeçalho do shell, pela constante do
 * `StablePageFrame` — a regra "mudança de menu nunca desloca a tela" vale
 * também para o que fica fixo. As margens negativas cobrem o respiro do
 * frame para que o conteúdo não apareça por trás ao rolar.
 */
export function ProfileHeader({
  architect,
  active,
}: {
  architect: Pick<Architect, "id" | "active">;
  active: Parameters<typeof ProfileTabs>[0]["active"];
}) {
  const mountHeading = useHeadingSlotMount();
  return (
    <div
      data-pinned
      className={cn(
        StablePageFrame.pinnedUnderHeaderClass,
        "-mx-5 -mt-6 bg-background px-5 pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8",
      )}
    >
      <div ref={mountHeading} data-heading-slot />
      <DeactivatedPersonNotice active={architect.active} />
      <ProfileTabs architectId={architect.id} active={active} />
    </div>
  );
}
