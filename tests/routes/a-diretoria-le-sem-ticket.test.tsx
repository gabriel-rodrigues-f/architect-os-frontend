import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR 5 (adendo do dono, 2026-09-08, item 2) — a diretoria "precisa ver tudo
 * sobre todos": abre a ficha de qualquer pessoa SEM passe de suporte, e não
 * age sobre ela (quem age é quem a lidera por vínculo). O SUPPORT continua
 * como o antigo admin: a ficha só abre depois de declarar o motivo.
 */
const fetchMock = vi.fn();

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import type { SessionUser } from "@/lib/api";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { fixtureAdminUser, fixtureState, fixtureSupportUser } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const ACOES_DA_LIDERANCA = [/^Revisar$/, /^\+ PDI$/, /^Registrar$/];

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [careerLevelsRoute] });
  return renderCareerFile(<ProfilePage />);
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
