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

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 39, item 1 do pedido do dono, LITERAL: *"No perfil do profissional:
 * ações 'Gerar roteiro de 1:1' e 'Gerar roteiro de PDI', com o seletor de
 * perfil de geração (Empírico | Moderado | Metodológico, Moderado por padrão)
 * ANTES de gerar. O resultado é SUGESTÃO, com o próximo passo claro."*
 *
 * E a regra 19 do mesmo pedido, que é o que separa esta tela de um botão que
 * chama uma rota: estado de carregamento, tempo-limite tratado, erro da API
 * tratado, **tentar novamente**, **sem chamada duplicada**, erro amigável, e
 * a IA nunca bloqueia operação determinística.
 *
 * Os cinco casos abaixo são as cinco maneiras de essa promessa se quebrar sem
 * a suíte notar: o padrão virar Empírico numa refatoração; o duplo clique
 * virar duas chamadas (e duas cobranças do provedor); a queda do provedor
 * levar junto os fatos que o sistema calculou; o erro da API virar tela
 * branca; e o "tentar novamente" não tentar nada.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const roteiro = {
  subject: "roteiro de 1:1 desta pessoa",
  suggestion: true,
  notice: "Isto é uma sugestão gerada por inteligência artificial. Quem decide é você.",
  facts: ["Distância 2 em Domain Modeling", "Última 1:1 há 40 dias"],
  absences: ["learningPath"],
  narration: "Comece perguntando o que travou o item de PDI em aberto.",
  narrationUnavailable: null,
  agenda: "one-on-one",
  profile: "moderate",
  outline: ["Abertura", "Progresso desde a última conversa", "Combinados"],
};

const rotaDoRoteiro =
  (responder: (url: URL) => Response): FetchRoute =>
  (href) => {
    const url = new URL(href, "http://localhost");
    return url.pathname.endsWith(apiPath("/architects/ana/session-script"))
      ? responder(url)
      : undefined;
  };

const urlsDeRoteiro = (): URL[] =>
  fetchMock.mock.calls
    .map((chamada) => new URL(String(chamada[0]), "http://localhost"))
    .filter((url) => url.pathname.endsWith(apiPath("/architects/ana/session-script")));

const montaPerfil = (routes: FetchRoute[]) => {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes });
  return renderWithApp(<ProfilePage />);
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

describe("roteiros de 1:1 e de PDI no perfil do profissional", () => {
  it("as duas ações e o seletor aparecem, e o perfil nasce em Moderado", async () => {
    montaPerfil([rotaDoRoteiro(() => jsonResponse(roteiro))]);

    expect(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Gerar roteiro de PDI/ })).toBeTruthy();

    const seletor = screen.getByLabelText(/Perfil de geração/) as HTMLSelectElement;
    expect(seletor.value).toBe("moderate");
    expect(seletor.selectedOptions[0]?.textContent).toBe("Moderado");
  });

  it("gerar o roteiro de 1:1 leva a pauta e o perfil escolhido, e mostra a sugestão", async () => {
    montaPerfil([rotaDoRoteiro(() => jsonResponse(roteiro))]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ }));

    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));
    const url = urlsDeRoteiro()[0]!;
    expect(url.searchParams.get("agenda")).toBe("one-on-one");
    expect(url.searchParams.get("profile")).toBe("moderate");

    expect(await screen.findByText(/Comece perguntando/)).toBeTruthy();
    expect(screen.getByText(/Progresso desde a última conversa/)).toBeTruthy();
    expect(screen.getByText(/Distância 2 em Domain Modeling/)).toBeTruthy();
    expect(screen.getByText(/Quem decide é você/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copiar/ })).toBeTruthy();
  });

  it("o perfil escolhido antes de gerar é o que viaja — Metodológico", async () => {
    montaPerfil([rotaDoRoteiro(() => jsonResponse({ ...roteiro, profile: "methodical" }))]);
    const usuario = userEvent.setup();

    await usuario.selectOptions(await screen.findByLabelText(/Perfil de geração/), "methodical");
    await usuario.click(screen.getByRole("button", { name: /Gerar roteiro de PDI/ }));

    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));
    expect(urlsDeRoteiro()[0]!.searchParams.get("agenda")).toBe("development-plan");
    expect(urlsDeRoteiro()[0]!.searchParams.get("profile")).toBe("methodical");
  });

  it("o botão não dispara duas vezes: dois cliques, uma chamada só", async () => {
    montaPerfil([]);
    const anterior = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const href = input instanceof Request ? input.url : String(input);
      return href.includes("session-script")
        ? new Promise<Response>(() => undefined)
        : anterior(input, init);
    });
    const usuario = userEvent.setup();

    const botao = await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ });
    await usuario.click(botao);
    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));

    const gerando = screen.getByRole("button", { name: /Gerando/ });
    expect(gerando).toHaveProperty("disabled", true);
    await usuario.click(gerando);
    expect(urlsDeRoteiro().length).toBe(1);
  });

  it("provedor no chão: o parágrafo some, o aviso aparece e o que o sistema calculou fica", async () => {
    montaPerfil([
      rotaDoRoteiro(() =>
        jsonResponse({
          ...roteiro,
          narration: null,
          narrationUnavailable:
            "A sugestão em linguagem natural está indisponível no momento. O que o sistema calculou continua nesta tela.",
        }),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ }));

    expect(await screen.findByText(/está indisponível no momento/)).toBeTruthy();
    expect(screen.getByText(/Distância 2 em Domain Modeling/)).toBeTruthy();
    expect(screen.getByText(/Progresso desde a última conversa/)).toBeTruthy();
    expect(screen.queryByText(/Comece perguntando/)).toBeNull();
  });

  it("erro da API vira frase amigável com 'Tentar novamente', e tentar novamente tenta", async () => {
    let falhar = true;
    montaPerfil([
      rotaDoRoteiro(() =>
        falhar
          ? jsonResponse({ message: "Serviço fora do ar", code: "AI_DOWN" }, 503)
          : jsonResponse(roteiro),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ }));
    const recusa = await screen.findByText("Serviço fora do ar");
    expect(recusa.getAttribute("role")).toBe("alert");

    falhar = false;
    await usuario.click(screen.getByRole("button", { name: /Tentar novamente/ }));

    expect(await screen.findByText(/Comece perguntando/)).toBeTruthy();
    expect(urlsDeRoteiro().length).toBe(2);
  });

  it("a IA não bloqueia a tela: o perfil determinístico continua inteiro depois da falha", async () => {
    montaPerfil([rotaDoRoteiro(() => jsonResponse({ message: "fora", code: "AI_DOWN" }, 503))]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ }));
    await screen.findByText("fora");

    expect(screen.getByText("Ana Martins")).toBeTruthy();
    expect(screen.getByText("Perfil por capacidade")).toBeTruthy();
    expect(screen.getAllByText("Competências em evolução").length).toBeGreaterThan(0);
  });
});
