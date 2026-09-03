import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * Defeito medido no e2e depois da onda 37: registrar uma sessão para alguém
 * mostrava o aviso "Sessão com {nome} registrada" e a linha do tempo continuava
 * na OUTRA pessoa — a primeira em ordem alfabética, escolhida como padrão e
 * nunca revista. Antes da onda 37 o tech lead não tinha ficha de profissional,
 * a lista tinha uma pessoa só e o filtro acertava por acidente; o cadastro
 * unificado (ADR-0084) pôs mais gente na lista e descobriu o buraco.
 *
 * A régua: depois de salvar, a linha do tempo mostra a sessão recém-criada.
 * Quem registra não deve ter de caçar o próprio registro num filtro.
 */
const fetchMock = vi.fn();

const admin: SessionUser = {
  id: "admin-1",
  email: "admin@company.com",
  name: "Admin",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const state: AppState = { ...fixtureState, mentoringSessions: [] };

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

describe("mentoria — a linha do tempo segue a sessão recém-registrada", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state,
      user: admin,
      routes: [
        (href, init) => {
          if (href.endsWith(apiPath("/mentoring-sessions")) && init?.method === "POST") {
            const body = JSON.parse(String(init.body)) as Record<string, unknown>;
            return jsonResponse({ ...body, id: "m-nova" }, 201);
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

  it("registrar para quem NÃO é o primeiro da lista traz a linha do tempo junto", async () => {
    const [primeira, segunda] = [...state.architects]
      .sort((um, outro) => um.name.localeCompare(outro.name))
      .filter((pessoa) => pessoa.active);
    expect(primeira, "a fixture precisa de duas pessoas ativas").toBeTruthy();
    expect(segunda, "a fixture precisa de duas pessoas ativas").toBeTruthy();

    renderWithApp(<MentoringPage />);
    await screen.findByRole("combobox", { name: "Filtrar mentorado" });

    await userEvent.click(screen.getByRole("button", { name: "Registrar sessão" }));
    const dialogo = screen.getByRole("dialog", { name: "Nova sessão de mentoria" });

    await userEvent.click(within(dialogo).getByRole("combobox", { name: "Mentorado" }));
    await userEvent.click(await screen.findByRole("option", { name: segunda!.name }));

    await userEvent.type(screen.getByLabelText("Tema", { exact: true }), "Particionamento");
    await userEvent.type(screen.getByLabelText("Notas", { exact: true }), "n");
    await userEvent.type(screen.getByLabelText("Decisões", { exact: true }), "d");
    await userEvent.type(screen.getByLabelText("Ações", { exact: true }), "a");
    await userEvent.type(screen.getByLabelText("Duração (min)", { exact: true }), "45");
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    expect(await screen.findByText("Particionamento")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filtrar mentorado" }).textContent).toContain(
      segunda!.name,
    );
  });
});
