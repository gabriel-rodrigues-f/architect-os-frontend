import { useEffect, useState } from "react";

/**
 * R2-RESP-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o radar (`CapabilityRadar`/
 * `ComparisonRadar`) usa um raio fixo de 72% do frame; abaixo de `sm` (640px)
 * sobra pouca margem para os rótulos dos eixos, que colidem com a borda do
 * card. Reduzir o raio nessa faixa dá espaço de volta ao texto sem mudar o
 * layout nas telas onde já cabe.
 *
 * Começa em `false` porque no SSR não há `matchMedia`; o efeito corrige no
 * cliente antes do primeiro paint importar — mesmo padrão de `useReducedMotion`.
 */
export function useNarrowViewport(breakpointPx = 640): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    setNarrow(media.matches);

    const aoMudar = (e: MediaQueryListEvent) => setNarrow(e.matches);
    media.addEventListener("change", aoMudar);
    return () => media.removeEventListener("change", aoMudar);
  }, [breakpointPx]);

  return narrow;
}
