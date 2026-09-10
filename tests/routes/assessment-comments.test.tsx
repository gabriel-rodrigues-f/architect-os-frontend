import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { AssessmentComment } from "@/lib/domain";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * Comentário pertence a quem escreveu — não é mais um par profissional+Tech Lead
 * salvo junto (ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 5). Só
 * o autor edita ou exclui a própria fala.
 *
 * 2026-09-09 — quem assina é a PESSOA, pelo nome + sobrenome, e não o cargo
 * dela: *"cargo pode mudar"* (dono). O nome chega resolvido do servidor, pela
 * PK da conta; a tela só escolhe o formato, e escolhe "Você" para o
 * comentário de quem está lendo — o atalho que ajuda a varrer a lista.
 */

const fetchMock = vi.fn();

const comentarioDoAdmin: AssessmentComment = {
  id: "cmt-1",
  authorUserId: fixtureAssignedManagerUser.id,
  authorName: "Gerente Designado da Casa",
  text: "Confirmo, liderou a execução",
  createdAt: "2026-03-05T14:30:00Z",
};

const comentarioDeOutraPessoa: AssessmentComment = {
  id: "cmt-2",
  authorUserId: "outro-usuario",
  authorName: "Marina Vasconcelos Prado",
  text: "Conduzi a migração do cluster",
  createdAt: "2026-03-04T14:00:00Z",
};

/**
 * O administrador escreve na avaliação de qualquer pessoa (regra 6) e era
 * desenhado como "Tech Lead". Hoje ele assina com o próprio nome — que é o
 * único jeito de a lista dizer QUEM falou quando duas pessoas ocupam o mesmo
 * cargo.
 */
const comentarioDoAdministrador: AssessmentComment = {
  id: "cmt-3",
  authorUserId: "conta-administradora",
  authorName: "Helena Braga",
  text: "Ajustei o portfólio a pedido do gerente",
  createdAt: "2026-03-06T09:00:00Z",
};

/**
 * O comentário que sobreviveu ao ESQUECIMENTO da pessoa: a conta foi anulada,
 * o texto ficou. A assinatura precisa de uma frase para a ausência, e ela não
 * pode dizer o cargo de volta.
 */
const comentarioSemAutor: AssessmentComment = {
  id: "cmt-4",
  authorUserId: null,
  authorName: null,
  text: "Registro antigo, de quem já saiu",
  createdAt: "2026-03-03T09:00:00Z",
};

/**
 * A avaliação de Ana na fixture da casa nasce CONCLUÍDA, e o servidor tranca a
 * concluída (`AssessmentLockedError`). Estes casos escrevem comentário, então
 * a base deles precisa de uma avaliação ainda aberta — antes de 2026-09-09 a
 * tela oferecia a caixa mesmo na trancada, e eram esses testes que sustentavam
 * o engano.
 */
const state: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id !== "ana-h2"
      ? a
      : {
          ...a,
          status: "Draft" as const,
          items: a.items.map((it) =>
            it.competencyId === "cloud-k8s"
              ? {
                  ...it,
                  comments: [
                    comentarioDeOutraPessoa,
                    comentarioDoAdmin,
                    comentarioDoAdministrador,
                    comentarioSemAutor,
                  ],
                }
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
  const caixas = screen.getAllByPlaceholderText("Feedback ou contexto sobre esta competência");
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
                comentarioDoAdministrador,
                comentarioSemAutor,
                {
                  id: "cmt-novo",
                  authorUserId: fixtureAssignedManagerUser.id,
                  authorName: "Gerente Designado da Casa",
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
                comentarioDoAdministrador,
                comentarioSemAutor,
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

    // fixtureAssignedManagerUser é quem está logado — o comentário dele aparece como "Você".
    expect(await screen.findByText("Você")).toBeTruthy();
    // o outro comentário (autor diferente) é assinado com nome + sobrenome.
    expect(screen.getByText("Marina Prado")).toBeTruthy();
  });

  it("assina com nome e sobrenome, sem os nomes do meio", async () => {
    await abrirNotas();

    const cartao = (await screen.findByText("Conduzi a migração do cluster")).parentElement!;

    expect(within(cartao).getByText("Marina Prado")).toBeTruthy();
    expect(within(cartao).queryByText("Marina Vasconcelos Prado")).toBeNull();
  });

  it("o comentário do administrador é assinado com o nome dele, e não com um cargo", async () => {
    await abrirNotas();

    const cartao = (await screen.findByText("Ajustei o portfólio a pedido do gerente"))
      .parentElement!;

    expect(within(cartao).getByText("Helena Braga")).toBeTruthy();
    expect(within(cartao).queryByText("Administrador")).toBeNull();
    expect(within(cartao).queryByText("Tech Lead")).toBeNull();
  });

  /** Autor anulado pelo esquecimento: a frase da casa para ausência, nunca o cargo. */
  it("o comentário sem autor é assinado 'alguém'", async () => {
    await abrirNotas();

    const cartao = (await screen.findByText("Registro antigo, de quem já saiu")).parentElement!;

    expect(within(cartao).getByText("alguém")).toBeTruthy();
    expect(within(cartao).queryByText("Profissional")).toBeNull();
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

    // fixtureAssignedManagerUser é autor só de comentarioDoAdmin — um Editar/Excluir só.
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
