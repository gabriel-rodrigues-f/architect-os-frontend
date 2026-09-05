import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
    useRouter: () => ({ history: { push: vi.fn() } }),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import type { SessionUser } from "@/lib/api";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { Route as RoadmapRoute } from "@/routes/architects.$architectId.roadmap";
import { fixtureAdminUser, fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Pedido do dono (2026-09-05), literal: *"O gerente, tech lead e o
 * profissional hoje podem executar ações em 'Minha Carreira' que não fazem
 * sentido poder fazer. 'Minha carreira' deve ser uma tela apenas para
 * visualização de seu progresso, sem nenhuma ação e nem IA."*
 *
 * A regra é uma só: NA PRÓPRIA FICHA, NINGUÉM É LÍDER. O tech lead que é a
 * Ana abre a ficha da Ana e vê o que a Ana pode ver — nenhum roteiro, nenhum
 * "sugerir PDI", nenhum "revisar" de evidência, nenhuma explicação de
 * prontidão, e nada de registrar evidência (isso mora em Avaliações). Na
 * ficha do Bruno, liderado dele, tudo continua.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

const ACOES_DA_LIDERANCA = [/Gerar roteiro de 1:1/, /Gerar roteiro de PDI/, /Verificar sinais/];
const ACOES_DA_FICHA = [/Sugerir item de PDI/, /^\+ PDI$/, /^Revisar$/, /^Registrar$/];

const techLeadQueEAna: SessionUser = { ...fixtureAssignedTechLeadUser, architectId: "ana" };
const adminQueEAna: SessionUser = { ...fixtureAdminUser, architectId: "ana" };

function renderAs(user: SessionUser, Page: () => ReactNode) {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [careerLevelsRoute] });
  return renderWithApp(<Page />);
}

describe("a própria ficha é leitura — sem ação e sem IA, para qualquer papel", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["tech lead", techLeadQueEAna],
    ["admin", adminQueEAna],
  ])("%s que é a Ana abre a própria ficha e não encontra ação nem IA", async (_papel, user) => {
    renderAs(user, ProfilePage);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Nível médio")).toBeTruthy();
    for (const acao of [...ACOES_DA_LIDERANCA, ...ACOES_DA_FICHA]) {
      expect(screen.queryByRole("button", { name: acao }), String(acao)).toBeNull();
    }
  });

  it("na própria ficha, o roteiro não oferece 'Explicar a prontidão'", async () => {
    renderAs(techLeadQueEAna, RoadmapPage);
    expect((await screen.findAllByText(/Roteiro/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Explicar a prontidão/ })).toBeNull();
  });

  it("na ficha de um liderado, o mesmo tech lead continua com as ações de liderança", async () => {
    renderAs({ ...fixtureAssignedTechLeadUser, architectId: "bruno" }, ProfilePage);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.getByRole("button", { name: acao }), String(acao)).toBeTruthy();
    }
  });
});
