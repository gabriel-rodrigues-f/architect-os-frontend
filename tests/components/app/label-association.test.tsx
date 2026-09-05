import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo dos demais testes de AppShell: `<Link>`/`useRouterState` exigem `RouterProvider` real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import { NewMentoringSessionDialog } from "@/components/app/mentoring-shared";
import { ThemeProvider } from "@/lib/theme";
import { fixtureMemberUser, fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";
import { type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";

/** As fatias que a rota /mentoring pede — os diálogos de mentoria leem seletores e sessões. */
const MENTORING_CONTEXTS: readonly ContextScopeRequest[] = [
  ...SELECTOR_CONTEXTS,
  "mentoringSessions",
];

/**
 * QA-04 (onda 5) — `<label for="x">` só rotula elemento ROTULÁVEL (button,
 * input, meter, output, progress, select, textarea). Apontando para uma `div`
 * ou um `span`, o navegador não cria associação nenhuma: o rótulo vira texto
 * solto, o controle/grupo fica sem nome acessível e clicar no rótulo não move
 * o foco. É um defeito silencioso — na tela parece certo, e nenhum teste de
 * conteúdo pega.
 *
 * Dois pontos da fatia caíam nisso, por isso a verificação virou um auxiliar
 * único em vez de duas asserções ad-hoc (regra da casa: 2+ ocorrências).
 */
const ROTULAVEIS = new Set([
  "BUTTON",
  "INPUT",
  "METER",
  "OUTPUT",
  "PROGRESS",
  "SELECT",
  "TEXTAREA",
]);

function rotulosOrfaos(): string[] {
  return [...document.querySelectorAll("label[for]")]
    .map((label) => {
      const alvoId = label.getAttribute("for") ?? "";
      const alvo = document.getElementById(alvoId);
      if (!alvo) return `for="${alvoId}" (nenhum elemento com esse id)`;
      if (!ROTULAVEIS.has(alvo.tagName))
        return `for="${alvoId}" (aponta para <${alvo.tagName.toLowerCase()}>)`;
      return null;
    })
    .filter((problema): problema is string => problema !== null);
}

const fetchMock = vi.fn();

describe("rótulos apontam para elementos rotuláveis (QA-04)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("AppShell: o ciclo em modo leitura (não-admin) não deixa rótulo órfão no cabeçalho", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser });
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
      { contexts: MENTORING_CONTEXTS },
    );

    await screen.findByText("conteúdo");
    expect(rotulosOrfaos()).toEqual([]);
  });

  it("AppShell: o ciclo continua nomeado para quem enxerga o valor em leitura", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser });
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
      { contexts: MENTORING_CONTEXTS },
    );

    await screen.findByText("conteúdo");
    // O rótulo "Ciclo" segue visível ao lado do valor — a correção tira a
    // associação falsa, não o rótulo.
    expect(screen.getByText("Ciclo")).toBeTruthy();
  });

  it("mentoria: as listas de competências do formulário não deixam rótulo órfão", async () => {
    mockAppFetch(fetchMock);
    const user = userEvent.setup();
    renderWithApp(<NewMentoringSessionDialog menteeOptions={[...fixtureState.architects]} />, {
      contexts: MENTORING_CONTEXTS,
    });

    await user.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByRole("dialog");

    expect(rotulosOrfaos()).toEqual([]);
  });

  it("mentoria: a lista de competências discutidas tem nome acessível de grupo", async () => {
    mockAppFetch(fetchMock);
    const user = userEvent.setup();
    renderWithApp(<NewMentoringSessionDialog menteeOptions={[...fixtureState.architects]} />, {
      contexts: MENTORING_CONTEXTS,
    });

    await user.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByRole("dialog");

    expect(screen.getByRole("group", { name: "Competências discutidas" })).toBeTruthy();
  });
});
