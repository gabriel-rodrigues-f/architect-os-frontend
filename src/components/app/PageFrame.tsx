import { useEffect, useRef, type ReactNode } from "react";

import { ShellHeader } from "@/lib/design";
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
  /** Altura do cabeçalho fixo do shell — o token `--shell-header-h`, lido do `ShellHeader`. */
  static get HEADER_HEIGHT_PX(): number {
    return ShellHeader.HEIGHT_PX;
  }

  /** A altura mínima da área de conteúdo: o viewport útil, sempre. */
  static get minHeightClass(): string {
    return ShellHeader.minContentHeightClass;
  }

  /**
   * Um bloco fixo dentro da página (cabeçalho da ficha, cabeçalho de colunas)
   * se prende logo ABAIXO do cabeçalho do shell — o mesmo token, nunca um
   * número solto na tela. O `z-10` fica abaixo do `z-20` do shell.
   */
  static readonly pinnedUnderHeaderClass = `sticky ${ShellHeader.stickyBelowClass} z-10`;

  /** Ao trocar de rota, a tela volta ao topo — sem animação, para não "andar". */
  static resetScroll(view: Pick<Window, "scrollTo"> = window): void {
    view.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  /**
   * [A-02] Depois de navegar, o foco vai para o `main` (sem rolar — a tela já
   * voltou ao topo): quem lê por leitor de tela ouve a nova página, e o Tab
   * seguinte começa no conteúdo, não no fim do menu. `tabIndex=-1` deixa o
   * `main` focável por script sem entrar na ordem do Tab.
   */
  static focusContent(main: Pick<HTMLElement, "focus"> | null): void {
    main?.focus({ preventScroll: true });
  }
}

export function PageFrame({
  id,
  pathname,
  className = undefined,
  children,
}: {
  id?: string | undefined;
  pathname: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const primeiraRota = useRef(true);

  useEffect(() => {
    StablePageFrame.resetScroll();
    // Na primeira pintura o foco fica onde o navegador o pôs; só a TROCA de
    // rota move o foco para o conteúdo.
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    StablePageFrame.focusContent(mainRef.current);
  }, [pathname]);

  return (
    <main
      ref={mainRef}
      id={id}
      tabIndex={-1}
      data-page-frame
      className={cn(StablePageFrame.minHeightClass, "outline-none", className)}
    >
      {children}
    </main>
  );
}
