import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

/**
 * ABRIR NO PONTEIRO SEM FECHAR A PORTA DE NINGUÉM.
 *
 * O dono pediu hover duas vezes, em dois lugares diferentes: no cartão do
 * filtro bloqueado (2026-09-08) e no "?" ao lado do título da tela
 * (2026-09-09). São o mesmo problema, e é por isso que a régua mora aqui e
 * não em cada componente — o segundo pedido não pode reinventar o que o
 * primeiro já resolveu, nem resolver diferente.
 *
 * O problema é que HOVER NÃO EXISTE no toque nem no teclado. Trocar clique
 * por hover e parar por aí deixaria a explicação inalcançável no celular e
 * para quem navega por teclado — um defeito trocado por outro pior. Então o
 * gatilho abre nas TRÊS formas, e cada uma delas obriga uma decisão:
 *
 *  1. **Bloqueado, não desabilitado.** `disabled` some da tabulação e não
 *     emite evento de ponteiro: nem o hover nem o foco chegariam ao gatilho,
 *     e o que estivesse dentro do cartão seria inalcançável. Quem usa este
 *     gancho num campo bloqueado usa `aria-disabled`, nunca `disabled`.
 *  2. **Sair do gatilho PARA o cartão não fecha.** Fechar na saída do gatilho
 *     tornaria impossível clicar no que está dentro do cartão — o ponteiro
 *     tem de atravessar. O conjunto é gatilho + cartão, e a conferência é
 *     adiada um turno de propósito: sair de um e entrar no outro dispara a
 *     SAÍDA antes da ENTRADA, e decidir na hora fecharia no meio do caminho.
 *     (`relatedTarget` não serve: em `pointerleave` ele é opcional e chega
 *     vazio em boa parte dos ambientes.)
 *  3. **O foco não é sequestrado.** Chegar no gatilho pelo Tab abre o cartão,
 *     mas não pode arrastar o foco para dentro dele — quem tabula espera
 *     continuar de onde está. Quem QUER entrar pede: Enter, espaço ou seta
 *     para baixo.
 *  4. **O gesto que abre nunca fecha.** No toque, tocar o gatilho dispara
 *     `pointerenter`, `click` E `pointerleave` — o dedo entra e sai no mesmo
 *     ato. Se o clique alternasse, o cartão abriria e fecharia no mesmo
 *     toque; se a saída do ponteiro fechasse, o `pointerleave` do próprio
 *     dedo o apagaria (e não dá para contar com o foco: nem todo navegador
 *     de celular dá foco a um `<button>` tocado). Por isso o clique só ABRE
 *     e FIXA: quem abre por gesto explícito só fecha por gesto explícito —
 *     Esc, clique fora, ou o Tab que leva o foco embora.
 *  5. **O Esc devolve o foco.** Fechar com o foco dentro do cartão o jogaria
 *     no corpo da página, e a tabulação recomeçaria do topo. O gancho o
 *     devolve ao gatilho — e marca a devolução, senão o `onFocus` do próprio
 *     gatilho reabriria o que o Esc acabou de fechar.
 *
 * Não há dependência nova: quem posiciona é o `Popover` da casa
 * (`@radix-ui/react-popover`); quem manda no abrir e no fechar é este objeto.
 */
