import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { PageHeader } from "./ui-bits";

/**
 * O TÍTULO DA ABA DENTRO DO CABEÇALHO FIXO DA FICHA — [FA-08].
 *
 * O cabeçalho da ficha (nome, aviso de desativado, abas) é da ROTA-PAI e
 * fica montado enquanto a pessoa troca de aba. Cada aba, porém, tem o seu
 * título, a sua descrição e as suas ações ("Exportar PDF" na Evolução, o
 * "Voltar" das abas de quem lidera). A aba não desenha o cabeçalho: ela
 * PUBLICA o título num encaixe que o cabeçalho abre — um portal do React
 * para o nó que o `ProfileHeader` reserva. É isso que permite ao bloco fixo
 * sobreviver à troca de aba: só o que está dentro do encaixe muda.
 *
 * Fora do layout da ficha (um teste que monta a aba solta), o encaixe não
 * existe e o título é desenhado no lugar — a aba nunca fica sem título.
 */
interface HeadingSlot {
  readonly node: HTMLElement | null;
  readonly mount: (node: HTMLElement | null) => void;
}

const HeadingSlotContext = createContext<HeadingSlot | null>(null);

export function CareerFileHeadingSlot({ children }: { children: ReactNode }) {
  const [node, mount] = useState<HTMLElement | null>(null);
  return (
    <HeadingSlotContext.Provider value={{ node, mount }}>{children}</HeadingSlotContext.Provider>
  );
}

/** O `ref` do nó que recebe o título — para o `ProfileHeader` abrir o encaixe. */
export function useHeadingSlotMount(): (node: HTMLElement | null) => void {
  const slot = useContext(HeadingSlotContext);
  return slot?.mount ?? noopMount;
}

const noopMount = () => undefined;

type PageHeaderProps = Parameters<typeof PageHeader>[0];

/** A aba publica o seu título no cabeçalho fixo da ficha. */
export function ProfileHeading(props: PageHeaderProps) {
  const slot = useContext(HeadingSlotContext);
  const heading = <PageHeader {...props} />;
  if (!slot) return heading;
  return slot.node ? createPortal(heading, slot.node) : null;
}
