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
 * dele — uma casca montada sozinha num teste — para que quem só quer desenhar
 * a rede do fundo nunca precise dela para funcionar. Ninguém dentro da
 * aplicação logada pulsa por este canal (dono, 2026-09-08).
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
