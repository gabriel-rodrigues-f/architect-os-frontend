import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Competency, MentoringSession } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono, 2026-09-09: *"registrei uma sessão de PDI e ele anotou embaixo os
 * temas que foram abordados. Não acho útil. Podemos remover este campo e,
 * consequentemente, simplificar o formulário de registro de sessão mantendo
 * somente os campos: Mentorado, Data (quero que o campo chame-se 'Data da
 * Mentoria'), Duração, Tema e Notas. Pode excluir o campo 'Próxima sessão' e
 * o campo de seleção 'Competências discutidas'."*
 *
 * São CINCO campos, nessa ordem, e o rótulo de data muda. Saem o campo de
 * próxima sessão e a seleção de competências; sai também o que a segunda
 * produzia — os chips embaixo da sessão na linha do tempo, que são o "ele
 * anotou embaixo os temas" da captura.
 *
 * O QUE NÃO SAI, e estes testes guardam: o "Agendar follow-up" da Linha do
 * Tempo, que é outra coisa — ele escreve a MESMA coluna por outro caminho
 * (PATCH sobre a sessão mais recente da pessoa), e o dono o pediu no lugar
 * onde ele está em 2026-09-08.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const competencias: Competency[] = [
  { id: "cloud-k8s", name: "Kubernetes", capabilityId: "cloud", active: true },
  { id: "cloud-serverless", name: "Serverless", capabilityId: "cloud", active: true },
  { id: "security-iam", name: "IAM", capabilityId: "security", active: true },
];

/** Uma sessão ANTIGA, das que gravaram competências antes do pedido do dono. */
const sessaoComCompetencias: MentoringSession = {
  id: "m-antiga",
  mentor: "Tech Lead do time",
  mentorUserId: fixtureAssignedTechLeadUser.id,
  menteeId: "ana",
  date: "2026-09-01",
  durationMin: 45,
  topic: "Particionamento",
  competencyIds: ["cloud-k8s", "security-iam"],
  notes: "Discutimos as chaves",
  decisions: "",
  actions: "",
};

const state: AppState = {
  ...fixtureState,
  competencies: competencias,
  mentoringSessions: [],
};

const stateComHistorico: AppState = { ...state, mentoringSessions: [sessaoComCompetencias] };

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

describe("o registro de sessão tem cinco campos, nessa ordem", () => {
  it("Mentorado, Data da Mentoria, Duração (min), Tema, Notas — e mais nenhum", async () => {
    const dialogo = await abrirFormulario();

    const rotulos = [...dialogo.querySelectorAll("label")].map((rotulo) =>
      rotulo.textContent?.trim(),
    );
    expect(rotulos).toEqual(["Mentorado", "Data da Mentoria", "Duração (min)", "Tema", "Notas"]);
  });

  it("o rótulo da data é 'Data da Mentoria', e é ele que endereça o campo", async () => {
    const dialogo = await abrirFormulario();

    const data = within(dialogo).getByLabelText("Data da Mentoria");
    expect(data.getAttribute("type")).toBe("date");
    expect(within(dialogo).queryByLabelText("Data")).toBeNull();
  });

  it("'Próxima sessão (opcional)' saiu da tela", async () => {
    const dialogo = await abrirFormulario();

    expect(within(dialogo).queryByLabelText("Próxima sessão (opcional)")).toBeNull();
    expect(within(dialogo).queryByText("Próxima sessão (opcional)")).toBeNull();
  });

  it("'Competências discutidas' saiu da tela — nem rótulo, nem lista, nem busca", async () => {
    const dialogo = await abrirFormulario();

    expect(within(dialogo).queryByText("Competências discutidas")).toBeNull();
    expect(within(dialogo).queryByRole("group", { name: "Competências discutidas" })).toBeNull();
    expect(within(dialogo).queryAllByRole("checkbox")).toEqual([]);
    expect(within(dialogo).queryByLabelText("Buscar competência")).toBeNull();
  });
});

describe("o pedido de criação leva só o que o formulário pergunta", () => {
  it("nem próxima sessão nem competências viajam no pedido", async () => {
    await abrirFormulario([criacaoDeSessao]);

    await userEvent.type(screen.getByLabelText("Tema"), "Particionamento");
    await userEvent.type(screen.getByLabelText("Notas"), "Discutimos as chaves");
    await userEvent.type(screen.getByLabelText("Duração (min)"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    await waitFor(() => expect(corpoDaCriacao()).toBeTruthy());
    const corpo = corpoDaCriacao();
    expect(corpo["topic"]).toBe("Particionamento");
    expect(corpo["notes"]).toBe("Discutimos as chaves");
    expect(corpo["durationMin"]).toBe(45);
    expect(Object.keys(corpo)).not.toContain("nextSession");
    expect(Object.keys(corpo)).not.toContain("competencyIds");
  });
});

describe("a linha do tempo não anota mais os temas embaixo da sessão", () => {
  it("uma sessão que TEM competências gravadas não desenha os chips delas", async () => {
    mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser, state: stateComHistorico });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Particionamento");
    expect(screen.queryByText("Kubernetes")).toBeNull();
    expect(screen.queryByText("IAM")).toBeNull();
  });

  it("mas o 'Agendar follow-up' da Linha do Tempo fica — ele é outra coisa", async () => {
    mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser, state: stateComHistorico });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Particionamento");
    expect(screen.getByRole("button", { name: "Agendar follow-up" })).toBeTruthy();
  });
});
