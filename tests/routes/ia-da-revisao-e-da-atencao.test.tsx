import { cleanup, screen, waitFor, within } from "@testing-library/react";
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

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Item 2 do pedido do dono, os dois assistentes do TRABALHO que moram na ficha
 * da pessoa: *"revisor no dialogo de revisar evidencia"* e *"estagnacao como
 * aviso 'Requer atencao'"*.
 *
 * Dois invariantes aqui não são estéticos:
 *
 *  1. **o revisor não decide.** ADR-0088: nenhum assistente aprova, rejeita,
 *     nota ou classifica. Dentro do diálogo de revisão, a leitura de apoio
 *     aparece ao lado do `<select>` de decisão — e o `<select>` continua
 *     sendo o único caminho para o desfecho. O teste afirma a AUSÊNCIA de
 *     qualquer botão de aprovar vindo do bloco de IA;
 *  2. **a expressão é "Requer atenção"**, pedido literal do dono, e a
 *     alternativa que ele PROIBIU tem rede própria em
 *     `vocabulario-positivo`. Aqui se fixa o outro lado: sem sinal, a tela
 *     diz que nada requer atenção — silêncio, cada gestor interpreta como
 *     quiser.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const apoioDaRevisao = {
  subject: "leitura de apoio à revisão desta evidência",
  observations: ["Declara 2 competências", "Sem revisão anterior"],
  reading: "A evidência descreve a decisão, mas não diz qual alternativa foi descartada.",
};

const rotaDeIa =
  (sufixo: string, responder: () => Response): FetchRoute =>
  (href) =>
    href.includes(sufixo) ? responder() : undefined;

const montaPerfil = (routes: FetchRoute[]) => {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes });
  renderWithApp(<ProfilePage />);
};

const abreORevisor = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.click(await screen.findByRole("button", { name: /^Revisar$/ }));
  return screen.getByRole("dialog");
};

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("revisor de evidência — apoio ao lado da decisão, nunca no lugar dela", () => {
  it("lê o apoio da evidência aberta e mostra apuração antes de interpretação", async () => {
    montaPerfil([rotaDeIa("review-assistance", () => jsonResponse(apoioDaRevisao))]);
    const usuario = userEvent.setup();
    const dialogo = await abreORevisor(usuario);

    await usuario.click(within(dialogo).getByRole("button", { name: /Ler apoio à revisão/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((chamada) => String(chamada[0]).includes("review-assistance"))
          .length,
      ).toBe(1),
    );
    const url = new URL(
      String(
        fetchMock.mock.calls.find((chamada) =>
          String(chamada[0]).includes("review-assistance"),
        )![0],
      ),
      "http://localhost",
    );
    expect(url.pathname).toBe(apiPath("/evidences/e1/review-assistance"));

    expect(await within(dialogo).findByText(/qual alternativa foi descartada/)).toBeTruthy();
    expect(within(dialogo).getByText("Declara 2 competências")).toBeTruthy();
  });

  it("o apoio não decide: a decisão continua no seletor humano", async () => {
    montaPerfil([rotaDeIa("review-assistance", () => jsonResponse(apoioDaRevisao))]);
    const usuario = userEvent.setup();
    const dialogo = await abreORevisor(usuario);

    await usuario.click(within(dialogo).getByRole("button", { name: /Ler apoio à revisão/ }));
    await within(dialogo).findByText(/qual alternativa foi descartada/);

    expect(within(dialogo).getByLabelText(/Status/)).toBeTruthy();
    expect(within(dialogo).getByRole("button", { name: /Salvar/ })).toHaveProperty(
      "disabled",
      false,
    );
    expect(within(dialogo).queryByRole("button", { name: /^Aprovar/ })).toBeNull();
  });

  it("apoio indisponível não trava a revisão", async () => {
    montaPerfil([
      rotaDeIa("review-assistance", () =>
        jsonResponse({ message: "Leitura indisponível", code: "AI_DOWN" }, 503),
      ),
    ]);
    const usuario = userEvent.setup();
    const dialogo = await abreORevisor(usuario);

    await usuario.click(within(dialogo).getByRole("button", { name: /Ler apoio à revisão/ }));

    expect(await within(dialogo).findByText("Leitura indisponível")).toBeTruthy();
    expect(within(dialogo).getByLabelText(/Status/)).toBeTruthy();
    expect(within(dialogo).getByRole("button", { name: /Salvar/ })).toHaveProperty(
      "disabled",
      false,
    );
  });
});

describe("estagnação — a expressão é 'Requer atenção'", () => {
  it("com sinal, a tela diz Requer atenção e mostra o que o sistema detectou", async () => {
    montaPerfil([
      rotaDeIa("stagnation-alert", () =>
        jsonResponse({
          subject: "sinais de estagnação desta pessoa",
          signals: ["Mesmo nível há 3 ciclos", "Nenhuma evidência aceita em 180 dias"],
          requiresAttention: true,
          alert: "O desenvolvimento parou de avançar nos últimos três ciclos.",
        }),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Verificar sinais/ }));

    expect(await screen.findByText("Requer atenção")).toBeTruthy();
    expect(screen.getByText(/O desenvolvimento parou de avançar/)).toBeTruthy();
    expect(screen.getByText("Mesmo nível há 3 ciclos")).toBeTruthy();
  });

  it("sem sinal, a tela diz que nada requer atenção — não fica em silêncio", async () => {
    montaPerfil([
      rotaDeIa("stagnation-alert", () =>
        jsonResponse({
          subject: "sinais de estagnação desta pessoa",
          signals: ["Subiu de nível no ciclo passado"],
          requiresAttention: false,
          alert: null,
        }),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Verificar sinais/ }));

    expect(await screen.findByText("Nada requer atenção agora")).toBeTruthy();
    expect(screen.queryByText("Requer atenção")).toBeNull();
    expect(screen.getByText("Subiu de nível no ciclo passado")).toBeTruthy();
  });
});
