import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { careerLevelsRoute, jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Nova capacidade" troca os
 * dois inputs soltos no cabeçalho (nome + sigla + "Adicionar") por um único
 * botão que abre modal, mesmo padrão já usado por "Nova competência"
 * (CompetencyCreateDialog).
 *
 * ORIENTACAO-BLOCO-2-UX-POR-TELA — o modal parou de coletar "Sigla": pedido
 * direto da dona do produto para nunca mais digitar a sigla manualmente. O
 * backend gera `short` automaticamente a partir de `name` (com resolução de
 * colisão) quando o campo não vem no corpo — o mock de `POST
 * /api/capabilities` abaixo simula exatamente isso, devolvendo um `short`
 * mesmo quando o corpo da requisição não manda nenhum.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

describe("Matriz de Competências — criação de capacidade via modal", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) => {
          if (href.endsWith("/api/capabilities") && init?.method === "POST") {
            const body = JSON.parse(String(init.body)) as { name: string; short?: string };
            return jsonResponse(
              {
                id: "cap-nova",
                ...body,
                // Simula a geração automática do backend: o corpo não manda
                // `short`, mas a resposta sempre traz um (gerado a partir de
                // `name`, com resolução de colisão do lado do servidor).
                short: body.short ?? "Nova",
                curation: {
                  activeCompetencyCount: 0,
                  restrictiveCompetencyCount: 0,
                  nonRestrictiveCompetencyCount: 0,
                  status: "REQUIRES_CURATION",
                },
              },
              201,
            );
          }
          return undefined;
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("botão 'Nova capacidade' abre modal só com Nome — sem campo Sigla, sem inputs soltos no cabeçalho", async () => {
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));

    expect(screen.getByRole("heading", { name: "Nova capacidade" })).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.queryByLabelText("Sigla")).toBeNull();
  });

  it("criar só com Nome envia o POST SEM `short` no corpo e fecha o modal", async () => {
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Governança de Dados");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/capabilities") && (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/capabilities") && (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    const sentBody = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(sentBody).toMatchObject({ name: "Governança de Dados", active: true });
    // ORIENTACAO-BLOCO-2-UX-POR-TELA — nunca mandar `short`: é o backend
    // que gera automaticamente a partir de `name`, com resolução de
    // colisão, exatamente porque o admin não digita mais esse campo.
    expect(sentBody).not.toHaveProperty("short");

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Nova capacidade" })).toBeNull(),
    );
  });
});
