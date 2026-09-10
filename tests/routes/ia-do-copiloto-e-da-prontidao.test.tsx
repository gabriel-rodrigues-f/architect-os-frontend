import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as RoadmapRoute } from "@/routes/professionals.$professionalId.roadmap";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAssignedManagerUser, fixtureCareerLevels, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  type FetchRoute,
} from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

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

const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

const NIVEL_ATUAL = "arquiteto-de-solucoes-ii";
const PROXIMO_NIVEL = "arquiteto-de-solucoes-iii";

const anaNoNivelDois: AppState = {
  ...fixtureState,
  professionals: fixtureState.professionals.map((professional) =>
    professional.id === "ana" ? { ...professional, careerLevelId: NIVEL_ATUAL } : professional,
  ),
};

const aderenciaRoute: FetchRoute = (href) => {
  if (!href.includes(apiPath("/professionals/ana/adherence"))) return undefined;
  const careerLevelId = new URL(href, "http://localhost").searchParams.get("careerLevelId") ?? "";
  const percentage = careerLevelId === PROXIMO_NIVEL ? 0.58 : 0.93;
  return jsonResponse({
    professionalId: "ana",
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

/**
 * DONO, 2026-09-10 — o campo `readiness` carregava o VEREDITO e morreu com a
 * elegibilidade. O que a rota entrega são os FATOS medidos, e é sobre eles
 * que valem as duas garantias de sempre: eles aparecem com a narração e
 * continuam aparecendo sem ela.
 */
const prontidao = {
  ...conselhoBase,
  narration: "Falta uma capacidade para o esperado do próximo nível.",
};

const rotaDeIa =
  (sufixo: string, responder: () => Response): FetchRoute =>
  (href) =>
    href.includes(sufixo) ? responder() : undefined;

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/*
 * AQUI MORAVA "copiloto de 1:1 — onde a conversa acontece", os dois casos da
 * Preparação do 1:1 na tela de Mentoria: a chamada com a pessoa do filtro, e
 * o 5xx do provedor virando a NOSSA frase sem derrubar a Linha do Tempo.
 *
 * A tela saiu do inventário de IA em 2026-09-09: *"Em Mentoria e 1:1, pode
 * remover a parte da IA, não é útil."*
 *
 * O que os dois casos mediam continua medido, em outro endereço: a chamada
 * com o perfil escolhido e o 5xx virando frase nossa são do
 * `ProfiledAdviceSection`, compartilhado, e o bloco de baixo os afirma sobre o
 * roteiro de PDI. O que deixou de existir é a pergunta específica — se a
 * queda da IA derrubava a Linha do Tempo —, porque não há mais IA nessa tela
 * para cair.
 */

describe("explicação da prontidão — ao lado dos fatos medidos", () => {
  const montaRoteiro = (routes: FetchRoute[]) => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: anaNoNivelDois,
      routes: [careerLevelsRoute, aderenciaRoute, ...routes],
    });
    renderCareerFile(<RoadmapPage />, { tab: "roadmap" });
  };

  it("explica a distância e não anuncia veredito nenhum", async () => {
    montaRoteiro([rotaDeIa("career-readiness-explanation", () => jsonResponse(prontidao))]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Explicar a prontidão/ }));

    expect(await screen.findByText(/Falta uma capacidade para o esperado/)).toBeTruthy();
    expect(screen.queryByText(/Ainda não elegível/)).toBeNull();
    expect(screen.queryByText(/capacidades qualificadas/)).toBeNull();
  });

  it("sem o parágrafo do provedor, os fatos medidos continuam na tela", async () => {
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
    expect(screen.queryByText(/Ainda não elegível/)).toBeNull();
  });

  it("a IA cair não apaga o Roteiro: as duas aderências continuam na tela", async () => {
    montaRoteiro([
      rotaDeIa("career-readiness-explanation", () =>
        jsonResponse({ message: "Leitura indisponível", code: "AI_DOWN" }, 503),
      ),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Explicar a prontidão/ }));

    // A frase de um 5xx é NOSSA (2026-09-09): a do serviço nomeia a dependência.
    expect(
      await screen.findByText("Não foi possível gerar a sugestão agora. Tente novamente."),
    ).toBeTruthy();
    expect(screen.queryByText("Leitura indisponível")).toBeNull();
    expect(screen.getByText("93%")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy();
  });

  it("o nível de carreira da fixture continua sendo o que a tela mostra", () => {
    expect(fixtureCareerLevels.some((nivel) => nivel.id === PROXIMO_NIVEL)).toBe(true);
  });
});
