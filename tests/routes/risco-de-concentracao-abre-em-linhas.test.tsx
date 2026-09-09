import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as CapabilityRoute } from "@/routes/capability-map";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import { configurationRoute, contextsOf, hrefOf, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * Dono, 2026-09-09: *"em Risco de Concentração quero que o tipo de
 * visualização inicie com linhas ao invés de blocos"*.
 *
 * A tela escolhia sozinha pelo TAMANHO — cartões até oito áreas em risco,
 * tabela acima disso. A régua parecia razoável e não era: o modo de leitura
 * mudava debaixo da pessoa conforme o time melhorava ou piorava, e a mesma
 * tela abria de dois jeitos em dias diferentes sem ninguém ter pedido.
 *
 * A tabela é a leitura certa desta tela porque a pergunta dela é de
 * comparação — quais capacidades dependem de poucas pessoas —, e comparar é
 * varrer coluna, não passear por cartão. Quem preferir os blocos continua a
 * um clique de distância; o que muda é por onde a tela começa.
 */
const fetchMock = vi.fn();

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

function renderPage() {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const href = String(hrefOf(input));
    if (href.endsWith(apiPath("/auth/me"))) {
      return Promise.resolve(
        new Response(JSON.stringify(fixtureAssignedManagerUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    const fatia = contextsOf(fixtureState)(href);
    if (fatia) return Promise.resolve(fatia);
    const configuration = configurationRoute(href);
    if (configuration) return Promise.resolve(configuration);
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return renderWithApp(<CapabilityPage />);
}

describe("Risco de Concentração abre em linhas (dono, 2026-09-09)", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a tela nasce na tabela, com poucas áreas em risco — o tamanho não decide mais", async () => {
    renderPage();
    await screen.findByText("Cloud Architecture");

    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("e o botão da tabela nasce marcado — o controle conta a verdade da tela", async () => {
    renderPage();
    await screen.findByText("Cloud Architecture");

    const tabela = screen.getByRole("button", { name: /tabela/i });
    expect(tabela.getAttribute("aria-pressed")).toBe("true");
  });
});
