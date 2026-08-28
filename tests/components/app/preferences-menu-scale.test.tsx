import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de app-shell-cycle-locale.test.tsx: `<Link>` e `useRouterState` exigem router real. */
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
import { spacing } from "@/lib/design/scale";
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * UI-03 — o painel de Preferências (Tema e Idioma) é o único popover com
 * conteúdo próprio que estreita a largura do `PopoverContent` e o único lugar
 * da aplicação onde um CONTROLE interativo escreve no degrau de metadado
 * (`text-meta`, 11px) — degrau que nos outros 10 usos carrega só texto não
 * interativo (subtítulo, legenda, selo). O seu vizinho de painel, o gatilho de
 * idioma, já escreve em `text-sm`, igual a `Button`, `FilterTriggerButton` e
 * ao corpo do `PageHelp` (o outro popover-painel do cabeçalho).
 *
 * Como em app-shell-page-width.test.tsx, jsdom não mede pixel: o que dá para
 * travar é a presença das classes — que aqui SÃO os degraus da escala, desde
 * que `--space-*`/`--text-*` governam as utilities (QA-09).
 */
const fetchMock = vi.fn();

/** Degraus fracionários (`mb-1.5` = 6px) não existem em `--space-*` e caem no multiplicador do Tailwind. */
const ESPACAMENTO_FORA_DA_ESCALA =
  /(?:^|\s)-?(?:m|p)[trblxy]?-\d+\.\d+(?:\s|$)|(?:^|\s)(?:gap|gap-x|gap-y|space-x|space-y)-\d+\.\d+(?:\s|$)/;

describe("Preferências — Tema e Idioma seguem a escala das demais telas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const abrirPainel = async () => {
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Preferências" }));

    const rotuloTema = await screen.findByText("Tema");
    const grade = rotuloTema.nextElementSibling as HTMLElement;
    const painel = rotuloTema.parentElement?.parentElement as HTMLElement;
    return {
      painel,
      rotuloTema,
      rotuloIdioma: screen.getByText("Idioma"),
      opcoesDeTema: within(grade).getAllByRole("button"),
    };
  };

  it("as opções de Tema escrevem no mesmo degrau dos demais controles, não no de metadado", async () => {
    const { opcoesDeTema } = await abrirPainel();
    expect(opcoesDeTema).toHaveLength(3);

    const gatilhoDeIdioma = screen.getByRole("button", { name: "Idioma" });
    expect(gatilhoDeIdioma.className).toContain("text-sm");

    for (const opcao of opcoesDeTema) {
      expect(opcao.className).not.toContain("text-meta");
      expect(opcao.className).toContain("text-sm");
    }
  });

  it("o painel não estreita o popover abaixo da largura padrão do componente", async () => {
    const { painel } = await abrirPainel();
    expect(painel.className).toContain("w-72");
  });

  it("o que o painel espaça sai da escala --space-*, sem degrau fracionário", async () => {
    const { painel, rotuloTema, rotuloIdioma, opcoesDeTema } = await abrirPainel();
    expect(spacing.isMonotonic()).toBe(true);

    for (const elemento of [painel, rotuloTema, rotuloIdioma, ...opcoesDeTema]) {
      expect(elemento.className).not.toMatch(ESPACAMENTO_FORA_DA_ESCALA);
    }
  });
});
