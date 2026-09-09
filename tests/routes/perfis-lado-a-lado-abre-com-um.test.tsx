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

import { Route as CompareRoute } from "@/routes/compare";
import { fixtureAssignedTechLeadUser } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-09: *"eu quero poder visualizar 1 profissional quando o
 * selecionar e, ao selecionar o segundo, visualizar ambos. A mensagem do
 * centro da tela deve aparecer apenas quando nenhum dos dois profissionais
 * estiver selecionado."*
 *
 * O defeito era a régua do vazio confundir duas perguntas diferentes. A tela
 * exigia DOIS para desenhar qualquer coisa, então quem escolhia uma pessoa
 * lia *"nenhum profissional selecionado"* com uma pessoa marcada na lista ao
 * lado — a tela negando o que a própria tela mostrava.
 *
 * São duas coisas: **desenhar** um perfil precisa de um; **comparar** precisa
 * de dois. O vazio pertence só à primeira.
 */
const fetchMock = vi.fn();
const ComparePage = CompareRoute.options.component as () => ReactNode;

/** A seleção vive no endereço, como no gêmeo `comparativo-em-uma-visao`. */
function renderCom(professionalIds: readonly string[]) {
  window.history.replaceState(null, "", `/compare?selected=${professionalIds.join(",")}`);
  mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser });
  return renderWithApp(<ComparePage />);
}

describe("Perfis lado a lado — um já desenha (dono, 2026-09-09)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("sem ninguém escolhido, o vazio explica as DUAS contagens", async () => {
    renderCom([]);

    expect(
      await screen.findByText(
        "Selecione ao menos 1 profissional para visualizar o gráfico e 2 para visualizar a comparação",
      ),
    ).toBeTruthy();
    // O título aparece DUAS vezes de propósito: no rótulo do seletor e no
    // vazio do centro. É a mesma frase dizendo a mesma coisa em dois lugares.
    expect(screen.getAllByText(/Nenhum profissional selecionado/).length).toBe(2);
  });

  it("com UM escolhido a tela desenha, e o vazio some", async () => {
    renderCom(["ana"]);

    expect(await screen.findByRole("heading", { name: "Radar Sobreposto" })).toBeTruthy();
    expect(screen.queryByText(/Selecione ao menos 1 profissional/)).toBeNull();
  });

  it("o convite do subtítulo não pede mais dois como se um não servisse", async () => {
    renderCom(["ana"]);
    await screen.findByRole("heading", { name: "Radar Sobreposto" });

    expect(screen.queryByText(/selecione 2 profissionais/i)).toBeNull();
  });
});
