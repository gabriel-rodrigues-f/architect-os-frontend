import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 37, item 1 do dono: *"quero, inclusive, que ao se criar uma capacidade,
 * já me abra um modal para em seguida criar as 3 competencias. se o usuário
 * não inserir as 3 competencias, não deve ser possível criar a capacidade."*
 *
 * A capacidade deixa de nascer vazia: "Nova capacidade" abre UM modal que
 * coleta o nome e as competências que a definem, e "Criar" chama a operação
 * atômica do backend (`POST /capabilities` com `competencies`). Não sobra
 * caminho de tela para capacidade vazia.
 *
 * O piso e o teto vêm da política de curadoria — a política deste arquivo diz
 * 4, para provar que nada na tela usa literal.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const curationPolicyMax4: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/curation-policy")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ maxActiveCompetencies: 4 })
    : undefined;

const foundationRoute: FetchRoute = (href, init) => {
  if (!href.endsWith(apiPath("/capabilities")) || init?.method !== "POST") return undefined;
  const body = JSON.parse(String(init.body)) as { name: string; short?: string };
  return jsonResponse(
    {
      id: "cap-nova",
      name: body.name,
      // O backend gera a sigla a partir do nome quando o corpo não a manda.
      short: body.short ?? "Nova",
      active: true,
      curation: { activeCompetencyCount: 3, status: "READY" },
    },
    201,
  );
};

const postedFoundation = (): Record<string, unknown> => {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith(apiPath("/capabilities")) && (init as RequestInit)?.method === "POST",
  ) as [string, RequestInit] | undefined;
  if (!call) throw new Error("nenhum POST /capabilities foi feito");
  return JSON.parse(String(call[1].body)) as Record<string, unknown>;
};

const openFoundationDialog = async () => {
  renderWithApp(<MatrixPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));
};

describe("Matriz — a capacidade nasce fundada com as suas competências", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [foundationRoute, careerLevelsRoute, curationPolicyMax4],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o modal pede o nome e as competências mínimas da política, sem campo de sigla", async () => {
    await openFoundationDialog();

    expect(screen.getByRole("heading", { name: "Nova capacidade" })).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.queryByLabelText("Sigla")).toBeNull();
    for (const posicao of [1, 2, 3]) {
      expect(screen.getByLabelText(`Competência ${posicao}`)).toBeTruthy();
    }
    expect(screen.queryByLabelText("Competência 4")).toBeNull();
  });

  it("'Criar' só habilita depois das três competências preenchidas", async () => {
    await openFoundationDialog();
    const criar = screen.getByRole("button", { name: "Criar" });

    await userEvent.type(screen.getByLabelText("Nome"), "Governança de Dados");
    expect(criar).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByLabelText("Competência 1"), "Qualidade de Dado");
    await userEvent.type(screen.getByLabelText("Competência 2"), "Catálogo de Dados");
    expect(criar).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByLabelText("Competência 3"), "Linhagem");
    expect(criar).toHaveProperty("disabled", false);
  });

  it("criar manda UM pedido atômico com a capacidade e as competências", async () => {
    await openFoundationDialog();

    await userEvent.type(screen.getByLabelText("Nome"), "Governança de Dados");
    await userEvent.type(screen.getByLabelText("Competência 1"), "Qualidade de Dado");
    await userEvent.type(screen.getByLabelText("Competência 2"), "Catálogo de Dados");
    await userEvent.type(screen.getByLabelText("Competência 3"), "Linhagem");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(postedFoundation()).toBeTruthy());
    expect(postedFoundation()).toEqual({
      name: "Governança de Dados",
      active: true,
      competencies: [
        { name: "Qualidade de Dado" },
        { name: "Catálogo de Dados" },
        { name: "Linhagem" },
      ],
    });
    expect(postedFoundation()).not.toHaveProperty("short");

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Nova capacidade" })).toBeNull(),
    );
  });

  it("'adicionar outra' vai até o teto da política e para", async () => {
    await openFoundationDialog();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar outra competência" }));
    expect(screen.getByLabelText("Competência 4")).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Adicionar outra competência" })).toBeNull();
    expect(screen.queryByLabelText("Competência 5")).toBeNull();
  });

  it("bloco extra em branco segura o envio, e removê-lo libera", async () => {
    await openFoundationDialog();

    await userEvent.type(screen.getByLabelText("Nome"), "Governança de Dados");
    await userEvent.type(screen.getByLabelText("Competência 1"), "Qualidade de Dado");
    await userEvent.type(screen.getByLabelText("Competência 2"), "Catálogo de Dados");
    await userEvent.type(screen.getByLabelText("Competência 3"), "Linhagem");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar outra competência" }));

    expect(screen.getByRole("button", { name: "Criar" })).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByRole("button", { name: "Remover competência 4" }));
    expect(screen.getByRole("button", { name: "Criar" })).toHaveProperty("disabled", false);
  });
});
