import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { setAuthToken, type AppState } from "../api";
import type { AssessmentComment } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * Comentário é um par: nota do arquiteto + resposta do Tech Lead, salvos juntos
 * e só quando os dois lados estão preenchidos. Dá para editar e excluir o par.
 */

const fetchMock = vi.fn();

const parExistente: AssessmentComment = {
  id: "cmt-1",
  architectText: "Conduzi a migração do cluster",
  techLeadText: "Confirmo, liderou a execução",
  createdAt: "2026-03-05T14:30:00Z",
};

const state: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id !== "ana-h2"
      ? a
      : {
          ...a,
          items: a.items.map((it) =>
            it.competencyId === "cloud-k8s" ? { ...it, comments: [parExistente] } : it,
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
        <StoreProvider>{children}</StoreProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
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

/** O formulário de criação é o último par de caixas do painel. */
function formularioNovo() {
  const caixas = screen.getAllByLabelText("Comentário do arquiteto");
  const arquiteto = caixas[caixas.length - 1]!;
  const techLeads = screen.getAllByLabelText("Comentário do Tech Lead");
  return { arquiteto, techLead: techLeads[techLeads.length - 1]! };
}

describe("Avaliações — comentários pareados", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";

      if (method === "POST" && href.includes("/comments")) {
        const body = JSON.parse(String(init?.body)) as AssessmentComment;
        return Promise.resolve(
          new Response(
            JSON.stringify(
              respostaCom([
                parExistente,
                { ...body, id: "cmt-novo", createdAt: "2026-08-13T09:00:00Z" },
              ]),
            ),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (method === "PATCH" && href.includes("/comments/")) {
        const body = JSON.parse(String(init?.body)) as AssessmentComment;
        return Promise.resolve(
          new Response(
            JSON.stringify(
              respostaCom([
                {
                  ...parExistente,
                  ...body,
                  updatedAt: "2026-08-13T10:00:00Z",
                },
              ]),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (method === "DELETE" && href.includes("/comments/")) {
        return Promise.resolve(
          new Response(JSON.stringify(respostaCom([])), {
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

  it("mostra o par salvo com a data em dd/mm/aaaa", async () => {
    await abrirNotas();

    expect(await screen.findByText("Conduzi a migração do cluster")).toBeTruthy();
    expect(screen.getByText("Confirmo, liderou a execução")).toBeTruthy();
    expect(screen.getByText(/Salvo em 05\/03\/2026/)).toBeTruthy();
  });

  it("com os dois campos vazios, orienta a preencher ambos e bloqueia o Salvar", async () => {
    await abrirNotas();

    expect(
      await screen.findByText(
        "Preencha os dois comentários — do arquiteto e do Tech Lead — para salvar.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("com só o do arquiteto preenchido, diz que falta o do Tech Lead", async () => {
    await abrirNotas();
    await userEvent.type(formularioNovo().arquiteto, "Só um lado");

    expect(
      await screen.findByText(
        "Falta o comentário do Tech Lead. O par só é salvo com os dois lados preenchidos.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("com só o do Tech Lead preenchido, diz que falta o do arquiteto", async () => {
    await abrirNotas();
    await userEvent.type(formularioNovo().techLead, "Só um lado");

    expect(
      await screen.findByText(
        "Falta o comentário do arquiteto. O par só é salvo com os dois lados preenchidos.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("com os dois preenchidos, salva o par numa única requisição", async () => {
    await abrirNotas();
    const { arquiteto, techLead } = formularioNovo();
    await userEvent.type(arquiteto, "Concluí o curso");
    await userEvent.type(techLead, "Evoluiu bem no semestre");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Concluí o curso")).toBeTruthy());
    expect(screen.getByText("Evoluiu bem no semestre")).toBeTruthy();

    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(String(posts[0]?.[0])).toContain("/api/assessments/ana-h2/items/cloud-k8s/comments");
    expect(JSON.parse(String((posts[0]?.[1] as RequestInit).body))).toEqual({
      architectText: "Concluí o curso",
      techLeadText: "Evoluiu bem no semestre",
    });
  });

  it("edita um par existente", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    const caixa = screen.getAllByLabelText("Comentário do Tech Lead")[0]!;
    await userEvent.clear(caixa);
    await userEvent.type(caixa, "Revisado após conversa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.getByText("Revisado após conversa")).toBeTruthy());

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(String(patches[0]?.[0])).toContain("/comments/cmt-1");
    expect(screen.getByText(/editado em 13\/08\/2026/)).toBeTruthy();
  });

  it("exclui um par após confirmação", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    // confirma no diálogo
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.click(dialogo.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Conduzi a migração do cluster")).toBeNull());
    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(String(deletes[0]?.[0])).toContain("/comments/cmt-1");
  });

  it("cancelar a exclusão mantém o par", async () => {
    await abrirNotas();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.click(dialogo.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Conduzi a migração do cluster")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
});