export interface HoverDisclosure<G extends HTMLElement, C extends HTMLElement> {
  readonly open: boolean;
  /** O gatilho — `<button>`, sempre; entra no `ref` dele. */
  readonly triggerRef: RefObject<G | null>;
  /** O cartão que o gatilho abre; entra no `ref` do `PopoverContent`. */
  readonly contentRef: RefObject<C | null>;
  /** O que o `Popover` chama quando ele mesmo decide (Esc, clique fora). */
  readonly onOpenChange: (open: boolean) => void;
  /** Fecha por decisão da tela — o botão de dentro que troca de página. */
  readonly close: () => void;
  readonly triggerProps: {
    readonly onPointerEnter: () => void;
    readonly onPointerLeave: () => void;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
    readonly onClick: (event: { preventDefault: () => void }) => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
  readonly contentProps: {
    readonly tabIndex: number;
    readonly onPointerEnter: () => void;
    readonly onPointerLeave: () => void;
    readonly onBlur: () => void;
    readonly onOpenAutoFocus: (event: Event) => void;
    readonly onCloseAutoFocus: (event: Event) => void;
  };
}

/** O primeiro alvo focável do cartão; sem nenhum, o próprio cartão. */
const ALVO_DE_ENTRADA = "a, button";

export function useHoverDisclosure<
  G extends HTMLElement = HTMLButtonElement,
  C extends HTMLElement = HTMLDivElement,
>(): HoverDisclosure<G, C> {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<G>(null);
  const contentRef = useRef<C>(null);
  const ponteiro = useRef({ gatilho: false, cartao: false });
  const conferencia = useRef<ReturnType<typeof setTimeout>>(undefined);
  const devolvendoOFoco = useRef(false);
  /** Aberto por clique/toque: o ponteiro sozinho não fecha mais. */
  const fixado = useRef(false);

  useEffect(() => () => clearTimeout(conferencia.current), []);

  const focoNoConjunto = (): boolean => {
    const focado = document.activeElement;
    if (!(focado instanceof Node)) return false;
    return (
      Boolean(triggerRef.current?.contains(focado)) || Boolean(contentRef.current?.contains(focado))
    );
  };

  const entra = (parte: "gatilho" | "cartao") => () => {
    ponteiro.current[parte] = true;
    setOpen(true);
  };

  const sai = (parte: "gatilho" | "cartao") => () => {
    ponteiro.current[parte] = false;
    clearTimeout(conferencia.current);
    conferencia.current = setTimeout(() => {
      if (fixado.current) return;
      if (ponteiro.current.gatilho || ponteiro.current.cartao || focoNoConjunto()) return;
      setOpen(false);
    }, 0);
  };

  const fecha = () => {
    const focoEstavaDentro = Boolean(contentRef.current?.contains(document.activeElement));
    fixado.current = false;
    setOpen(false);
    const gatilho = triggerRef.current;
    if (!focoEstavaDentro || !gatilho) return;
    devolvendoOFoco.current = true;
    gatilho.focus();
    devolvendoOFoco.current = false;
  };

  const entraNoCartao = () => {
    setOpen(true);
    // O cartão pode ainda não estar montado: o foco vai no próximo quadro.
    requestAnimationFrame(() => {
      const cartao = contentRef.current;
      if (!cartao) return;
      (cartao.querySelector<HTMLElement>(ALVO_DE_ENTRADA) ?? cartao).focus();
    });
  };

  const teclaNoGatilho = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      fecha();
      return;
    }
    if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowDown") return;
    event.preventDefault();
    entraNoCartao();
  };

  return {
    open,
    triggerRef,
    contentRef,
    close: fecha,
    onOpenChange: (proximo: boolean) => {
      if (proximo) setOpen(true);
      else fecha();
    },
    triggerProps: {
      onPointerEnter: entra("gatilho"),
      onPointerLeave: sai("gatilho"),
      onFocus: () => {
        if (devolvendoOFoco.current) {
          devolvendoOFoco.current = false;
          return;
        }
        setOpen(true);
      },
      onBlur: () => {
        fixado.current = false;
        sai("gatilho")();
      },
      /*
       * O clique só ABRE, e fixa. Alternar aqui fecharia, no toque, o cartão
       * que o `pointerenter` do mesmo toque acabou de abrir; e o
       * `preventDefault` é o que desliga a alternância do `PopoverTrigger`.
       */
      onClick: (event: { preventDefault: () => void }) => {
        event.preventDefault();
        fixado.current = true;
        setOpen(true);
      },
      onKeyDown: teclaNoGatilho,
    },
    contentProps: {
      /* Sem isto o cartão sem link dentro não recebe foco, e o Enter não teria destino. */
      tabIndex: -1,
      onPointerEnter: entra("cartao"),
      onPointerLeave: sai("cartao"),
      onBlur: sai("cartao"),
      onOpenAutoFocus: (event: Event) => event.preventDefault(),
      onCloseAutoFocus: (event: Event) => event.preventDefault(),
    },
  };
}
