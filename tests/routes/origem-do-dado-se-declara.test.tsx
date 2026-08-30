import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `NoticeBell` chama `useRouter()` no render e `<Link>` no rodapé do popover;
 * ambos exigem `RouterProvider` real. Mesmo motivo dos testes de `AppShell`.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouter: () => ({ history: { push: () => {} } }),
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

import { NoticeBell } from "@/components/app/NoticeBell";
import { ApiClient } from "@/lib/api-client";
import { apiPath } from "@/lib/api-path";
import { calibrationApi, noticesApi } from "@/lib/api";
import { HttpCalibrationGateway } from "@/lib/gateways/calibration.gateway";
import { HttpNoticesGateway } from "@/lib/gateways/notices.gateway";
import { Route as CalibrationRoute } from "@/routes/calibration";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Duas telas estão NO AR servidas por gateway in-memory (`container.ts`:
 * `InMemoryCalibrationGateway` e `InMemoryNoticesGateway`), porque o backend
 * delas — PRD-03 e PRD-02 — ainda não existe. Quem abre /calibration vê
 * distribuição de notas FABRICADA com cara de dado da organização; quem abre
 * o sino vê avisos FABRICADOS. Numa demonstração para a empresa isso é pior
 * do que a tela não existir.
 *
 * O invariante desta rede: a declaração vem de QUEM SABE — o gateway carimba
 * a origem do dado no que devolve — e não de um texto fixo na tela. Por isso
 * cada tela é exercitada nas DUAS direções: com o gateway in-memory
 * registrado (o container de produção de hoje) a declaração aparece; com o
 * gateway HTTP real registrado ela some sozinha, sem ninguém lembrar de tirar
 * o aviso quando o PRD-02/PRD-03 chegar.
 *
 * A direção "real" não usa dublê feito à mão: instancia o `Http*Gateway` de
 * verdade sobre o `fetch` mockado. Trocar a linha do container é exatamente
 * isso.
 */
const fetchMock = vi.fn();

const DECLARACAO = /dados de demonstração/i;

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;

const calibracaoDaOrganizacao = {
  cycleId: "2026-h2",
  overall: { distribution: { "1": 0, "2": 1, "3": 2, "4": 1, "5": 0 }, average: 3 },
  evaluators: [
    {
      userId: "avaliador-real",
      name: "Avaliadora Real",
      teamIds: ["time-real"],
      distribution: { "1": 0, "2": 1, "3": 2, "4": 1, "5": 0 },
      average: 3,
      itemsCount: 4,
      assessmentsCount: 2,
    },
  ],
};

const avisosDaOrganizacao = {
  notices: [
    {
      id: "aviso-real",
      eventType: "assessment.stalled",
      title: "Avaliação real está parada",
      link: "/assessments",
      occurredAt: "2026-08-29T12:00:00.000Z",
      readAt: null,
      architectId: "arquiteto-real",
      teamId: "time-real",
    },
  ],
  unreadCount: 1,
};

const calibrationRoute: FetchRoute = (href) =>
  href.includes(apiPath("/calibration")) ? jsonResponse(calibracaoDaOrganizacao) : undefined;

const noticesRoute: FetchRoute = (href) =>
  href.includes(apiPath("/notices")) ? jsonResponse(avisosDaOrganizacao) : undefined;

const registraGatewayReal = () => {
  const client = new ApiClient();
  vi.spyOn(calibrationApi, "calibration").mockImplementation(
    new HttpCalibrationGateway(client).calibration,
  );
  vi.spyOn(noticesApi, "notices").mockImplementation(new HttpNoticesGateway(client).notices);
};

describe("/calibration declara que a distribuição é de demonstração", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [calibrationRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("com o gateway in-memory registrado, a tela diz na cara que o dado é fabricado", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("com o gateway HTTP real registrado, a declaração some sozinha", async () => {
    registraGatewayReal();
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Avaliadora Real");
    expect(screen.queryByText(DECLARACAO)).toBeNull();
  });
});

describe("o sino de avisos declara que os avisos são de demonstração", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [noticesRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("com o gateway in-memory registrado, o sino declara a origem do dado", async () => {
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    await screen.findByText(/Avaliação de Bruno Almeida está parada/);
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("com o gateway HTTP real registrado, o sino não declara nada", async () => {
    registraGatewayReal();
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    await screen.findByText("Avaliação real está parada");
    expect(screen.queryByText(DECLARACAO)).toBeNull();
  });
});
