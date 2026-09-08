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
        useParams: () => ({ professionalId: "ana" }),
      }),
  };
});

import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureAssignedManagerUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Item 2 do pedido do dono, os assistentes que faltavam ter casa:
 * *"calibracao na tela de calibracao; curadoria do catalogo na Matriz"*.
 * (A recomendação de PDI que morava na ficha saiu dela em 2026-09-07 — o dono
 * removeu toda geração com IA de Talentos do Time.)
 *
 * Cada um traz uma pergunta de projeto que o teste responde:
 *
 *  - a calibração do backend é **por pessoa** (`/professionals/:id/…`) e a tela
 *    de calibração é **por ciclo**. A ponte é um seletor de pessoa explícito;
 *    sem ele a tela teria de escolher alguém sozinha, e escolher a pessoa
 *    errada numa tela de calibração é pior do que não sugerir nada;
 *  - D1 (dono, 2026-09-05): calibração e PDI são telas de pessoa — do gerente
 *    vinculado, não do admin. O admin fica só com a curadoria do catálogo;
 *  - a curadoria é administrativa, como toda escrita de catálogo, e a Matriz
 *    é onde renomear, arquivar e excluir já acontecem. A leitura entra ao
 *    lado dessas operações — e não escreve nenhuma delas.
 */
const fetchMock = vi.fn();

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

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
  it("o seletor de pessoa decide de quem é a leitura, e a URL prova (o ator é o gerente vinculado, D1)", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      routes: [
        calibracaoVazia,
        rotaDeIa("calibration-assistance", () =>
          jsonResponse(apuracao("A diferença vem de dois avaliadores com réguas diferentes.")),
        ),
      ],
    });
    renderWithApp(<CalibrationPage />);
    const usuario = userEvent.setup();

    await usuario.click(
      await screen.findByRole("combobox", { name: /Profissional para a leitura de apoio/ }),
    );
    await usuario.click(await screen.findByRole("option", { name: /Bruno Almeida/ }));
    await usuario.click(screen.getByRole("button", { name: /Ler apoio à calibração/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((chamada) =>
          String(chamada[0]).includes("calibration-assistance"),
        ).length,
      ).toBe(1),
    );
    expect(urlDe("calibration-assistance").pathname).toBe(
      apiPath("/professionals/bruno/calibration-assistance"),
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
