import type { ComponentProps } from "react";
import { vi } from "vitest";

/**
 * `<Link>` do TanStack Router exige um `RouterProvider` por cima; sem ele,
 * `useRouter()` devolve `undefined` e o componente quebra ao montar. Os
 * testes de tela renderizam a rota solta (sem roteador), então toda tela
 * que desenha um `<Link>` precisa trocá-lo por uma âncora simples.
 *
 * `vi.mock` é içado por arquivo e a fábrica não enxerga imports — mas pode
 * fazer `import()` dinâmico. Cada teste fica com UMA linha:
 *
 *   vi.mock("@tanstack/react-router", () =>
 *     import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
 *   );
 *
 * A âncora preserva o `to` como `href` para o teste afirmar o destino.
 */
export function PlainLink({
  children,
  to,
  params: _params,
  search: _search,
  ...rest
}: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}

export async function reactRouterWithPlainLinks(): Promise<
  typeof import("@tanstack/react-router")
> {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, Link: PlainLink as unknown as typeof actual.Link };
}
