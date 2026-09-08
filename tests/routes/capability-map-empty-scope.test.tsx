import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo de capability-map-risk.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
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
import type { SessionUser } from "@/lib/api";
import { scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * R2-VIS-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — sem ninguém no escopo do
 * viewer, `assessedCount` é 0 para TODA capacidade, então antes cada
 * card/linha repetia "Dados insuficientes" — para um catálogo de 30
 * capacidades, 30 repetições da mesma frase. A tela agora reconhece que o
 * problema é um só (ninguém para avaliar aqui) e mostra uma mensagem única.
 */
const fetchMock = vi.fn();

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

/**
 * Revisão de papéis (dono, 2026-09-05): o alcance é o VÍNCULO, não o papel.
 * Este tech lead TEM vínculo — com um time onde ainda não há ninguém — e por
 * isso entra na tela e encontra a população vazia. O par dele, sem vínculo
 * nenhum, nem entra (`canAnalyzeTeam` nega).
 */
const TIME_VAZIO = "time-vazio";

const leadWithNoOne: SessionUser = {
  id: "test-lead-sem-ninguem",
  email: "lead-sem-ninguem@company.com",
  name: "Lead Sem Ninguém",
  role: "tech_lead",
  professionalId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: TIME_VAZIO, role: "tech_lead" }],
};

const leadWithoutBond: SessionUser = { ...leadWithNoOne, memberships: [] };

describe("Mapa de Capacidades — escopo vazio vira uma mensagem, não N repetições", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: leadWithNoOne,
      state: scopedFixtureStateFor(leadWithNoOne, undefined, [TIME_VAZIO]),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra a mensagem única de escopo vazio, nunca 'Dados insuficientes' repetido por capacidade", async () => {
    renderWithApp(<CapabilityPage />);

    expect(await screen.findByText("Nenhum profissional no seu escopo")).toBeTruthy();
    expect(screen.queryByText(/Dados insuficientes/)).toBeNull();
    expect(screen.queryByText("Cloud Architecture")).toBeNull();
  });

  it("liderança SEM vínculo não entra na tela — o alcance é o vínculo, não o papel (dono, 2026-09-05)", async () => {
    mockAppFetch(fetchMock, {
      user: leadWithoutBond,
      state: scopedFixtureStateFor(leadWithoutBond),
    });
    renderWithApp(<CapabilityPage />);

    expect(await screen.findByText("A análise do time é uma leitura de liderança.")).toBeTruthy();
    expect(screen.queryByText("Nenhum profissional no seu escopo")).toBeNull();
    expect(screen.queryByText("Cloud Architecture")).toBeNull();
  });
});
