import { createContext, useContext, type ReactNode } from "react";

import { defaultContainer, FrontendContainer } from "./gateways/container";
import type { MetricsTab } from "./platform-metrics";
import type { SynapseSignals } from "./synapse-network";

const Ctx = createContext<FrontendContainer | null>(null);

export function DependencyProvider({
  container = defaultContainer,
  children,
}: {
  container?: FrontendContainer;
  children: ReactNode;
}) {
  return <Ctx.Provider value={container}>{children}</Ctx.Provider>;
}

export function useContainer(): FrontendContainer {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContainer precisa estar dentro de DependencyProvider");
  return ctx;
}

/**
 * A rede de sinapses da aplicação, se houver container por perto. `null` fora
 * dele — uma tela de porta montada sozinha, um hook num teste — para que quem
 * só quer avisar a rede (`useAsyncSubmit.rejectLocally`) nunca precise dela
 * para funcionar.
 */
export function useSynapseSignals(): SynapseSignals | null {
  return useContext(Ctx)?.synapseSignals ?? null;
}

/**
 * A aba das Métricas da Plataforma, se houver container por perto. `null`
 * fora dele, pela mesma razão dos sinais: uma casca montada sozinha num teste
 * não deve quebrar por causa de uma aba que ela nunca vai abrir.
 */
export function usePlatformMetricsTab(): MetricsTab | null {
  return useContext(Ctx)?.platformMetricsTab ?? null;
}
