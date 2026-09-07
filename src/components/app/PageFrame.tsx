import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * "Mudança de menu nunca pode deslocar a tela" (dono, 2026-09-06).
 *
 * Duas coisas deslocavam a tela ao trocar de rota: uma página curta depois de
 * uma longa encolhia o documento (e a barra de rolagem sumia, puxando o
 * conteúdo), e a posição de rolagem da rota anterior sobrevivia à troca. A
 * regra vive num objeto só — `StablePageFrame` — e o `AppShell` a aplica a
 * TODAS as páginas: a área de conteúdo tem altura mínima do viewport útil
 * (o que sobra abaixo do cabeçalho) e toda troca de rota volta ao topo.
 * Nenhuma tela precisa saber disso; nenhuma tela pode desfazer.
 */
export class StablePageFrame {
  /** Altura do cabeçalho fixo do shell — a mesma constante do `AppShell`. */
  static readonly HEADER_HEIGHT_PX = 74;

  /** A altura mínima da área de conteúdo: o viewport útil, sempre. */
  static get minHeightClass(): string {
    return `min-h-[calc(100dvh-${StablePageFrame.HEADER_HEIGHT_PX}px)]`;
  }

  /** Ao trocar de rota, a tela volta ao topo — sem animação, para não "andar". */
  static resetScroll(view: Pick<Window, "scrollTo"> = window): void {
    view.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
}

export function PageFrame({
  pathname,
  className = undefined,
  children,
}: {
  pathname: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  useEffect(() => {
    StablePageFrame.resetScroll();
  }, [pathname]);

  return (
    <main data-page-frame className={cn(StablePageFrame.minHeightClass, className)}>
      {children}
    </main>
  );
}
