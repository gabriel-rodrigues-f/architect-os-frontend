import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de outros testes de página: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Route as TeamRoute } from "@/routes/team";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, FE-360-012
 * (P2) — a tela de "não consegui carregar" não pode instruir quem usa o
 * produto a rodar `docker compose` ou conferir `VITE_API_URL`. Isso é
 * instrução de desenvolvedor vazando pra tela de um usuário enterprise; o
 * detalhe técnico só pode aparecer em build de desenvolvimento.
 */
const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Tela de conexão indisponível — sem instrução de desenvolvedor em produção", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [
        // /api/state falha com 500 — as rotas têm precedência sobre o padrão.
        (href) =>
          href.endsWith("/api/state") ? new Response("erro interno", { status: 500 }) : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("em produção, mostra mensagem genérica e nunca 'docker compose'/'VITE_API_URL'", async () => {
    vi.stubEnv("DEV", false);
    renderWithApp(<TeamPage />);

    expect(
      await screen.findByText("Não foi possível acessar o serviço", {}, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByText(/docker compose/i)).toBeNull();
    expect(screen.queryByText(/VITE_API_URL/)).toBeNull();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
  });
});
