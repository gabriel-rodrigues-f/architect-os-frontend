import { createContext, useContext, type ReactNode } from "react";

import { defaultContainer, FrontendContainer } from "./gateways/container";

const Ctx = createContext<FrontendContainer | null>(null);

/**
 * OO2-07 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 54-56) — Context React usado SÓ para injeção de dependência
 * (achar o `FrontendContainer` certo a partir de um componente), não para
 * estado de UI — por isso não fica no mesmo arquivo de `store.tsx`
 * (estado de domínio) nem tem `useState`/`useEffect` nenhum aqui dentro,
 * ao contrário de `auth.tsx`/`theme.tsx`.
 *
 * `container` é opcional e default para `defaultContainer` (o singleton do
 * processo, `gateways/container.ts`) de propósito: hoje NENHUMA tela
 * consome gateway via `useContainer()` (isso é OO2-08, ViewModels por
 * tela) — `api.ts` continua a única porta de entrada real, e ele já
 * desestrutura do mesmo `defaultContainer`. Este Provider existe para o
 * dia em que uma tela ou um teste precisar de um container DIFERENTE:
 * - Teste de componente que quer mockar só um gateway: monta um objeto com
 *   a forma de `FrontendContainer` (não precisa nem ser instância de
 *   verdade, TypeScript já valida a forma) e passa em `container`.
 * - Um ambiente futuro com mais de um backend/base URL: `FrontendContainer
 *   .create({ baseUrl: outro })` e passa aqui, sem precisar mexer em
 *   `api.ts` nem em nenhuma tela que ainda lê a fachada.
 */
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
