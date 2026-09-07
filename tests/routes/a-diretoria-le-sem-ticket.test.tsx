import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR 5 (adendo do dono, 2026-09-08, item 2) — a diretoria "precisa ver tudo
 * sobre todos": abre a ficha de qualquer pessoa SEM passe de suporte, e não
 * age sobre ela (quem age é quem a lidera por vínculo). O SUPPORT continua
 * como o antigo admin: a ficha só abre depois de declarar o motivo.
 */
const fetchMock = vi.fn();

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
    useNavigate: () => vi.fn(),
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
import { fixtureAdminUser, fixtureState, fixtureSupportUser } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const ACOES_DA_LIDERANCA = [/^Revisar$/, /^\+ PDI$/, /^Registrar$/];

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [careerLevelsRoute] });
  return renderWithApp(<ProfilePage />);
}

describe("a diretoria lê a ficha sem ticket; o suporte declara o motivo", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ADMIN abre a ficha da Ana direto, sem o diálogo de suporte, e não encontra ação", async () => {
    renderAs(fixtureAdminUser);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Abrir a ficha em modo de suporte")).toBeNull();
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.queryByRole("button", { name: acao }), String(acao)).toBeNull();
    }
  });

  it("SUPPORT encontra o diálogo de suporte antes da ficha", async () => {
    renderAs(fixtureSupportUser);
    expect(await screen.findByText("Abrir a ficha em modo de suporte")).toBeTruthy();
    expect(screen.queryByText("Nível médio")).toBeNull();
  });
});
