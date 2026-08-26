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
