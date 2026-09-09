import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type SessionUser } from "@/lib/api";
import { fixtureTeamId } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Todos os campos da sessão são obrigatórios. Antes, Salvar com campo vazio não
 * fazia nada — sem aviso, sem indicação do que faltava.
 */

const fetchMock = vi.fn();

/**
 * A tela usa o usuário logado como mentor, então precisa da sessão montada.
 * Revisão de papéis (dono, 2026-09-05): quem registra sessão é quem lidera
 * por vínculo — o admin não mentora (D1); o ator é um tech lead vinculado.
 */
const usuario: SessionUser = {
  id: "u1",
  email: "gabriel@company.com",
  name: "Gabriel Rodrigues",
  role: "tech_lead",
  professionalId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: fixtureTeamId, role: "tech_lead" }],
};

/**
 * OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`).
 * O Wrapper local não tinha o corte `AuthReady`; o do helper apenas atrasa a
 * montagem até `/api/v1/auth/me` resolver — as asserções já esperam via `findBy*`.
 */

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

/** Renderiza e abre o diálogo de nova sessão. */
async function abrirFormulario() {
  renderWithApp(<MentoringPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
}

const AVISO = "Preencha todos os campos obrigatórios (em vermelho)";

describe("Mentoria — campos obrigatórios", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: usuario,
      routes: [
        (_href, init) =>
          init?.method === "POST"
            ? jsonResponse(
                {
                  id: "sessao-nova",
                  mentor: usuario.name,
                  mentorUserId: usuario.id,
                  menteeId: "ana",
                  date: "2026-01-01",
                  durationMin: 45,
                  topic: "Revisão de arquitetura",
                  notes: "Discutimos o trade-off",
                },
                201,
              )
            : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("salvar em branco avisa e marca os campos vazios", async () => {
    await abrirFormulario();
    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    expect(await screen.findByText(AVISO)).toBeTruthy();

    // Tema, Notas e Duração nascem vazios e ficam marcados
    for (const campo of ["Tema", "Notas", "Duração (min)"]) {
      expect(screen.getByLabelText(campo).getAttribute("aria-invalid")).toBe("true");
    }
    // Mentorado e Data da Mentoria têm valor padrão, então não são apontados
    expect(screen.getByLabelText("Data da Mentoria").getAttribute("aria-invalid")).toBe("false");

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
    await userEvent.type(screen.getByLabelText("Duração (min)"), "45");

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
    mockAppFetch(fetchMock, { user: usuario });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * Cada campo que a pessoa pediu explicação precisa ter seu próprio botão de
   * ajuda, e não um só genérico. Mentorado e Data ficam de fora: não foram
   * pedidos. "Decisões" e "Ações" saíram do formulário (dono, 2026-09-08,
   * item 4) e levaram a ajuda delas junto.
   */
  it("Tema e Notas têm botão de ajuda; Mentorado e Data não", async () => {
    await abrirFormulario();

    for (const campo of ["Tema", "Notas"]) {
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
