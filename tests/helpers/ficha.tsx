/* eslint-disable react-refresh/only-export-components -- helper de teste; fast refresh não se aplica. */
import { act } from "@testing-library/react";
import type { ReactNode } from "react";

import type { CareerFileTab } from "@/lib/career-file";
import { Route as CareerFileRoute } from "@/routes/professionals.$professionalId";
import { careerFileRouter } from "./ficha-router";
import { renderWithApp } from "./render-app";

/**
 * A FICHA NOS TESTES — [FA-08]. A rota-pai `professionals.$professionalId` virou o
 * layout (guarda, passe de suporte, `ContextScope`, cabeçalho fixo) e as
 * quatro abas são só corpo. Um teste que monta a aba solta não vê cabeçalho,
 * abas nem passe; quem quer a ficha como a pessoa a vê monta o layout com a
 * aba dentro do `<Outlet />` — é o que `renderCareerFile` faz. O roteador
 * mockado que ele pressupõe é o de `ficha-router.tsx` (uma linha por teste).
 */
/** O componente da rota-pai — o layout da ficha, como o roteador o monta. */
export const CareerFileLayout = CareerFileRoute.options.component as () => ReactNode;

/**
 * Monta a ficha da pessoa `professionalId` aberta na aba `tab`, com `page`
 * (o componente da aba) dentro do `<Outlet />` do layout.
 */
export function renderCareerFile(
  page: ReactNode,
  {
    tab = "overview",
    professionalId = "ana",
  }: { tab?: CareerFileTab; professionalId?: string } = {},
): ReturnType<typeof renderWithApp> {
  careerFileRouter.set({ tab, professionalId, outlet: page });
  return renderWithApp(<CareerFileLayout />);
}

/** Troca de aba sem remontar o layout — o que o roteador faz ao navegar entre as abas. */
export function goToTab(tab: CareerFileTab, page: ReactNode): void {
  act(() => careerFileRouter.set({ tab, outlet: page }));
}

export { careerFileRouter } from "./ficha-router";
