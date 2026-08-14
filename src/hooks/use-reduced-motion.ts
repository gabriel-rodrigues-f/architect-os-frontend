import { useEffect, useState } from "react";

/**
 * A pessoa pediu menos movimento no sistema operacional?
 *
 * Vale para gráfico mais do que para qualquer outra coisa da interface: a
 * animação de entrada do Recharts faz linhas e polígonos crescerem do zero, e
 * é justamente esse tipo de movimento amplo que dispara desconforto vestibular.
 *
 * Começa em `false` porque no SSR não há `matchMedia`; o efeito corrige no
 * cliente antes da primeira animação importar.
 */
export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(media.matches);

    const aoMudar = (e: MediaQueryListEvent) => setReduzido(e.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, []);

  return reduzido;
}
