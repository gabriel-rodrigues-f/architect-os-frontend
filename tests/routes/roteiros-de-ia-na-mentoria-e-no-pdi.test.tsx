import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { Route as PlansRoute } from "@/routes/development-plans";
import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * Pedido do dono (2026-09-07), literal: *"Em Talentos do Time > Gerar roteiro
 * de 1:1 e Gerar roteiro de PDI: estas duas opções não deveriam estar nessa
 * página. Cada uma deveria fazer parte do seu respectivo menu, Plano
 * Individual de Desenvolvimento (PDI) e Mentoria e 1:1. Migre estes menus
 * para suas respectivas telas e remova totalmente geração com IA de
 * 'Talentos do Time'."* — e, no mesmo dia: *"Roteiro de 1:1 Sugerido pode
 * sumir. vamos consolidar seu conteúdo em Preparação do 1:1"*.
 *
 * Três invariantes, um por tela:
 *
 *  1. a ficha (Visão geral de Talentos do Time) não tem NENHUM botão de IA —
 *     nem roteiro, nem "sugerir item de PDI", nem "verificar sinais", nem
 *     apoio à revisão — para gerente e para tech lead;
 *  2. o PDI oferece SÓ o roteiro de PDI — a "Preparação do 1:1" da Mentoria
 *     saiu do produto em 2026-09-09, e a ausência dela é medida em
 *     `a-ia-sai-da-mentoria.test.tsx`;
 *  3. o profissional não vê geração de IA.
 *
 * E a regra 19 do pedido anterior continua valendo no novo endereço: perfil
 * Moderado por padrão, o perfil viaja, sem chamada duplicada, provedor no
 * chão não leva os fatos junto, erro vira frase com "tentar novamente".
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const PlansPage = PlansRoute.options.component as () => ReactNode;

const BOTOES_DE_IA = [
  /Gerar roteiro de 1:1/,
  /Gerar roteiro de PDI/,
  /Verificar sinais/,
  /Sugerir item de PDI/,
  /Ler apoio à revisão/,
  /Preparar o 1:1/,
];

const conselho = {
  subject: "preparação do 1:1 com Ana Martins",
  suggestion: true,
  notice: "Isto é uma sugestão gerada por inteligência artificial. Quem decide é você.",
  facts: ["Distância 2 em Domain Modeling", "Última 1:1 há 40 dias"],
  absences: ["learningPath"],
  narration: "Comece perguntando o que travou o item de PDI em aberto.",
  narrationUnavailable: null,
  profile: "moderate",
};

const roteiroDePdi = {
  ...conselho,
  subject: "roteiro da conversa de construção do PDI desta pessoa",
  outline: ["Distâncias a discutir", "Prioridade sugerida", "Acompanhamento"],
};

const rotaDe =
  (recurso: string, responder: (url: URL) => Response): FetchRoute =>
  (href) => {
    const url = new URL(href, "http://localhost");
    return url.pathname.endsWith(apiPath(`/professionals/ana/${recurso}`))
      ? responder(url)
      : undefined;
  };

const urlsDe = (recurso: string): URL[] =>
  fetchMock.mock.calls
    .map((chamada) => new URL(String(chamada[0]), "http://localhost"))
    .filter((url) => url.pathname.endsWith(apiPath(`/professionals/ana/${recurso}`)));

const montaFicha = (user: SessionUser, routes: FetchRoute[] = []) => {
  mockAppFetch(fetchMock, { user, routes });
  return renderCareerFile(<ProfilePage />);
};

const monta = (Page: () => ReactNode, user: SessionUser, routes: FetchRoute[] = []) => {
  mockAppFetch(fetchMock, { user, routes });
  return renderWithApp(<Page />);
};

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  window.history.pushState({}, "", "?professionalId=ana");
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
    montaFicha(user);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Perfil por capacidade")).toBeTruthy();
    for (const botao of BOTOES_DE_IA) {
      expect(screen.queryByRole("button", { name: botao }), String(botao)).toBeNull();
    }
  });
});

/*
 * AQUI MORAVA "Mentoria e 1:1 — um cartão de IA só: a Preparação do 1:1", o
 * bloco inteiro da IA daquela tela.
 *
 * Ele saiu em 2026-09-09: *"Em Mentoria e 1:1, pode remover a parte da IA, não
 * é útil. Mantenha somente o bloco Linha do Tempo."* A ausência da IA naquela
 * tela é medida agora por um arquivo próprio,
 * `tests/routes/a-ia-sai-da-mentoria.test.tsx`, que responde a preparação
 * inteira no `fetch` e ainda assim não encontra o botão — é a diferença entre
 * "o bloco não existe" e "o bloco não achou o que desenhar".
 *
 * O que este arquivo continua medindo: a ficha de Talentos do Time sem IA
 * nenhuma (acima) e o roteiro de PDI no PDI (abaixo). A régua da regra 19 —
 * perfil Moderado por padrão, o perfil viaja, sem chamada duplicada, provedor
 * no chão não leva os fatos junto, erro vira frase com "tentar novamente" —
 * está medida no bloco do PDI e em `texto-de-gente-nao-vira-fato.test.tsx`.
 */

describe("PDI — só o roteiro de PDI", () => {
  it("mostra 'Gerar roteiro de PDI' e não 'Gerar roteiro de 1:1'", async () => {
    monta(PlansPage, fixtureAssignedManagerUser);

    expect(await screen.findByRole("button", { name: /Gerar roteiro de PDI/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro de 1:1/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Preparar o 1:1/ })).toBeNull();
    expect(screen.getByLabelText(/Perfil de geração/)).toBeTruthy();
  });

  it("gerar leva só o perfil padrão — sem pauta, que morreu com o roteiro de 1:1 — e mostra a sugestão", async () => {
    monta(PlansPage, fixtureAssignedManagerUser, [
      rotaDe("session-script", () => jsonResponse(roteiroDePdi)),
    ]);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Gerar roteiro de PDI/ }));

    await waitFor(() => expect(urlsDe("session-script").length).toBe(1));
    const url = urlsDe("session-script")[0]!;
    expect(url.searchParams.has("agenda")).toBe(false);
    expect(url.searchParams.get("profile")).toBe("moderate");

    expect(await screen.findByText(/Comece perguntando/)).toBeTruthy();
    expect(screen.getByText(/Distâncias a discutir/)).toBeTruthy();
    expect(screen.getByText(/Quem decide é você/)).toBeTruthy();
  });

  it("o profissional não vê geração de IA", async () => {
    monta(PlansPage, fixtureMemberUser);
    expect(await screen.findByText("Evoluir IAM")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gerar roteiro/ })).toBeNull();
    expect(screen.queryByLabelText(/Perfil de geração/)).toBeNull();
  });
});
