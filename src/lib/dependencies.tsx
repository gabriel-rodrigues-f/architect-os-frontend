import { createContext, useContext, type ReactNode } from "react";

import { defaultContainer, FrontendContainer } from "./gateways/container";

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
