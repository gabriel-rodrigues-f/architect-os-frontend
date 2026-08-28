import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real; a tela de
 * Time usa `<Link>` nos cards. Troca por âncora comum — não é o que se testa.
 */
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
import { type AppState } from "@/lib/api";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "../helpers/fixtures";
import { renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seções 16, 17 e 26/27 — nada
 * no cadastro pode fabricar dado: e-mail inventado do nome, "1 ano" fantasma,
 * ou Medium/Medium no 9-Box sem calibração real. Falta um campo, o cadastro
 * não salva. `strongDomain`/`gapDomain` saíram do formulário por inteiro
 * (AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, Seção 11):
 * força e lacuna passam a ser lidas do assessment, não de uma opinião prévia
 * coletada no cadastro.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — cadastro sem dado fabricado", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith(apiPath("/career-levels"))) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: fixtureCareerLevels }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith(apiPath("/auth/users"))) {
        return Promise.resolve(
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
        );
      }
      if (init?.method === "POST" && href.endsWith(apiPath("/architects"))) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(
          new Response(JSON.stringify({ ...body, active: true }), {
            status: 201,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith(apiPath("/state"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mantém 'Salvar' desabilitado até nome, e-mail e um tempo válido estarem preenchidos", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("E-mail"), "nova.pessoa@company.com");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Tempo como arquiteto (anos)"), "2");
    expect((salvar as HTMLButtonElement).disabled).toBe(false);
  });

  it("salva só com o que a pessoa digitou — sem e-mail fabricado, sem domínio forte/lacuna no cadastro", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    await userEvent.type(screen.getByLabelText("E-mail"), "nova.pessoa@company.com");
    await userEvent.type(screen.getByLabelText("Tempo como arquiteto (anos)"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const isCreateCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).endsWith(apiPath("/architects")) && init?.method === "POST";
    };

    await waitFor(() => expect(fetchMock.mock.calls.some(isCreateCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isCreateCall) as [string, RequestInit];
    const init = call[1];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body["email"]).toBe("nova.pessoa@company.com");
    expect(body["yearsAsArchitect"]).toBe(2);
    // ENG-04 — o cargo vem do nível de carreira escolhido, nunca de um `?? ""`.
    expect(body["role"]).toBe("Arquiteto de Soluções I");
    expect(body).not.toHaveProperty("strongDomain");
    expect(body).not.toHaveProperty("gapDomain");
    expect(body).not.toHaveProperty("performance");
    expect(body).not.toHaveProperty("potential");
    // B-32 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §41) — id é
    // gerado no servidor; o front nunca mais calcula slug(nome) e manda um
    // id no corpo (dois nomes parecidos colidiam nesse slug).
    expect(body).not.toHaveProperty("id");
  });
});
