import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 12 e 13 — "somente
 * leitura" precisa ser testado contra o componente real, porque foi
 * exatamente um teste que reimplementava a regra em vez de renderizar a
 * tela que deixou passar um slider editável disfarçado de somente leitura.
 * Estes testes renderizam LearningPage de verdade.
 */

const fetchMock = vi.fn();

const state: AppState = {
  ...fixtureState,
  learningPaths: [
    {
      id: "lp-dupla",
      name: "Trilha com duas pessoas",
      description: "",
      competencyIds: [],
      assignedTo: ["ana", "bruno"],
      items: [{ id: "item-1", title: "Curso X", type: "Curso", hours: 4 }],
      progress: [
        { architectId: "ana", itemId: "item-1", status: "In Progress", progress: 40 },
        { architectId: "bruno", itemId: "item-1", status: "Not Started", progress: 0 },
      ],
      createdBy: null,
    },
  ],
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const LearningPage = LearningRoute.options.component as () => ReactNode;

function mockSession(user: typeof fixtureAdminUser | typeof fixtureMemberUser) {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(user), {
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
}

describe("Trilhas — progresso é por pessoa, não somente leitura disfarçado", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member vê a própria linha editável e a de outra pessoa só leitura", async () => {
    mockSession(fixtureMemberUser); // Ana Martins, architectId "ana"
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    // REVISAO-360-FRONTEND, Seção 34 — a trilha nasce recolhida; os itens só aparecem depois de expandir.
    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByLabelText("Expandir Trilha com duas pessoas"));
    await screen.findByText("Curso X");
    const sliders = screen.getAllByRole("slider");
    // Só a linha da Ana (dona da sessão) tem slider — a do Bruno é só leitura.
    expect(sliders).toHaveLength(1);
    expect(sliders[0]?.getAttribute("aria-label")).toContain("Ana Martins");
  });

  it("mover o próprio slider registra progresso só para essa pessoa, não para a trilha inteira", async () => {
    mockSession(fixtureMemberUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByLabelText("Expandir Trilha com duas pessoas"));
    await screen.findByText("Curso X");
    // B-33 — o PATCH só sai ao soltar o arrasto (`onMouseUp`), não a cada
    // passo do `onChange` (contínuo durante o drag; ver `ProgressControl`).
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.mouseUp(slider);

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(String(patches[0]?.[0])).toContain("/api/learning-paths/lp-dupla/progress/ana/item-1");
  });

  /**
   * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.4) — antes,
   * cada passo do arrasto (`onChange`, contínuo, não só no soltar) disparava
   * um PATCH de rede. Simula 3 passos de arrasto sem soltar: nenhum PATCH
   * ainda deve ter saído.
   */
  it("mover o slider sem soltar não dispara nenhum PATCH (evita flooding no arrasto)", async () => {
    mockSession(fixtureMemberUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByLabelText("Expandir Trilha com duas pessoas"));
    await screen.findByText("Curso X");

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "20" } });
    fireEvent.change(slider, { target: { value: "40" } });
    fireEvent.change(slider, { target: { value: "60" } });

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(0);

    fireEvent.mouseUp(slider);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  });

  it("admin vê as duas linhas editáveis", async () => {
    mockSession(fixtureAdminUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByLabelText("Expandir Trilha com duas pessoas"));
    await screen.findByText("Curso X");
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  /**
   * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.4) — título
   * de item mandava o array `items` inteiro por tecla digitada. Digitar 3
   * caracteres sem sair do campo não deve disparar PATCH nenhum; só o blur
   * commita (`LearningPathItemRow`).
   */
  it("editar o título de um item só manda PATCH ao sair do campo (blur), não por tecla", async () => {
    mockSession(fixtureAdminUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    const titleInput = await screen.findByLabelText("Título de Curso X");
    fireEvent.change(titleInput, { target: { value: "Curso X revisado" } });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    fireEvent.blur(titleInput);
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    const body = JSON.parse(String(patches[0]?.[1]?.body));
    expect(body.items[0].title).toBe("Curso X revisado");
  });

  /**
   * EPIC 4 (quarta rodada) — catálogo é curadoria de Lead/Admin, não
   * autoatendimento: um membro comum não vê o campo de criar trilha nova.
   * Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md.
   */
  it("membro comum não vê o campo de criar trilha nova", async () => {
    mockSession(fixtureMemberUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    expect(screen.queryByPlaceholderText("Nova trilha")).toBeNull();
  });

  it("admin vê o campo de criar trilha nova", async () => {
    mockSession(fixtureAdminUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Trilha com duas pessoas");
    expect(screen.getByPlaceholderText("Nova trilha")).toBeTruthy();
  });
});
