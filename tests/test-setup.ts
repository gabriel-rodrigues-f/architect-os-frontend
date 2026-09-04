import { configure } from "@testing-library/dom";

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
