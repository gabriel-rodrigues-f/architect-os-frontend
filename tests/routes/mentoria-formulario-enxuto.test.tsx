import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Competency } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * O formulário de sessão depois dos pedidos do dono de 2026-09-08:
 *
 *   - item 3: "Cancelar" ao lado de "Salvar sessão", fechando o diálogo;
 *   - item 4: só TEMA e NOTAS — "Decisões" e "Ações" saíram da tela e param
 *     de viajar no pedido;
 *   - item 5: "Evolução observada" saiu inteira, com a seleção de
 *     competências dela;
 *   - item 6: o nome longo em "Competências discutidas" se lê por inteiro no
 *     ponteiro e pelo teclado;
 *   - item 8: "Competências discutidas" lista só a régua do time da pessoa.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const NOME_LONGO =
  "Observabilidade distribuída de ponta a ponta em malha de serviços com orçamento de erro";

const competencias: Competency[] = [
  { id: "cloud-k8s", name: NOME_LONGO, capabilityId: "cloud", active: true },
  { id: "cloud-serverless", name: "Serverless", capabilityId: "cloud", active: true },
  { id: "security-iam", name: "IAM", capabilityId: "security", active: true },
];

/** A pessoa mentorada tem time E nível de carreira: existe régua a consultar. */
const NIVEL_DA_ANA = "arquiteto-de-solucoes-ii";

const state: AppState = {
  ...fixtureState,
  competencies: competencias,
  professionals: fixtureState.professionals.map((pessoa) =>
    pessoa.id === "ana" ? { ...pessoa, careerLevelId: NIVEL_DA_ANA } : pessoa,
  ),
  mentoringSessions: [],
};

/** A régua do time da Ana cobra UMA competência do catálogo. */
const reguaDoTime: FetchRoute = (href) =>
  new URL(href, "http://localhost").pathname.endsWith(
    apiPath(`/teams/${fixtureTeamId}/rules/${NIVEL_DA_ANA}`),
  )
    ? jsonResponse({
        id: "regra-plataforma-ii",
        teamId: fixtureTeamId,
        careerLevelId: NIVEL_DA_ANA,
        minimumQualifiedCapabilities: 3,
        capabilityIds: ["cloud"],
        competencies: [{ competencyId: "cloud-k8s", requiredLevel: 3 }],
      })
    : undefined;

const criacaoDeSessao: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/mentoring-sessions")) && init?.method === "POST"
    ? jsonResponse({ ...(JSON.parse(String(init.body)) as object), id: "m-nova" }, 201)
    : undefined;

const corpoDaCriacao = (): Record<string, unknown> => {
  const chamada = fetchMock.mock.calls.find(
    ([href, init]) =>
      String(href).endsWith(apiPath("/mentoring-sessions")) &&
      (init as RequestInit | undefined)?.method === "POST",
  ) as [string, RequestInit];
  return JSON.parse(String(chamada[1].body)) as Record<string, unknown>;
};

