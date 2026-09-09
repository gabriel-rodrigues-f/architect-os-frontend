import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Competency } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * O formulário de sessão depois dos pedidos do dono de 2026-09-08:
 *
 *   - item 3: "Cancelar" ao lado de "Salvar sessão", fechando o diálogo;
 *   - item 4: só TEMA e NOTAS — "Decisões" e "Ações" saíram da tela e param
 *     de viajar no pedido;
 *   - item 5: "Evolução observada" saiu inteira, com a seleção de
 *     competências dela.
 *
 * Os itens 6 e 8 do mesmo dia — o nome longo lido por inteiro e a lista
 * recortada pela régua do time — viviam DENTRO de "Competências discutidas",
 * e saíram com ela em 2026-09-09. A régua de hoje está em
 * `a-sessao-de-mentoria-tem-cinco-campos.test.tsx`.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const competencias: Competency[] = [
  { id: "cloud-k8s", name: "Kubernetes", capabilityId: "cloud", active: true },
  { id: "cloud-serverless", name: "Serverless", capabilityId: "cloud", active: true },
  { id: "security-iam", name: "IAM", capabilityId: "security", active: true },
];

const state: AppState = {
  ...fixtureState,
  competencies: competencias,
  mentoringSessions: [],
};

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

async function abrirFormulario(routes: FetchRoute[] = []) {
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
    await abrirFormulario([criacaoDeSessao]);

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
    await abrirFormulario([criacaoDeSessao]);

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
