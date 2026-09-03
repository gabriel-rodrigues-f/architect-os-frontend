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

import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as RoadmapRoute } from "@/routes/architects.$architectId.roadmap";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 39, item 2 do pedido do dono: *"cada assistente onde o trabalho
 * acontece"*. Duas metades deste item, e a segunda tem uma exigência que a
 * primeira não tem:
 *
 *  - o **copiloto de 1:1** mora em `/mentoring`, ao lado de quem está prestes
 *    a conduzir a conversa e vai registrá-la ali mesmo. Ele segue a pessoa
 *    escolhida no filtro — um copiloto que fala de outra pessoa é pior do que
 *    nenhum;
 *  - a **explicação da prontidão** mora no Roteiro, ao lado do veredito
 *    determinístico, com a exigência literal do dono: *"o veredito
 *    deterministico continua aparecendo SOZINHO quando a IA cai"*.
 *
 * O caso que carrega essa exigência é o penúltimo: com o provedor no chão, o
 * Roteiro continua mostrando as duas aderências e as competências abaixo do
 * exigido. Se um dia alguém embrulhar a tela inteira no estado do assistente,
 * é este teste que fica vermelho.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

const NIVEL_ATUAL = "arquiteto-de-solucoes-ii";
const PROXIMO_NIVEL = "arquiteto-de-solucoes-iii";

const anaNoNivelDois: AppState = {
  ...fixtureState,
  architects: fixtureState.architects.map((architect) =>
    architect.id === "ana" ? { ...architect, careerLevelId: NIVEL_ATUAL } : architect,
  ),
};

const aderenciaRoute: FetchRoute = (href) => {
  if (!href.includes(apiPath("/architects/ana/adherence"))) return undefined;
  const careerLevelId = new URL(href, "http://localhost").searchParams.get("careerLevelId") ?? "";
  const percentage = careerLevelId === PROXIMO_NIVEL ? 0.58 : 0.93;
  return jsonResponse({
    architectId: "ana",
    teamId: "time-plataforma",
    careerLevelId,
    adherence: {
      percentage,
      missingCompetencies: [{ competencyId: "abaixo-0", currentLevel: 1, requiredLevel: 4 }],
    },
  });
};

const conselhoBase = {
  subject: "assunto",
  suggestion: true,
  notice: "Isto é uma sugestão. Nada foi gravado: quem decide é você.",
  facts: ["Última 1:1 há 40 dias", "Dois itens de PDI em aberto"],
  absences: ["learningPath"],
  narration: null as string | null,
  narrationUnavailable: null as string | null,
};

const prontidao = {
  ...conselhoBase,
  narration: "Falta uma capacidade qualificada para o próximo nível.",
  readiness: {
    currentCareerLevel: "Pleno",
    nextCareerLevel: "Sênior",
    eligible: false,
    qualifiedCapabilityCount: 2,
    minimumQualifiedCapabilities: 3,
  },
};

const preparacao = { ...conselhoBase, narration: "Comece pelo item de PDI mais antigo." };

const rotaDeIa =
  (sufixo: string, responder: () => Response): FetchRoute =>
  (href) =>
    href.includes(sufixo) ? responder() : undefined;

const chamadasA = (sufixo: string): number =>
  fetchMock.mock.calls.filter((chamada) => String(chamada[0]).includes(sufixo)).length;

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("copiloto de 1:1 — onde a conversa acontece", () => {
  const montaMentoria = (routes: FetchRoute[]) => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes });
    renderWithApp(<MentoringPage />);
  };

  it("prepara a 1:1 da pessoa escolhida no filtro, e mostra o que o sistema apurou", async () => {
    montaMentoria([rotaDeIa("one-on-one-preparation", () => jsonResponse(preparacao))]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Preparar a 1:1/ }));

    await waitFor(() => expect(chamadasA("one-on-one-preparation")).toBe(1));
    const url = new URL(
      String(
        fetchMock.mock.calls.find((chamada) =>
          String(chamada[0]).includes("one-on-one-preparation"),
        )![0],
      ),
      "http://localhost",
    );
    expect(url.pathname).toBe(apiPath("/architects/ana/one-on-one-preparation"));

    expect(await screen.findByText(/Comece pelo item de PDI mais antigo/)).toBeTruthy();
    expect(screen.getByText(/Última 1:1 há 40 dias/)).toBeTruthy();
    expect(screen.getByText(/quem decide é você/)).toBeTruthy();
  });

  it("com o provedor no chão a linha do tempo continua de pé", async () => {
    montaMentoria([
      rotaDeIa("one-on-one-preparation", () =>
        jsonResponse({ message: "Leitura indisponível", code: "AI_DOWN" }, 503),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Preparar a 1:1/ }));

    expect(await screen.findByText("Leitura indisponível")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tentar novamente/ })).toBeTruthy();
    expect(screen.getByText("Linha do Tempo")).toBeTruthy();
  });
});

describe("explicação da prontidão — ao lado do veredito determinístico", () => {
  const montaRoteiro = (routes: FetchRoute[]) => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: anaNoNivelDois,
      routes: [careerLevelsRoute, aderenciaRoute, ...routes],
    });
    renderWithApp(<RoadmapPage />);
  };

  it("explica o resultado e publica o veredito que o motor determinístico calculou", async () => {
    montaRoteiro([rotaDeIa("career-readiness-explanation", () => jsonResponse(prontidao))]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Explicar a prontidão/ }));

    expect(await screen.findByText(/Falta uma capacidade qualificada/)).toBeTruthy();
    expect(screen.getByText(/Pleno → Sênior/)).toBeTruthy();
    expect(screen.getByText(/Ainda não elegível/)).toBeTruthy();
    expect(screen.getByText(/2 de 3 capacidades qualificadas/)).toBeTruthy();
  });

  it("sem o parágrafo do provedor, o veredito aparece SOZINHO", async () => {
    montaRoteiro([
      rotaDeIa("career-readiness-explanation", () =>
        jsonResponse({
          ...prontidao,
          narration: null,
          narrationUnavailable: "A sugestão em linguagem natural está indisponível no momento.",
        }),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Explicar a prontidão/ }));

    expect(await screen.findByText(/está indisponível no momento/)).toBeTruthy();
    expect(screen.getByText(/Ainda não elegível/)).toBeTruthy();
    expect(screen.getByText(/2 de 3 capacidades qualificadas/)).toBeTruthy();
  });

  it("a IA cair não apaga o Roteiro: as duas aderências continuam na tela", async () => {
    montaRoteiro([
      rotaDeIa("career-readiness-explanation", () =>
        jsonResponse({ message: "Leitura indisponível", code: "AI_DOWN" }, 503),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Explicar a prontidão/ }));

    expect(await screen.findByText("Leitura indisponível")).toBeTruthy();
    expect(screen.getByText("93%")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy();
  });

  it("o nível de carreira da fixture continua sendo o que a tela mostra", () => {
    expect(fixtureCareerLevels.some((nivel) => nivel.id === PROXIMO_NIVEL)).toBe(true);
  });
});
