import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Item 2 do pedido do dono, os três assistentes que faltavam ter casa:
 * *"calibracao na tela de calibracao; curadoria do catalogo na Matriz; PDI
 * assistant ao lado do gap"*.
 *
 * Cada um traz uma pergunta de projeto que o teste responde:
 *
 *  - a calibração do backend é **por pessoa** (`/architects/:id/…`) e a tela
 *    de calibração é **por ciclo**. A ponte é um seletor de pessoa explícito;
 *    sem ele a tela teria de escolher alguém sozinha, e escolher a pessoa
 *    errada numa tela de calibração é pior do que não sugerir nada;
 *  - a curadoria é administrativa, como toda escrita de catálogo, e a Matriz
 *    é onde renomear, arquivar e excluir já acontecem. A leitura entra ao
 *    lado dessas operações — e não escreve nenhuma delas;
 *  - a recomendação de PDI é a única que precisa de um SEGUNDO argumento
 *    (a competência), e é a única cujo alcance no servidor inclui a própria
 *    pessoa. Ela nasce ao lado da distância, na lista de competências em
 *    evolução, e a competência escolhida é a que viaja na querystring.
 */
const fetchMock = vi.fn();

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;
const MatrixPage = MatrixRoute.options.component as () => ReactNode;
const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const apuracao = (reading: string) => ({
  subject: "assunto",
  observations: ["Duas notas distantes no mesmo ciclo"],
  reading,
});

const rotaDeIa =
  (sufixo: string, responder: () => Response): FetchRoute =>
  (href) =>
    href.includes(sufixo) ? responder() : undefined;

const urlDe = (sufixo: string): URL =>
  new URL(
    String(fetchMock.mock.calls.find((chamada) => String(chamada[0]).includes(sufixo))![0]),
    "http://localhost",
  );

const calibracaoVazia: FetchRoute = (href) =>
  href.includes(apiPath("/calibration")) && !href.includes("assistance")
    ? jsonResponse({ cycleId: "2026-h2", evaluators: [], overall: { average: null } })
    : undefined;

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("calibração — a leitura de apoio é da pessoa escolhida", () => {
  it("o seletor de pessoa decide de quem é a leitura, e a URL prova", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        calibracaoVazia,
        rotaDeIa("calibration-assistance", () =>
          jsonResponse(apuracao("A diferença vem de dois avaliadores com réguas diferentes.")),
        ),
      ],
    });
    renderWithApp(<CalibrationPage />);
    const usuario = userEvent.setup();

    await usuario.selectOptions(
      await screen.findByLabelText(/Pessoa para a leitura de apoio/),
      "bruno",
    );
    await usuario.click(screen.getByRole("button", { name: /Ler apoio à calibração/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((chamada) =>
          String(chamada[0]).includes("calibration-assistance"),
        ).length,
      ).toBe(1),
    );
    expect(urlDe("calibration-assistance").pathname).toBe(
      apiPath("/architects/bruno/calibration-assistance"),
    );
    expect(await screen.findByText(/dois avaliadores com réguas diferentes/)).toBeTruthy();
    expect(screen.getByText("Duas notas distantes no mesmo ciclo")).toBeTruthy();
  });
});

describe("curadoria do catálogo — leitura ao lado das operações que escrevem", () => {
  it("a Matriz lê a qualidade do catálogo e nada é alterado por isso", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        rotaDeIa("quality-review", () =>
          jsonResponse(apuracao("Duas competências descrevem a mesma coisa com nomes diferentes.")),
        ),
      ],
    });
    renderWithApp(<MatrixPage />);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Revisar a qualidade/ }));

    expect(await screen.findByText(/mesma coisa com nomes diferentes/)).toBeTruthy();
    expect(urlDe("quality-review").pathname).toBe(apiPath("/capabilities/quality-review"));
    expect(
      fetchMock.mock.calls.filter(
        (chamada) => ((chamada[1] as RequestInit | undefined)?.method ?? "GET") !== "GET",
      ),
    ).toEqual([]);
  });
});

describe("PDI assistant — ao lado da distância que ele trata", () => {
  it("sugerir a partir de uma competência em evolução leva a competência na querystring", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        rotaDeIa("development-plan-recommendation", () =>
          jsonResponse({
            subject: "proposta de item de PDI",
            suggestion: true,
            notice: "Isto é uma sugestão. Quem decide é você.",
            facts: ["Distância 2 nesta competência"],
            absences: [],
            narration: "Objetivo: fechar a distância em um ciclo.",
            narrationUnavailable: null,
            distance: {
              competencyId: "security-iam",
              competencyName: "Security & IAM",
              capabilityName: "Segurança",
              currentLevel: 2,
              requiredLevel: 4,
              distance: 2,
            },
          }),
        ),
      ],
    });
    renderWithApp(<ProfilePage />);
    const usuario = userEvent.setup();

    const [primeiro] = await screen.findAllByRole("button", { name: /Sugerir item de PDI/ });
    await usuario.click(primeiro!);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((chamada) =>
          String(chamada[0]).includes("development-plan-recommendation"),
        ).length,
      ).toBe(1),
    );
    const url = urlDe("development-plan-recommendation");
    expect(url.pathname).toBe(apiPath("/architects/ana/development-plan-recommendation"));
    expect(url.searchParams.get("competencyId")).toBe("security-iam");

    expect(await screen.findByText(/fechar a distância em um ciclo/)).toBeTruthy();
    expect(screen.getByText(/Quem decide é você/)).toBeTruthy();
  });
});
