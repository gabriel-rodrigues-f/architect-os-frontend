import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, Varredura, raizDoFrontend } from "../helpers/catraca";
import { Bloco } from "../helpers/folha-de-estilo";

/**
 * Dono (2026-09-08, referência FIAP): "a barra de rolagem elegante e sempre
 * visível, mostrando em que nível do menu o usuário está". A utility
 * `scroll-visible` é fina, com o polegar na cor primária sobre um trilho
 * discreto, e nunca some ao repousar — e vale para a coluna do menu e para
 * todo contêiner rolável interno (tabelas largas, diálogos, abas da ficha).
 */
const UTILITY = "scroll-visible";
const fonte = (caminho: string) => readFileSync(join(raizDoFrontend, caminho), "utf8");

describe("a utility scroll-visible", () => {
  const bloco = Bloco.de(`@utility ${UTILITY} {`);

  it("existe em styles.css, fina, com polegar e trilho por variável", () => {
    expect(bloco.existe).toBe(true);
    expect(bloco.declara("scrollbar-width", "thin")).toBe(true);
    expect(bloco.contem("scrollbar-color: var(--scroll-thumb) var(--scroll-track)")).toBe(true);
    expect(bloco.contem("::-webkit-scrollbar-thumb")).toBe(true);
    expect(bloco.contem("::-webkit-scrollbar-track")).toBe(true);
  });

  it("o polegar é o primário e o trilho é discreto — os dois lidos de variáveis, não de literais", () => {
    const raiz = fonte(join("src", "styles.css"));
    expect(raiz).toContain("--scroll-thumb: var(--primary);");
    expect(raiz).toMatch(/--scroll-track: color-mix\(/);
    expect(bloco.contem("scrollbar-gutter: stable")).toBe(true);
  });
});

describe("todo contêiner rolável interno leva a utility", () => {
  it("a coluna do menu e a gaveta móvel", () => {
    const shell = fonte(join("src", "components", "app", "AppShell.tsx"));
    const navs =
      shell.match(/<nav[^>]*className=\{?cn\(?\s*"[^"]*"|<nav[^>]*className="[^"]*"/g) ?? [];
    expect(navs.length).toBeGreaterThanOrEqual(2);
    for (const nav of navs) expect(nav).toContain(UTILITY);
    // A coluna troca o polegar pelo azul do menu.
    expect(shell).toContain("[--scroll-thumb:var(--sidebar-emphasis)]");
  });

  it("as abas da ficha, a primitiva de tabela e o diálogo", () => {
    expect(fonte(join("src", "components", "app", "ui-bits.tsx"))).toMatch(
      new RegExp(`<nav className="${UTILITY} [^"]*overflow-x-auto`),
    );
    expect(fonte(join("src", "components", "ui", "table.tsx"))).toMatch(
      new RegExp(`${UTILITY} [^"]*overflow-x-auto`),
    );
    expect(fonte(join("src", "components", "ui", "dialog.tsx"))).toMatch(
      new RegExp(`${UTILITY} [^"]*overflow-y-auto`),
    );
  });

  it("nenhuma classe `overflow-x-auto`/`overflow-auto` em src/ sem a utility ao lado", () => {
    const soltas = new Varredura().contagem((arquivo) => {
      const classes = arquivo.conteudo.match(/className="[^"]*"/g) ?? [];
      return classes.filter(
        (classe) => /\boverflow(?:-x)?-auto\b/.test(classe) && !classe.includes(UTILITY),
      ).length;
    });
    expect(soltas).toEqual({});
  });
});

/**
 * 2026-09-09 — a régua acima varria `overflow-auto` e `overflow-x-auto` e
 * DEIXAVA PASSAR o `overflow-y-auto`, que é justamente o eixo da padronização
 * pedida pelo dono (*"mantermos os títulos das páginas sempre visíveis"*). A
 * fatia da rolagem cria caixas verticais aos montes; sem esticar a régua, cada
 * uma delas nasceria sem a barra da casa.
 *
 * Prova do vermelho no dia em que a extensão nasceu, com a fixture vazia:
 * 19 ocorrências em 10 arquivos. Nem todas são desta fatia — diálogos, menus
 * de filtro e a primitiva de comando já estavam assim. Essas entram na
 * BASELINE como dívida herdada e a catraca só deixa o número descer.
 *
 * Regravar: `ATUALIZAR_BASELINE_ROLAGEM_Y=1 npx vitest run tests/architecture/rolagem-sempre-visivel.test.ts`
 */
const catracaVertical = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "rolagem-sempre-visivel.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_ROLAGEM_Y",
  conta: (arquivo) => {
    const classes = arquivo.conteudo.match(/className="[^"]*"/g) ?? [];
    return classes.filter(
      (classe) => /\boverflow-y-auto\b/.test(classe) && !classe.includes(UTILITY),
    ).length;
  },
});

describe("a caixa que rola na VERTICAL também leva a utility — e o número só desce", () => {
  catracaVertical.registrarTestes();
});
