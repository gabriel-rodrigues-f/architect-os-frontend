import { useEffect, useState } from "react";

/**
 * Quanto tempo passou desde que `active` ficou verdadeiro, em milissegundos,
 * atualizado a cada `tickMs`. Volta a zero quando `active` cai — e não marca
 * nada enquanto não há o que esperar.
 */
export function useElapsedMs(active: boolean, tickMs = 250): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), tickMs);
    return () => clearInterval(timer);
  }, [active, tickMs]);
  return elapsed;
}
