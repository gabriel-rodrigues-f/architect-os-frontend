import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR 5 (adendo do dono, 2026-09-08, item 2) — a diretoria "precisa ver tudo
 * sobre todos": abre a ficha de qualquer pessoa SEM passe de suporte. E, pela
 * regra 6 (dono, 2026-09-08: "ele pode fazer tudo na plataforma"), AGE sobre
 * ela: encontra na ficha as mesmas ações que quem a lidera. O SUPPORT
 * continua como o antigo admin: a ficha só abre depois de declarar o motivo,
 * e sem ação nenhuma.
 */
const fetchMock = vi.fn();

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { supportAccess, type SessionUser } from "@/lib/api";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureSupportUser,
} from "../helpers/fixtures";
import { apiPath } from "@/lib/api-path";
import {
  careerLevelsRoute,
  type FetchRoute,
  jsonResponse,
  mockAppFetch,
} from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

/** As ações que a ficha de um liderado oferece a quem o lidera ("+ PDI" só aparece com distância fora do PDI). */
const ACOES_DA_LIDERANCA = [/^Revisar$/, /^Registrar$/];

/** O passe do suporte abre SÓ a ficha funcional (`GET /architects/:id`). */
const ana = fixtureState.architects.find((architect) => architect.id === "ana");
const fichaFuncionalRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/architects/ana")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(ana)
    : undefined;

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state: fixtureState,
    routes: [fichaFuncionalRoute, careerLevelsRoute],
  });
  return renderCareerFile(<ProfilePage />);
}

describe("a diretoria lê a ficha sem ticket; o suporte declara o motivo", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    supportAccess.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    supportAccess.clear();
  });

  it("ADMIN abre a ficha da Ana direto, sem o diálogo de suporte, e encontra as ações da liderança (regra 6)", async () => {
    renderAs(fixtureAdminUser);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Abrir a ficha em modo de suporte")).toBeNull();
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.getByRole("button", { name: acao }), String(acao)).toBeTruthy();
    }
  });

  it("controle: o gerente vinculado encontra as MESMAS ações na ficha da Ana", async () => {
    renderAs(fixtureAssignedManagerUser);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.getByRole("button", { name: acao }), String(acao)).toBeTruthy();
    }
  });

  it("SUPPORT, mesmo em modo de suporte, continua sem os botões de ação", async () => {
    renderAs(fixtureSupportUser);
    await screen.findByText("Abrir a ficha em modo de suporte");
    await userEvent.type(screen.getByLabelText("Motivo do acesso"), "chamado de suporte do teste");
    await userEvent.click(screen.getByRole("button", { name: "Abrir em modo de suporte" }));
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
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
