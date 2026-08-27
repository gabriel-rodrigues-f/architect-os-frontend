import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { AssessmentComment } from "@/lib/domain";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * Comentário pertence a quem escreveu — não é mais um par arquiteto+Tech Lead
 * salvo junto (ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 5). Só
 * o autor edita ou exclui a própria fala.
 */

const fetchMock = vi.fn();

const comentarioDoAdmin: AssessmentComment = {
  id: "cmt-1",
  authorUserId: fixtureAdminUser.id,
  authorRole: "TECH_LEAD",
  text: "Confirmo, liderou a execução",
  createdAt: "2026-03-05T14:30:00Z",
};

const comentarioDeOutraPessoa: AssessmentComment = {
  id: "cmt-2",
  authorUserId: "outro-usuario",
  authorRole: "PROFESSIONAL",
  text: "Conduzi a migração do cluster",
  createdAt: "2026-03-04T14:00:00Z",
};

const state: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id !== "ana-h2"
      ? a
      : {
          ...a,
          items: a.items.map((it) =>
            it.competencyId === "cloud-k8s"
              ? { ...it, comments: [comentarioDeOutraPessoa, comentarioDoAdmin] }
              : it,
          ),
        },
  ),
};

/** Assessment com a lista de comentários que a API devolveria após a escrita. */
const respostaCom = (comments: AssessmentComment[]) => {
  const base = state.assessments.find((a) => a.id === "ana-h2")!;
  return {
    ...base,
    items: base.items.map((it) => (it.competencyId === "cloud-k8s" ? { ...it, comments } : it)),
  };
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

/** Renderiza e abre o painel de notas da competência Kubernetes. */
async function abrirNotas() {
  renderWithApp(<AssessmentsPage />);
  const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
  await userEvent.click(within(linha).getByRole("button"));
}

/** O formulário de criação é a última caixa de texto do painel. */
function caixaNova() {
  const caixas = screen.getAllByPlaceholderText(
    "Evidências, feedback ou contexto sobre esta competência",
  );
  return caixas[caixas.length - 1]!;
}

describe("Avaliações — comentários por autor", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, {
      state,
      routes: [
        (href, init) => {
          const method = init?.method ?? "GET";
          if (method === "POST" && href.includes("/comments")) {
            const body = JSON.parse(String(init?.body)) as { text: string };
            return jsonResponse(
              respostaCom([
                comentarioDeOutraPessoa,
                comentarioDoAdmin,
                {
                  id: "cmt-novo",
                  authorUserId: fixtureAdminUser.id,
                  authorRole: "TECH_LEAD",
                  text: body.text,
                  createdAt: "2026-08-13T09:00:00Z",
                },
              ]),
              201,
            );
          }
          if (method === "PATCH" && href.includes("/comments/")) {
            const body = JSON.parse(String(init?.body)) as { text: string };
            return jsonResponse(
              respostaCom([
                comentarioDeOutraPessoa,
                { ...comentarioDoAdmin, text: body.text, updatedAt: "2026-08-13T10:00:00Z" },
              ]),
            );
          }
          if (method === "DELETE" && href.includes("/comments/")) {
            return jsonResponse(respostaCom([comentarioDeOutraPessoa]));
          }
          return undefined;
        },
        emptyEligibilityRoute,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra os comentários existentes com autor e data em dd/mm/aaaa", async () => {
    await abrirNotas();

    expect(await screen.findByText("Conduzi a migração do cluster")).toBeTruthy();
    expect(screen.getByText("Confirmo, liderou a execução")).toBeTruthy();
    expect(screen.getByText(/Salvo em 05\/03\/2026/)).toBeTruthy();
  });

  it("diferencia 'Você' de outra pessoa autora", async () => {
    await abrirNotas();

    // fixtureAdminUser é quem está logado — o comentário dele aparece como "Você".
    expect(await screen.findByText("Você")).toBeTruthy();
    // o outro comentário (autor diferente) aparece com o rótulo do papel.
    expect(screen.getByText("Arquiteto")).toBeTruthy();
  });

  it("bloqueia salvar sem texto", async () => {
    await abrirNotas();

    const botoesSalvar = await screen.findAllByRole("button", { name: "Salvar" });
    expect(botoesSalvar[botoesSalvar.length - 1]).toHaveProperty("disabled", true);
  });

  it("salva um novo comentário", async () => {
    await abrirNotas();
    await userEvent.type(caixaNova(), "Concluí o curso");

    const botoesSalvar = screen.getAllByRole("button", { name: "Salvar" });
    await userEvent.click(botoesSalvar[botoesSalvar.length - 1]!);

    await waitFor(() => expect(screen.getByText("Concluí o curso")).toBeTruthy());

    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(String(posts[0]?.[0])).toContain(
      apiPath("/assessments/ana-h2/items/cloud-k8s/comments"),
    );
    expect(JSON.parse(String((posts[0]?.[1] as RequestInit).body))).toEqual({
      text: "Concluí o curso",
    });
  });

  it("só mostra Editar/Excluir no próprio comentário", async () => {
    await abrirNotas();
    await screen.findByText("Confirmo, liderou a execução");

    // fixtureAdminUser é autor só de comentarioDoAdmin — um Editar/Excluir só.
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(1);
  });

  it("edita o próprio comentário", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    const caixa = screen.getByDisplayValue("Confirmo, liderou a execução");
    await userEvent.clear(caixa);
    await userEvent.type(caixa, "Revisado após conversa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.getByText("Revisado após conversa")).toBeTruthy());

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(String(patches[0]?.[0])).toContain("/comments/cmt-1");
    expect(screen.getByText(/editado em 13\/08\/2026/)).toBeTruthy();
  });

  it("exclui o próprio comentário após confirmação", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.click(dialogo.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Confirmo, liderou a execução")).toBeNull());
    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(String(deletes[0]?.[0])).toContain("/comments/cmt-1");
  });

  it("cancelar a exclusão mantém o comentário", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.click(dialogo.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Confirmo, liderou a execução")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
});
