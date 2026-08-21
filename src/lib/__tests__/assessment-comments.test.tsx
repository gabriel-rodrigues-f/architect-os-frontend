import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { AssessmentComment } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

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

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider>{children}</StoreProvider>
          </AuthReady>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * O app real só monta a árvore autenticada depois do `AuthGate` (em
 * `__root.tsx`) resolver a sessão guardada no navegador. Este teste não passa
 * por ele, então precisa do mesmo corte: sem isto, `AssessmentsPage` chamaria
 * `useCurrentUser()` no primeiro render, antes do `AuthProvider` terminar de
 * buscar `/api/auth/me`, e quebraria com "nenhuma sessão ativa".
 */
function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

/** Renderiza e abre o painel de notas da competência Kubernetes. */
async function abrirNotas() {
  render(
    <Wrapper>
      <AssessmentsPage />
    </Wrapper>,
  );
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
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";

      if (method === "POST" && href.includes("/comments")) {
        const body = JSON.parse(String(init?.body)) as { text: string };
        return Promise.resolve(
          new Response(
            JSON.stringify(
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
            ),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (method === "PATCH" && href.includes("/comments/")) {
        const body = JSON.parse(String(init?.body)) as { text: string };
        return Promise.resolve(
          new Response(
            JSON.stringify(
              respostaCom([
                comentarioDeOutraPessoa,
                { ...comentarioDoAdmin, text: body.text, updatedAt: "2026-08-13T10:00:00Z" },
              ]),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (method === "DELETE" && href.includes("/comments/")) {
        return Promise.resolve(
          new Response(JSON.stringify(respostaCom([comentarioDeOutraPessoa])), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(state), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
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
    expect(String(posts[0]?.[0])).toContain("/api/assessments/ana-h2/items/cloud-k8s/comments");
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
