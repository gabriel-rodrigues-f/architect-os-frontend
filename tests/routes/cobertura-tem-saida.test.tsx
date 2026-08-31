import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O `<Link>` do TanStack exige RouterProvider real; aqui ele vira uma âncora
 * que SERIALIZA `to` + `params` no `href` — é justamente o destino que este
 * arquivo prende, então descartá-lo (como faz o mock de
 * `capability-map-risk.test.tsx`) apagaria o invariante sob teste.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: Record<string, string> }) => {
      const href = Object.entries(params ?? {}).reduce(
        (caminho, [nome, valor]) => caminho.replace(`$${nome}`, valor),
        to ?? "",
      );
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
  };
});

import { Route as CapabilityRoute } from "@/routes/capability-map";
import { fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Revisão de produto do PO (2026-08-30), Onda A: "ela identifica o risco e
 * não oferece nenhum caminho — nenhum nome é clicável, não há link para
 * mentoria nem trilha, apesar de a própria ajuda mandar o usuário para lá".
 *
 * A tela nomeia de quem o time depende e termina ali. Os dois invariantes
 * desta rede: quem é nomeado é alcançável (o perfil da pessoa) e a
 * capacidade em risco oferece a saída que a ajuda já promete.
 */
const fetchMock = vi.fn();

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

describe("De quem o time depende — o diagnóstico termina em caminho", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cada pessoa nomeada nas faixas leva ao próprio perfil", async () => {
    renderWithApp(<CapabilityPage />);
    const cartao = (await screen.findByText("Cloud Architecture")).closest("section")!;

    const ana = within(cartao).getAllByRole("link", { name: "Ana Martins" });
    expect(ana.length).toBeGreaterThan(0);
    for (const link of ana) {
      expect(link.getAttribute("href")).toBe("/architects/ana");
    }
    expect(within(cartao).getByRole("link", { name: "Bruno Almeida" }).getAttribute("href")).toBe(
      "/architects/bruno",
    );
  });

  it("a referência técnica potencial também é alcançável, não só nomeada", async () => {
    renderWithApp(<CapabilityPage />);
    const cartao = (await screen.findByText("Cloud Architecture")).closest("section")!;

    const referencias = within(cartao)
      .getByText(/Referências técnicas potenciais/)
      .closest("p")!;
    expect(
      within(referencias).getByRole("link", { name: "Ana Martins" }).getAttribute("href"),
    ).toBe("/architects/ana");
  });

  it("com capacidade em risco, a tela oferece mentoria e necessidades de treinamento", async () => {
    renderWithApp(<CapabilityPage />);
    await screen.findByText("Cloud Architecture");

    expect(screen.getByRole("link", { name: /Planejar mentoria/ }).getAttribute("href")).toBe(
      "/mentoring",
    );
    expect(
      screen.getByRole("link", { name: /necessidades de treinamento/i }).getAttribute("href"),
    ).toBe("/training-needs");
  });

  it("sem capacidade em risco, não empurra saída nenhuma", async () => {
    mockAppFetch(fetchMock, { state: { ...fixtureState, capabilities: [] } });
    renderWithApp(<CapabilityPage />);
    await screen.findByText(/Nenhuma capacidade cadastrada/);

    expect(screen.queryByRole("link", { name: /Planejar mentoria/ })).toBeNull();
  });
});
