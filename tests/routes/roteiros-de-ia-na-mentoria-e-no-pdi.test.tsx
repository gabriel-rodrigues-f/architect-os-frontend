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
import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as PlansRoute } from "@/routes/development-plans";
import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Pedido do dono (2026-09-07), literal: *"Em Talentos do Time > Gerar roteiro
 * de 1:1 e Gerar roteiro de PDI: estas duas opções não deveriam estar nessa
 * página. Cada uma deveria fazer parte do seu respectivo menu, Plano
 * Individual de Desenvolvimento (PDI) e Mentoria e 1:1. Migre estes menus
 * para suas respectivas telas e remova totalmente geração com IA de
 * 'Talentos do Time'."*
 *
 * Três invariantes, um por tela:
 *
 *  1. a ficha (Visão geral de Talentos do Time) não tem NENHUM botão de IA —
 *     nem roteiro, nem "sugerir item de PDI", nem "verificar sinais", nem
 *     apoio à revisão — para gerente e para tech lead;
 *  2. Mentoria e 1:1 oferece SÓ o roteiro de 1:1; o PDI oferece SÓ o roteiro
 *     de PDI. Um botão por pauta: são duas operações de negócio (ADR-0087);
 *  3. o profissional não vê geração de IA em nenhuma das duas.
 *
 * E a regra 19 do pedido anterior continua valendo no novo endereço: perfil
 * Moderado por padrão, a pauta certa viaja, sem chamada duplicada, provedor
 * no chão não leva os fatos junto, erro vira frase com "tentar novamente".
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const PlansPage = PlansRoute.options.component as () => ReactNode;

const BOTOES_DE_IA = [
  /Gerar roteiro de 1:1/,
  /Gerar roteiro de PDI/,
  /Verificar sinais/,
  /Sugerir item de PDI/,
  /Ler apoio à revisão/,
  /Preparar a 1:1/,
];

const roteiro = (agenda: "one-on-one" | "development-plan") => ({
  subject: "roteiro desta pessoa",
  suggestion: true,
  notice: "Isto é uma sugestão gerada por inteligência artificial. Quem decide é você.",
  facts: ["Distância 2 em Domain Modeling", "Última 1:1 há 40 dias"],
  absences: ["learningPath"],
  narration: "Comece perguntando o que travou o item de PDI em aberto.",
  narrationUnavailable: null,
  agenda,
  profile: "moderate",
  outline: ["Abertura", "Progresso desde a última conversa", "Combinados"],
});

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

const monta = (Page: () => ReactNode, user: SessionUser, routes: FetchRoute[] = []) => {
  mockAppFetch(fetchMock, { user, routes });
  return renderWithApp(<Page />);
};

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  window.history.pushState({}, "", "?architectId=ana");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("a ficha de Talentos do Time não gera nada com IA", () => {
  it.each([
    ["gerente", fixtureAssignedManagerUser],
    ["tech lead", fixtureAssignedTechLeadUser],
  ])("%s abre a ficha da Ana e não encontra botão de IA", async (_papel, user) => {
    monta(ProfilePage, user);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Perfil por capacidade")).toBeTruthy();
    for (const botao of BOTOES_DE_IA) {
      expect(screen.queryByRole("button", { name: botao }), String(botao)).toBeNull();
    }
  });

  it("o diálogo de revisar evidência também ficou sem apoio de IA", async () => {
    monta(ProfilePage, fixtureAssignedTechLeadUser);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /^Revisar$/ }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo.querySelector("#ev-review-status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ler apoio à revisão/ })).toBeNull();
  });
});

