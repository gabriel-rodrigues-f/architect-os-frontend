import { configure } from "@testing-library/dom";
import { createElement, type ComponentProps } from "react";
import { vi } from "vitest";

/**
 * Lacunas do jsdom que o Radix e o cmdk assumem existir no navegador. Sem elas,
 * qualquer teste que abra Popover/Command quebra no mount — não é bug do app.
 */

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

/** `useReducedMotion` (gráficos) chama isto direto — sem mock, qualquer tela com chart quebra no mount. */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

/**
 * Idioma fixo nos testes. Sem isto o provider detecta o idioma do jsdom
 * (`en-US`) e as asserções de texto passariam a depender do ambiente em vez do
 * comportamento — o mesmo teste passaria numa máquina e falharia noutra.
 */
window.localStorage.setItem("synapse:locale", "pt");

/**
 * O prazo do Testing Library para `findBy*`/`waitFor` é de 1 s, e 1 s é curto
 * demais nesta casa: a suíte roda ao lado da frota de agentes, e o gate ficou
 * vermelho quatro vezes numa noite com arquivos DIFERENTES a cada rodada —
 * todos passando sozinhos em seguida. Não é defeito do produto nem lentidão
 * real: é a máquina disputada.
 *
 * Isto NÃO afrouxa asserção nenhuma. O que cada teste afirma continua sendo
 * comportamento — que o elemento aparece, que o payload é aquele. O prazo só
 * diz quanto o teste espera antes de desistir, e um teste que desiste cedo
 * demais não mede o produto: mede a carga da máquina.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * O `<Link>` do TanStack Router exige o `RouterProvider` montado. A maioria
 * das suítes monta a TELA, não o roteador — e isso bastava enquanto o link
 * era raro. Desde 2026-09-08 ele deixou de ser: todo seletor vazio de quem
 * cadastra oferece a porta de cadastro (`EmptySelection`), e a porta é um
 * `<Link>`. Sem router, a peça quebrava no mount em dezenas de arquivos.
 *
 * Esta é a MESMA lacuna de ambiente que `ResizeObserver` e `matchMedia` acima:
 * o navegador (aqui, o roteador do app) existe em produção e não no jsdom. O
 * dublê desenha a âncora com `href` — `to` mais o `search`, quando há —, que
 * é justamente o que os testes afirmam. Nenhuma asserção fica mais frouxa: o
 * arquivo que quer outro dublê declara o seu `vi.mock` e ele vence este.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: unknown;
      search?: Record<string, string> | undefined;
    }) =>
      createElement(
        "a",
        { href: search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to, ...rest },
        children,
      ),
  };
});
