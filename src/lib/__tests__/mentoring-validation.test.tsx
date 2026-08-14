import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { setAuthToken, type SessionUser } from "../api";
import { AuthProvider } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * Todos os campos da sessão são obrigatórios. Antes, Salvar com campo vazio não
 * fazia nada — sem aviso, sem indicação do que faltava.
 */

const fetchMock = vi.fn();

/** A tela usa o usuário logado como mentor, então precisa da sessão montada. */
const usuario: SessionUser = {
  id: "u1",
  email: "gabriel@company.com",
  name: "Gabriel Rodrigues",
  role: "admin",
  architectId: null,
  createdAt: "2026-01-01T00:00:00Z",
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <StoreProvider>{children}</StoreProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

/** Renderiza e abre o diálogo de nova sessão. */
async function abrirFormulario() {
  render(
    <Wrapper>
      <MentoringPage />
    </Wrapper>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
}

const AVISO = "Preencha todos os campos obrigatórios (em vermelho)";

describe("Mentoria — campos obrigatórios", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const json = (body: unknown, status = 200) =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          }),
        );
      if (init?.method === "POST") return json({}, 201);
      if (String(url).endsWith("/api/auth/me")) return json(usuario);
      return json(fixtureState);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("salvar em branco avisa e marca os campos vazios", async () => {
    await abrirFormulario();
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    expect(await screen.findByText(AVISO)).toBeTruthy();

    // Tema, Notas, Decisões e Ações nascem vazios e ficam marcados
    for (const campo of ["Tema", "Notas", "Decisões", "Ações"]) {
      expect(screen.getByLabelText(campo).getAttribute("aria-invalid")).toBe("true");
    }
    // Mentorado e Data têm valor padrão, então não são apontados
    expect(screen.getByLabelText("Data").getAttribute("aria-invalid")).toBe("false");

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("o aviso pode ser fechado no x", async () => {
    await abrirFormulario();
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));
    await screen.findByText(AVISO);

    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));

    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull());
  });

  it("preencher um campo apagado tira a marcação dele na hora", async () => {
    await abrirFormulario();
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));
    await screen.findByText(AVISO);

    await userEvent.type(screen.getByLabelText("Tema"), "Revisão de arquitetura");

    await waitFor(() =>
      expect(screen.getByLabelText("Tema").getAttribute("aria-invalid")).toBe("false"),
    );
    // os outros continuam marcados
    expect(screen.getByLabelText("Notas").getAttribute("aria-invalid")).toBe("true");
  });

  it("com tudo preenchido, salva e fecha o diálogo", async () => {
    await abrirFormulario();

    await userEvent.type(screen.getByLabelText("Tema"), "Revisão de arquitetura");
    await userEvent.type(screen.getByLabelText("Notas"), "Discutimos o trade-off");
    await userEvent.type(screen.getByLabelText("Decisões"), "Seguir com event-driven");
    await userEvent.type(screen.getByLabelText("Ações"), "Escrever o ADR");

    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});

describe("Mentoria — ajuda dos campos", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");
    fetchMock.mockImplementation((url: string) => {
      const json = (body: unknown) =>
        Promise.resolve(
          new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
        );
      if (String(url).endsWith("/api/auth/me")) return json(usuario);
      return json(fixtureState);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  /**
   * Cada um dos quatro campos que a pessoa pediu explicação — Tema, Notas,
   * Decisões, Ações — precisa ter seu próprio botão de ajuda, e não um só
   * genérico. Mentorado e Data ficam de fora: não foram pedidos.
   */
  it("Tema, Notas, Decisões e Ações têm botão de ajuda; Mentorado e Data não", async () => {
    await abrirFormulario();

    for (const campo of ["Tema", "Notas", "Decisões", "Ações"]) {
      expect(screen.getByRole("button", { name: `O que é o campo ${campo}` })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /O que é o campo Mentorado/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /O que é o campo Data/ })).toBeNull();
  });

  it("passar o mouse no botão de ajuda mostra a explicação do campo", async () => {
    await abrirFormulario();

    await userEvent.hover(screen.getByRole("button", { name: "O que é o campo Tema" }));

    expect(
      await screen.findByText(
        "O assunto técnico central da sessão — a competência ou o problema que motivou o encontro. Aparece como título na linha do tempo.",
      ),
    ).toBeTruthy();
  });
});
