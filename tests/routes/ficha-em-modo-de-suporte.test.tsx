import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { supportAccess } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { fixtureState, fixtureSupportUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  type FetchRoute,
  hrefOf,
  jsonResponse,
  mockAppFetch,
} from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * PR 6 (RBAC-03, [FA-07]) — o passe de suporte abre SÓ a ficha funcional
 * (`GET /professionals/:id`); avaliações, PDI, mentoria e trilhas
 * respondem 403 ao suporte mesmo com passe. A tela não pede o que o serviço
 * recusa: desenha o ramo "indisponível no modo de suporte" no lugar das
 * seções, e a ficha funcional segue. O passe vale 15 minutos; vencido, o
 * serviço responde `SUPPORT_PASS_EXPIRED` e o diálogo volta.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const ana = fixtureState.professionals.find((professional) => professional.id === "ana");
const MOTIVO = "chamado 4821, conferir cadastro duplicado";
const TITULO_DO_DIALOGO = "Abrir a ficha em modo de suporte";

const fichaFuncionalRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/professionals/ana")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(ana)
    : undefined;

const passeVencidoRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/professionals/ana"))
    ? jsonResponse({ code: "SUPPORT_PASS_EXPIRED", message: "O passe de suporte venceu." }, 403)
    : undefined;

const chamadasPara = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => hrefOf(call[0] as string).includes(suffix));

async function abrirEmSuporte() {
  const rendered = renderCareerFile(<ProfilePage />);
  await screen.findByText(TITULO_DO_DIALOGO);
  await userEvent.type(screen.getByLabelText("Motivo do acesso"), MOTIVO);
  await userEvent.click(screen.getByRole("button", { name: "Abrir em modo de suporte" }));
  return rendered;
}

describe("ficha em modo de suporte", () => {
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

  it("desenha a ficha funcional e o ramo indisponível, sem pedir o que o serviço recusa", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      state: fixtureState,
      routes: [fichaFuncionalRoute, careerLevelsRoute],
    });
    await abrirEmSuporte();

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Indisponível no modo de suporte/)).toBeTruthy();
    expect(screen.queryByText("Nível médio")).toBeNull();
    expect(screen.queryByText(/Falha ao carregar|Não foi possível/)).toBeNull();
    expect(chamadasPara(apiPath("/assessments"))).toHaveLength(0);
    expect(chamadasPara(apiPath("/plans"))).toHaveLength(0);
    expect(chamadasPara(apiPath("/mentoring-sessions"))).toHaveLength(0);
  });

  it("os três cabeçalhos do passe vão na requisição da pessoa — e só nela", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      state: fixtureState,
      routes: [fichaFuncionalRoute, careerLevelsRoute],
    });
    await abrirEmSuporte();
    await screen.findByText(/Indisponível no modo de suporte/);

    const daPessoa = chamadasPara(apiPath("/professionals/ana"));
    expect(daPessoa.length).toBeGreaterThan(0);
    for (const call of daPessoa) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-support-professional"]).toBe("ana");
      expect(headers["x-support-reason"]).toBe(MOTIVO);
      expect(headers["x-support-issued-at"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    for (const call of chamadasPara(apiPath("/auth/me"))) {
      const headers = ((call[1] as RequestInit | undefined)?.headers ?? {}) as Record<
        string,
        string
      >;
      expect(headers).not.toHaveProperty("x-support-issued-at");
    }
  });

  it("passe vencido no serviço apaga o passe e reabre o diálogo", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      state: fixtureState,
      routes: [passeVencidoRoute, careerLevelsRoute],
    });
    await abrirEmSuporte();

    await waitFor(() =>
      expect(chamadasPara(apiPath("/professionals/ana")).length).toBeGreaterThan(0),
    );
    await waitFor(() => expect(supportAccess.grantedFor("ana")).toBeNull());
    expect(await screen.findByText(TITULO_DO_DIALOGO)).toBeTruthy();
    expect(screen.queryByText(/Indisponível no modo de suporte/)).toBeNull();
  });
});