async function abrirFormulario(routes: FetchRoute[] = [reguaDoTime]) {
  mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser, state, routes });
  renderWithApp(<MentoringPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
  return screen.getByRole("dialog", { name: "Nova sessão de mentoria" });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o formulário de sessão pergunta Tema e Notas (item 4)", () => {
  it("não há mais campo de Decisões nem de Ações na tela", async () => {
    const dialogo = await abrirFormulario();

    expect(within(dialogo).getByLabelText("Tema")).toBeTruthy();
    expect(within(dialogo).getByLabelText("Notas")).toBeTruthy();
    expect(within(dialogo).queryByLabelText("Decisões")).toBeNull();
    expect(within(dialogo).queryByLabelText("Ações")).toBeNull();
  });

  it("o pedido de criação não leva decisões nem ações", async () => {
    await abrirFormulario([reguaDoTime, criacaoDeSessao]);

    await userEvent.type(screen.getByLabelText("Tema"), "Particionamento");
    await userEvent.type(screen.getByLabelText("Notas"), "Discutimos as chaves");
    await userEvent.type(screen.getByLabelText("Duração (min)"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    await waitFor(() => expect(corpoDaCriacao()).toBeTruthy());
    const corpo = corpoDaCriacao();
    expect(corpo["topic"]).toBe("Particionamento");
    expect(corpo["notes"]).toBe("Discutimos as chaves");
    expect(Object.keys(corpo)).not.toContain("decisions");
    expect(Object.keys(corpo)).not.toContain("actions");
    expect(Object.keys(corpo)).not.toContain("proficiencyUpdates");
  });
});

describe("'Evolução observada' saiu inteira (item 5)", () => {
  it("nem o rótulo nem a seleção de competências dela aparecem para quem lidera o time", async () => {
    const dialogo = await abrirFormulario();

    expect(within(dialogo).queryByText("Evolução observada")).toBeNull();
    expect(within(dialogo).queryByRole("group", { name: "Evolução observada" })).toBeNull();
    expect(screen.queryByText("Selecione o nível…")).toBeNull();
  });
});

describe("'Cancelar' fecha o diálogo (item 3)", () => {
  it("fica ao lado de 'Salvar sessão' e fecha sem escrever nada", async () => {
    await abrirFormulario([reguaDoTime, criacaoDeSessao]);

    await userEvent.type(screen.getByLabelText("Tema"), "Particionamento");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Nova sessão de mentoria" })).toBeNull(),
    );
    expect(
      fetchMock.mock.calls.some(
        ([href, init]) =>
          String(href).endsWith(apiPath("/mentoring-sessions")) &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });
});

describe("'Competências discutidas' é a régua do time da pessoa (item 8)", () => {
  it("lista só o que a régua do time dela cobra, não o catálogo inteiro", async () => {
    const dialogo = await abrirFormulario();
    const lista = within(dialogo).getByRole("group", { name: "Competências discutidas" });

    await waitFor(() => expect(within(lista).queryByText(NOME_LONGO)).toBeTruthy());
    expect(within(lista).queryByText("Serverless")).toBeNull();
    expect(within(lista).queryByText("IAM")).toBeNull();
  });

  it("trocar de mentorado troca a régua — e esquece o que estava marcado na anterior", async () => {
    const dialogo = await abrirFormulario();
    const lista = within(dialogo).getByRole("group", { name: "Competências discutidas" });
    await waitFor(() => expect(within(lista).queryByText(NOME_LONGO)).toBeTruthy());

    const caixa = within(lista).getAllByRole("checkbox")[0]!;
    await userEvent.click(caixa);
    expect((caixa as HTMLInputElement).checked).toBe(true);

    await userEvent.click(within(dialogo).getByRole("combobox", { name: "Mentorado" }));
    await userEvent.click(await screen.findByRole("option", { name: "Bruno Almeida" }));

    // Bruno não tem nível de carreira na fixture: sem régua a consultar, o
    // catálogo ativo é a lista — e nada continua marcado.
    await waitFor(() => expect(within(lista).queryByText("Serverless")).toBeTruthy());
    for (const marcada of within(lista).getAllByRole("checkbox")) {
      expect((marcada as HTMLInputElement).checked).toBe(false);
    }
  });

  it("sem régua definida para o time da pessoa, o catálogo ativo continua sendo a lista", async () => {
    const semRegua: FetchRoute = (href) =>
      new URL(href, "http://localhost").pathname.includes("/rules/")
        ? jsonResponse({ message: "Sem régua" }, 404)
        : undefined;
    const dialogo = await abrirFormulario([semRegua]);
    const lista = within(dialogo).getByRole("group", { name: "Competências discutidas" });

    await waitFor(() => expect(within(lista).queryByText("Serverless")).toBeTruthy());
    expect(within(lista).getByText("IAM")).toBeTruthy();
  });
});

describe("o nome longo se lê por inteiro (item 6)", () => {
  it("o ponteiro sobre o nome abre o texto completo", async () => {
    const dialogo = await abrirFormulario();
    const lista = within(dialogo).getByRole("group", { name: "Competências discutidas" });
    await waitFor(() => expect(within(lista).queryByText(NOME_LONGO)).toBeTruthy());

    await userEvent.hover(within(lista).getByText(NOME_LONGO));

    const dica = await screen.findByRole("tooltip");
    expect(dica.textContent).toBe(NOME_LONGO);
  });

  it("o teclado alcança o nome — a dica não depende do mouse", async () => {
    const dialogo = await abrirFormulario();
    const lista = within(dialogo).getByRole("group", { name: "Competências discutidas" });
    await waitFor(() => expect(within(lista).queryByText(NOME_LONGO)).toBeTruthy());

    const nome = within(lista).getByText(NOME_LONGO);
    expect(nome.getAttribute("tabindex")).toBe("0");

    nome.focus();
    expect(document.activeElement).toBe(nome);
    const dica = await screen.findByRole("tooltip");
    expect(dica.textContent).toBe(NOME_LONGO);
  });
});
