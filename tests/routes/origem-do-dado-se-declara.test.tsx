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
import { apiPath } from "@/lib/api-path";
import { calibrationApi, noticesApi } from "@/lib/api";
import { InMemoryCalibrationGateway } from "@/lib/gateways/calibration.gateway";
import { InMemoryNoticesGateway } from "@/lib/gateways/notices.gateway";
import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as NoticesRoute } from "@/routes/notices";
import { fixtureAdminUser, fixtureState, fixtureAssignedTechLeadUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Duas telas ficaram NO AR servidas por gateway in-memory enquanto o backend
 * delas — PRD-02 e PRD-03 — não existia. Quem abria /calibration via
 * distribuição de notas FABRICADA com cara de dado da organização; quem abria
 * o sino via avisos FABRICADOS. Numa demonstração para a empresa isso é pior
 * do que a tela não existir.
 *
 * O invariante desta rede: a declaração vem de QUEM SABE — o gateway carimba
 * a origem do dado no que devolve — e não de um texto fixo na tela. Por isso
 * cada tela é exercitada nas DUAS direções.
 *
 * A onda 24 ligou os gateways HTTP no container, e é essa a virada que este
 * arquivo agora prende: a direção "organização" NÃO registra dublê nenhum —
 * é o container de produção respondendo ao `fetch` mockado, e a declaração
 * some SOZINHA, sem ninguém ter apagado o aviso à mão. A direção
 * "demonstração" registra o gateway in-memory de propósito, para provar que
 * o carimbo continua sendo o que acende o aviso: se um gateway fabricado
 * voltar ao container, a tela volta a declarar por conta própria.
 */
const fetchMock = vi.fn();

const DECLARACAO = /dados de demonstração/i;

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;
const NoticesPage = NoticesRoute.options.component as () => ReactNode;

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

const registraGatewayDeDemonstracao = () => {
  vi.spyOn(calibrationApi, "calibration").mockImplementation(
    new InMemoryCalibrationGateway().calibration,
  );
  vi.spyOn(noticesApi, "notices").mockImplementation(
    new InMemoryNoticesGateway(() => Promise.resolve(fixtureTeamLeadUser)).notices,
  );
};

describe("/calibration declara a origem da distribuição que está mostrando", () => {
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
    registraGatewayDeDemonstracao();
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("com o container de produção, a declaração some sozinha", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Avaliadora Real");
    expect(screen.queryByText(DECLARACAO)).toBeNull();
  });
});

/**
 * Onda 21 — a sessão daqui passou a ser a do TECH LEAD, não a do admin.
 * O mock de avisos deixou de tratar admin como destinatário universal: o
 * CONTRATO do PRD-02 nomeia dois destinatários (o líder, pelo TIME; a pessoa,
 * pelos próprios avisos) e o admin não é nenhum dos dois. Com sessão de admin
 * a Central abre vazia — e uma tela vazia não prova nada sobre carimbo de
 * origem. O que este arquivo verifica continua sendo o carimbo, não o recorte.
 */
describe("o sino de avisos declara a origem dos avisos que está mostrando", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
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
    registraGatewayDeDemonstracao();
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    await screen.findByText(/Evidência de Carla Souza espera revisão/);
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("com o container de produção, o sino não declara nada", async () => {
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    await screen.findByText("Avaliação real está parada");
    expect(screen.queryByText(DECLARACAO)).toBeNull();
  });

  it("a central de avisos inteira declara a origem se um mock voltar a serví-la", async () => {
    registraGatewayDeDemonstracao();
    renderWithApp(<NoticesPage />);
    await screen.findByText(/Evidência de Carla Souza espera revisão/);
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("com o container de produção, a central de avisos não declara nada", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Avaliação real está parada");
    expect(screen.queryByText(DECLARACAO)).toBeNull();
  });
});
