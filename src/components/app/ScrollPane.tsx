import type { CSSProperties, ReactNode } from "react";

import { ScrollPaneStyle, type PaneHeight } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * O BLOCO QUE ROLA EM SI MESMO — dono (2026-09-09, com duas capturas): *"a
 * ideia aqui é mantermos os títulos das páginas sempre visíveis. Utilize
 * orientação a objeto para aplicar essa refatoração reutilizando
 * componentes."*
 *
 * É UM pedido aplicado a treze telas, e por isso é UM componente. Ele nasceu
 * classe (`ShellHeader.sideRailClass`, conserto das Maiores Distâncias do
 * PDI); com quinze ocorrências virou componente, como manda a regra de reuso.
 *
 * O que ele sabe fazer, e que cada tela deixaria escapar se fizesse à mão:
 *
 * - **Altura por CONTEÚDO, não por pixel** — {@link PaneHeight} recebe quantos
 *   itens cabem e devolve a expressão; o número mora no token da folha de
 *   estilo. A medida entra por `style`, nunca por classe montada por string:
 *   o Tailwind v4 só compila o literal.
 * - **Ou altura MEDIDA, quando a caixa ocupa o resto da página** — aí não há
 *   conta nenhuma: ela se anuncia pelo marcador do {@link PageFillingPane} e
 *   é o filho que estica e encolhe na coluna do quadro. Quem se veste é a
 *   altura, não a caixa: a caixa só pergunta a ela como ficar.
 * - **Nada em tela estreita** — todo o que monta a caixa vem com `xl:`. Caixa
 *   que rola dentro de página que já rola é pior que o defeito original.
 * - **Alcançável por teclado**, com `role`/`aria-label`, `tabIndex` e o anel
 *   de foco da casa; a barra é a `scroll-visible`.
 * - **Cabeçalho de coluna preso** (`table`), senão a legenda das colunas some
 *   no meio da lista.
 */
export function ScrollPane({
  label,
  height,
  table = false,
  horizontal = false,
  className,
  children,
}: {
  /** O que a caixa é, para quem navega por teclado ou leitor de tela. */
  label: string;
  height: PaneHeight;
  /** O conteúdo é uma tabela: o `thead` fica preso no topo da caixa. */
  table?: boolean;
  /** A tabela é larga e também rola na horizontal — no MESMO elemento. */
  horizontal?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const fitting = height.fitting;
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      {...fitting.attributes}
      {...(fitting.style ? { style: fitting.style as CSSProperties } : {})}
      className={cn(
        ScrollPaneStyle.reachClass,
        ScrollPaneStyle.scrollClass,
        fitting.className,
        horizontal && ScrollPaneStyle.horizontalClass,
        table && ScrollPaneStyle.pinnedColumnHeaderClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
