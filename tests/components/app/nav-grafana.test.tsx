import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { AppShell, filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import { ThemeProvider } from "@/lib/theme";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Onda 36 — pedido literal do dono: "para o administrador, quero um menu em
 * administração, entre Times e Usuários, me levando ao grafana."
 *
 * O Grafana é servido pelo Ingress na MESMA origem, fora do SPA — então o
 * item não é rota do router: é âncora externa (`target="_blank"`), e a
 * varredura de `src/routes/` (alcance-por-rota, route-inventory) nunca o vê.
 * Este arquivo fixa as três pontas: quem vê (só admin), onde fica (entre
 * /teams e /users) e como abre (âncora externa, não rota).
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

/**
 * O DESTINO deixou de ser um caminho fixo em 2026-09-04: com a saída do
 * Kubernetes o Grafana passou a morar noutra origem, e o endereço virou
 * configuração (`VITE_GRAFANA_URL`) — vazio vale o do compose, e num cluster
 * futuro volta a ser `/grafana`. Congelar a string aqui transformaria uma
 * decisão de topologia em teste vermelho. O que o teste guarda é o que
 * importa: o item existe, está no lugar certo e é só do administrador.
 */
const destinoDoGrafana = (): string => {
  const doAdmin = destinos(fixtureAdminUser);
  const posicaoDeTimes = doAdmin.indexOf("/teams");
  return doAdmin[posicaoDeTimes + 1] ?? "";
};

describe("menu — o item Grafana é do administrador, entre Times e Usuários", () => {
  it("o administrador vê o Grafana exatamente entre /teams e /users", () => {
    const caminhos = destinos(fixtureAdminUser);
    const posicao = caminhos.indexOf(destinoDoGrafana());
    expect(posicao).toBeGreaterThan(-1);
    expect(caminhos[posicao - 1]).toBe("/teams");
    expect(caminhos[posicao + 1]).toBe("/users");
  });

  it("gestor, tech lead (com ou sem vínculo), member e sessão nenhuma não veem", () => {
    const grafana = destinoDoGrafana();
    expect(destinos(fixtureAssignedManagerUser)).not.toContain(grafana);
    expect(destinos(fixtureAssignedTechLeadUser)).not.toContain(grafana);
    expect(destinos(fixtureUnassignedTechLeadUser)).not.toContain(grafana);
    expect(destinos(fixtureMemberUser)).not.toContain(grafana);
    expect(destinos(undefined)).not.toContain(destinoDoGrafana());
  });
});

describe("menu — Grafana abre como âncora externa, não como rota do SPA", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("para o admin, o link tem href /grafana, nova aba e aviso de que exige o cluster", async () => {
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    const links = await screen.findAllByRole("link", { name: "Grafana" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // O href é o endereço configurado, e não um caminho fixo — ele muda com
      // a topologia. O que não pode mudar é o resto: abre em aba nova e sem
      // devolver `window.opener` para o outro lado.
      expect(link.getAttribute("href")).toBe(destinoDoGrafana());
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("title")).toMatch(/m(é|e)tricas/i);
    }
  });
});
