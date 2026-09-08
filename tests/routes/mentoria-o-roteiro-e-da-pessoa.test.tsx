import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { apiPath } from "@/lib/api-path";
import { fixtureAssignedManagerUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * BUG do dono (2026-09-08), item 9: *"o relatório de IA fica preso: ao trocar
 * a pessoa selecionada, o roteiro gerado continua na tela"*.
 *
 * A preparação é DE UMA PESSOA. Trocar de pessoa esquece o que era da
 * anterior — e não pede nada em nome da nova: quem decide gastar uma chamada
 * do provedor é quem clica.
 *
 * O vermelho: o pedido ficava guardado no componente (o perfil escolhido),
 * então trocar de pessoa refazia a consulta sozinho, com a barra de progresso
 * na tela e uma sugestão que ninguém pediu no lugar da anterior.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const preparacaoDe = (nome: string) => ({
  subject: `preparação do 1:1 com ${nome}`,
  suggestion: true,
  notice: "Isto é uma sugestão gerada por inteligência artificial. Quem decide é você.",
  facts: [`Distância 2 em Domain Modeling — ${nome}`],
  absences: [],
  narration: `Comece perguntando a ${nome} o que travou o item de PDI.`,
  narrationUnavailable: null,
  profile: "moderate",
  scriptProvenance: "selo-opaco",
});

const NOME_POR_ID: Record<string, string> = { ana: "Ana Martins", bruno: "Bruno Almeida" };

const preparacaoRoute: FetchRoute = (href) => {
  const { pathname } = new URL(href, "http://localhost");
  const dono = Object.keys(NOME_POR_ID).find((id) =>
    pathname.endsWith(apiPath(`/professionals/${id}/one-on-one-preparation`)),
  );
  return dono ? jsonResponse(preparacaoDe(NOME_POR_ID[dono]!)) : undefined;
};

const preparacoesPedidas = (): string[] =>
  fetchMock.mock.calls
    .map((chamada) => new URL(String(chamada[0]), "http://localhost").pathname)
    .filter((pathname) => pathname.includes("one-on-one-preparation"));

async function trocarPara(nome: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Filtrar mentorado" }));
  await userEvent.click(await screen.findByText(nome));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    routes: [preparacaoRoute],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a preparação do 1:1 é da pessoa selecionada", () => {
  it("trocar de pessoa limpa o que era da anterior e não pede nada em nome da nova", async () => {
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Preparar o 1:1/ }));
    expect(await screen.findByText(/Comece perguntando a Ana Martins/)).toBeTruthy();

    await trocarPara("Bruno Almeida");

    expect(screen.queryByText(/Comece perguntando a Ana Martins/)).toBeNull();
    expect(screen.queryByTestId("ai-progress")).toBeNull();
    expect(preparacoesPedidas()).toEqual([apiPath("/professionals/ana/one-on-one-preparation")]);
    expect(screen.getByRole("button", { name: /Preparar o 1:1/ })).toBeTruthy();
  });

  it("depois de trocar, gerar de novo traz a preparação da pessoa nova", async () => {
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Preparar o 1:1/ }));
    await screen.findByText(/Comece perguntando a Ana Martins/);

    await trocarPara("Bruno Almeida");
    await userEvent.click(screen.getByRole("button", { name: /Preparar o 1:1/ }));

    expect(await screen.findByText(/Comece perguntando a Bruno Almeida/)).toBeTruthy();
    await waitFor(() =>
      expect(preparacoesPedidas()).toEqual([
        apiPath("/professionals/ana/one-on-one-preparation"),
        apiPath("/professionals/bruno/one-on-one-preparation"),
      ]),
    );
  });

  it("voltar para a pessoa anterior não ressuscita a sugestão dela sem pedido", async () => {
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Preparar o 1:1/ }));
    await screen.findByText(/Comece perguntando a Ana Martins/);

    await trocarPara("Bruno Almeida");
    await trocarPara("Ana Martins");

    expect(screen.queryByText(/Comece perguntando a Ana Martins/)).toBeNull();
    expect(screen.getByRole("button", { name: /Preparar o 1:1/ })).toBeTruthy();
  });
});