describe("Mentoria e 1:1 — só o roteiro de 1:1", () => {
  it("mostra 'Gerar roteiro de 1:1', não 'Gerar roteiro de PDI', e o perfil nasce em Moderado", async () => {
    monta(MentoringPage, fixtureAssignedManagerUser);

    expect(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro de PDI/ })).toBeNull();

    const seletor = screen.getByLabelText(/Perfil de geração/) as HTMLSelectElement;
    expect(seletor.value).toBe("moderate");
    expect(seletor.selectedOptions[0]?.textContent).toBe("Moderado");
  });

  it("gerar leva a pauta one-on-one e o perfil escolhido, e mostra a sugestão", async () => {
    monta(MentoringPage, fixtureAssignedManagerUser, [
      rotaDoRoteiro(() => jsonResponse({ ...roteiro("one-on-one"), profile: "methodical" })),
    ]);
    const usuario = userEvent.setup();

    await usuario.selectOptions(await screen.findByLabelText(/Perfil de geração/), "methodical");
    await usuario.click(screen.getByRole("button", { name: /Gerar roteiro de 1:1/ }));

    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));
    const url = urlsDeRoteiro()[0]!;
    expect(url.searchParams.get("agenda")).toBe("one-on-one");
    expect(url.searchParams.get("profile")).toBe("methodical");

    expect(await screen.findByText(/Comece perguntando/)).toBeTruthy();
    expect(screen.getByText(/Progresso desde a última conversa/)).toBeTruthy();
    expect(screen.getByText(/Distância 2 em Domain Modeling/)).toBeTruthy();
    expect(screen.getByText(/Quem decide é você/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copiar/ })).toBeTruthy();
  });

  it("o botão não dispara duas vezes: dois cliques, uma chamada só", async () => {
    monta(MentoringPage, fixtureAssignedManagerUser);
    const anterior = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const href = input instanceof Request ? input.url : String(input);
      return href.includes("session-script")
        ? new Promise<Response>(() => undefined)
        : anterior(input, init);
    });
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de 1:1/ }));
    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));

    const gerando = screen.getByRole("button", { name: /Gerando/ });
    expect(gerando).toHaveProperty("disabled", true);
    await usuario.click(gerando);
    expect(urlsDeRoteiro().length).toBe(1);
  });

  it("provedor no chão: o parágrafo some, o aviso aparece e o que o sistema calculou fica", async () => {
    monta(MentoringPage, fixtureAssignedManagerUser, [
      rotaDoRoteiro(() =>
        jsonResponse({
          ...roteiro("one-on-one"),
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
    expect(screen.queryByText(/Comece perguntando/)).toBeNull();
  });

  it("erro da API vira frase amigável com 'Tentar novamente', e tentar novamente tenta", async () => {
    let falhar = true;
    monta(MentoringPage, fixtureAssignedManagerUser, [
      rotaDoRoteiro(() =>
        falhar
          ? jsonResponse({ message: "Serviço fora do ar", code: "AI_DOWN" }, 503)
          : jsonResponse(roteiro("one-on-one")),
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

  it("o profissional não vê geração de IA", async () => {
    monta(MentoringPage, fixtureMemberUser);
    expect(await screen.findByText("Mentoria e 1:1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro/ })).toBeNull();
    expect(screen.queryByLabelText(/Perfil de geração/)).toBeNull();
  });
});

describe("PDI — só o roteiro de PDI", () => {
  it("mostra 'Gerar roteiro de PDI' e não 'Gerar roteiro de 1:1'", async () => {
    monta(PlansPage, fixtureAssignedManagerUser);

    expect(await screen.findByRole("button", { name: /Gerar roteiro de PDI/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro de 1:1/ })).toBeNull();
    expect(screen.getByLabelText(/Perfil de geração/)).toBeTruthy();
  });

  it("gerar leva a pauta development-plan e o perfil padrão, e mostra a sugestão", async () => {
    monta(PlansPage, fixtureAssignedManagerUser, [
      rotaDoRoteiro(() => jsonResponse(roteiro("development-plan"))),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de PDI/ }));

    await waitFor(() => expect(urlsDeRoteiro().length).toBe(1));
    const url = urlsDeRoteiro()[0]!;
    expect(url.searchParams.get("agenda")).toBe("development-plan");
    expect(url.searchParams.get("profile")).toBe("moderate");

    expect(await screen.findByText(/Comece perguntando/)).toBeTruthy();
    expect(screen.getByText(/Quem decide é você/)).toBeTruthy();
  });

  it("o profissional não vê geração de IA", async () => {
    monta(PlansPage, fixtureMemberUser);
    expect(await screen.findByText("Evoluir IAM")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro/ })).toBeNull();
    expect(screen.queryByLabelText(/Perfil de geração/)).toBeNull();
  });
});
