import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spacing } from "@/lib/design/scale";
import { ThemeProvider } from "@/lib/theme";
import { Route as AccountRoute } from "@/routes/account";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * UI-03 — Tema e Idioma seguem a escala das demais telas.
 *
 * A régua NASCEU sobre o menu da engrenagem do cabeçalho: era o único popover
 * com conteúdo próprio que estreitava o `PopoverContent`, e o único lugar da
 * aplicação onde um CONTROLE interativo escrevia no degrau de metadado
 * (`text-meta`, 11px) — degrau que nos outros usos carrega só texto que
 * ninguém clica.
 *
 * A fatia de Minha Conta (2026-09-10) MUDOU O ENDEREÇO dos dois controles, não
 * a régua: eles saíram do popover e passaram a morar em **Minha Conta →
 * Preferências**, e a engrenagem virou o atalho para lá. Uma catraca cujo
 * objeto muda de casa se MUDA JUNTO, no mesmo passo — apagá-la deixaria a
 * régua sem verificador e o defeito voltaria pela porta de sempre.
 *
 * O que sobreviveu à mudança, item a item:
 *  - as três opções de Tema continuam escrevendo no degrau dos controles, não
 *    no de metadado;
 *  - o que o painel espaça continua saindo de `--space-*`, sem degrau
 *    fracionário (`mb-1.5` = 6px não existe na escala e cai no multiplicador
 *    do Tailwind).
 *
 * O que MORREU com o popover, e é honesto declarar: a conferência de que o
 * painel não estreitava o `PopoverContent` abaixo de `w-72`. Não há mais
 * popover para estreitar — a aba é conteúdo de página. A régua não foi
 * afrouxada; o objeto dela deixou de existir.
 *
 * Como em app-shell-page-width.test.tsx, jsdom não mede pixel: o que dá para
 * travar é a presença das classes — que aqui SÃO os degraus da escala, desde
 * que `--space-*`/`--text-*` governam as utilities (QA-09).
 */
const fetchMock = vi.fn();

/** Degraus fracionários (`mb-1.5` = 6px) não existem em `--space-*` e caem no multiplicador do Tailwind. */
const ESPACAMENTO_FORA_DA_ESCALA =
  /(?:^|\s)-?(?:m|p)[trblxy]?-\d+\.\d+(?:\s|$)|(?:^|\s)(?:gap|gap-x|gap-y|space-x|space-y)-\d+\.\d+(?:\s|$)/;

const AccountPage = AccountRoute.options.component as () => ReactNode;

describe("Minha Conta → Preferências — Tema e Idioma seguem a escala das demais telas", () => {
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

  const abrirAba = async () => {
    renderWithApp(
      <ThemeProvider>
        <AccountPage />
      </ThemeProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Preferências" }));

    const rotuloTema = await screen.findByText("Tema");
    const grade = rotuloTema.nextElementSibling as HTMLElement;
    return {
      painel: await screen.findByRole("tabpanel", { name: "Preferências" }),
      rotuloTema,
      rotuloIdioma: screen.getByText("Idioma"),
      opcoesDeTema: within(grade).getAllByRole("button"),
    };
  };

  it("as opções de Tema escrevem no mesmo degrau dos demais controles, não no de metadado", async () => {
    const { opcoesDeTema } = await abrirAba();
    expect(opcoesDeTema).toHaveLength(3);

    const gatilhoDeIdioma = screen.getByRole("button", { name: "Idioma" });
    // PR 2: o gatilho veste a moldura de `FieldControl` e já escreve `text-body` — o mesmo degrau que `text-sm` resolve.
    expect(gatilhoDeIdioma.className).toMatch(/\btext-(?:sm|body)\b/);

    for (const opcao of opcoesDeTema) {
      expect(opcao.className).not.toContain("text-meta");
      // `text-sm` é ALIAS de `--text-body` desde o PR 1; a catraca [T-01] pede
      // o PAPEL da casa nos arquivos novos, então os dois nomes valem — o que
      // a régua proíbe continua sendo o degrau de metadado num controle.
      expect(opcao.className).toMatch(/\btext-(?:sm|body)\b/);
    }
  });

  /**
   * A PROVA QUE MUDOU DE CASA JUNTO COM O SELETOR.
   *
   * Ela vivia em `app-shell-cycle-locale.test.tsx`, sobre o popover da
   * engrenagem. O seletor mudou para cá na fatia de Minha Conta (2026-09-10),
   * e a prova veio junto: catraca cujo objeto muda de endereço se MUDA, nunca
   * se apaga — senão a régua fica sem verificador e o defeito volta pela porta
   * de sempre.
   */
  it("troca o idioma ao escolher 'English' na lista", async () => {
    await abrirAba();
    const user = userEvent.setup();

    // O nome acessível é o rótulo fixo "Idioma"; o idioma atual ("Português")
    // é o texto visível DENTRO do gatilho — mesmo raciocínio do seletor de Ciclo.
    const gatilhoDeIdioma = await screen.findByRole("button", { name: "Idioma" });
    expect(gatilhoDeIdioma.textContent).toContain("Português");

    await user.click(gatilhoDeIdioma);
    await user.click(await screen.findByRole("option", { name: "English" }));

    // Trocar o idioma reflete de imediato num texto já traduzido em outro
    // ponto da tela — prova que `setLocale` foi chamado com o código certo.
    expect(await screen.findByRole("tab", { name: "Preferences" })).toBeTruthy();
  });

  it("o que o painel espaça sai da escala --space-*, sem degrau fracionário", async () => {
    const { painel, rotuloTema, rotuloIdioma, opcoesDeTema } = await abrirAba();
    expect(spacing.isMonotonic()).toBe(true);

    for (const elemento of [painel, rotuloTema, rotuloIdioma, ...opcoesDeTema]) {
      expect(elemento.className).not.toMatch(ESPACAMENTO_FORA_DA_ESCALA);
    }
  });
});
