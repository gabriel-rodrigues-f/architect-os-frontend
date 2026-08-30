import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { discoverRoutes } from "../../e2e/route-inventory";

/**
 * Alcance por rota — a matriz de permissão do frontend (REGRAS.md 28).
 *
 * Pedido literal do dono (2026-08-29): "estamos perdendo muito tempo com
 * QA... quero mais codificação e entrega". A resposta da regra 28: agente de
 * QA é a versão cara e manual de um teste que ainda não foi escrito. Este é
 * o teste.
 *
 * Os DOIS únicos achados bloqueantes da história do projeto são da mesma
 * família, e os dois custaram um agente de QA:
 *   onda 17 — `/calibration` era alcançável por URL direta por um member. O
 *     `beforeLoad` roda no SSR e é CEGO À SESSÃO ali (`route-guards.ts`
 *     devolve `null` sem `window`); a barreira real é a TELA negar e a
 *     consulta não sair do navegador.
 *   onda 18 — `/team-rules` sumia para o tech lead recém-logado.
 *
 * O modelo é o `backend/tests/shared/http/matriz-de-permissao.test.ts`, e a
 * lição dele é a razão de este arquivo não ser um mero congelamento: um
 * fixture que registra o buraco só quebra quando alguém o TAPA. Por isso
 * toda rota DECLARA quem a alcança, e a declaração é conferida contra a
 * fonte:
 *
 *   1. rota nova sem declaração é vermelho — a varredura itera `src/routes/`,
 *      não o fixture, senão só encontraria o que já foi declarado;
 *   2. quem declara alcance restrito tem a guarda de navegação no código, e
 *      é a guarda que a declaração nomeia;
 *   3. quem declara `autenticado` NÃO tem guarda nenhuma — declaração e
 *      código concordam nas duas direções;
 *   4. `publica` só existe se a rota escapar do `AuthGate` do `__root`;
 *      enquanto o `AuthGate` embrulhar o `<Outlet />`, declarar público é
 *      mentira e o teste diz isso;
 *   5. toda rota de alcance restrito exibe o GÊMEO da negativa — a prova de
 *      navegação (a guarda nega) e a prova de tela (a tela nega, com
 *      fixture de quem não alcança). Até esta fatia os gêmeos existiam
 *      escritos à mão, um por um; agora a AUSÊNCIA de um deles falha;
 *   6. na negativa `tela-nega`, nenhuma consulta declarada ANTES do ramo de
 *      negação sai sem `enabled` amarrado ao sinal de autorização — é a
 *      metade que o vazamento da onda 17 atravessou.
 *
 * Limites declarados, para ninguém ler mais do que está escrito: isto NÃO
 * prova que a guarda redireciona (quem prova é `tests/routes/route-guards.test.ts`),
 * NÃO prova que a tela desenha a negativa (quem prova é cada gêmeo de tela),
 * e NÃO substitui o servidor — a autorização de verdade é do backend, e a
 * matriz dele é a que vale. Este teste prova que a pergunta "quem alcança?"
 * foi RESPONDIDA para toda rota, e que a resposta bate com o código.
 */

const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = join(raizDoRepositorio, "tests", "architecture", "alcance-por-rota.fixture.json");

type Alcance = "publica" | "autenticado" | "admin" | "lead-com-vinculo";
type Negativa = "tela-nega" | "somente-leitura";

const ALCANCES: readonly Alcance[] = ["publica", "autenticado", "admin", "lead-com-vinculo"];

/** Qual guarda de navegação cada alcance restrito obriga. */
const GUARDA_POR_ALCANCE: Readonly<Record<string, string>> = {
  admin: "requireAdminReach",
  "lead-com-vinculo": "requireLeadReach",
};

/** Contas que NÃO alcançam uma rota restrita — o gêmeo de tela usa uma delas. */
const FIXTURES_DE_QUEM_NAO_ALCANCA = ["fixtureMemberUser", "fixtureUnassignedLeadUser"];

/** Declarar "somente leitura" sem dizer por quê é o mesmo buraco com outro nome. */
const TAMANHO_MINIMO_DA_JUSTIFICATIVA = 60;

const DISTRIBUICAO_ESPERADA = {
  autenticado: 18,
  admin: 3,
  "lead-com-vinculo": 1,
};

interface DeclaracaoDeAlcance {
  readonly alcance: Alcance;
  readonly guarda?: string;
  readonly sinal?: string;
  readonly negativa?: Negativa;
  readonly justificativa?: string;
  readonly provaDeNavegacao?: string;
  readonly provaDeTela?: string;
}

class Fixture {
  private static conteudo: Readonly<Record<string, DeclaracaoDeAlcance>> | undefined;

  static get rotas(): Readonly<Record<string, DeclaracaoDeAlcance>> {
    Fixture.conteudo ??= (
      JSON.parse(readFileSync(FIXTURE, "utf8")) as {
        rotas: Record<string, DeclaracaoDeAlcance>;
      }
    ).rotas;
    return Fixture.conteudo;
  }

  static get entradas(): [string, DeclaracaoDeAlcance][] {
    return Object.entries(Fixture.rotas);
  }
}

/** A fonte de uma rota, com as perguntas que o alcance faz a ela. */
class FonteDaRota {
  private readonly texto: string;

  constructor(
    readonly caminho: string,
    readonly arquivos: readonly string[],
  ) {
    this.texto = arquivos
      .map((arquivo) => readFileSync(join(raizDoRepositorio, arquivo), "utf8"))
      .join("\n");
  }

  get guardasDeclaradas(): string[] {
    return [...this.texto.matchAll(/beforeLoad:\s*([A-Za-z0-9_]+)/g)].flatMap(
      (achado) => achado[1] ?? [],
    );
  }

  consultaOSinal(sinal: string): boolean {
    return new RegExp(`\\bconst\\s+${sinal}\\b\\s*=`).test(this.texto);
  }

  negaAoSinal(sinal: string): boolean {
    return this.posicaoDaNegativa(sinal) >= 0;
  }

  posicaoDaNegativa(sinal: string): number {
    return this.texto.search(new RegExp(`![\\s(]*${sinal}\\b`));
  }

  get abreConsultaPropria(): boolean {
    return this.consultas.length > 0;
  }

  /**
   * As consultas declaradas antes do ramo de negação — as que um usuário
   * negado ainda executaria, porque o React avalia todo hook antes de
   * qualquer `return`. As que vêm depois moram em componentes que só montam
   * do outro lado da negativa; para elas a barreira é não existirem.
   */
  consultasExpostasA(sinal: string): string[] {
    const negativa = this.posicaoDaNegativa(sinal);
    return this.consultas
      .filter((consulta) => negativa < 0 || consulta.inicio < negativa)
      .filter((consulta) => !new RegExp(`enabled:[^\\n]*\\b${sinal}\\b`).test(consulta.corpo))
      .map((consulta) => consulta.corpo.split("\n")[1]?.trim() ?? consulta.corpo.slice(0, 60));
  }

  private get consultas(): { inicio: number; corpo: string }[] {
    const encontradas: { inicio: number; corpo: string }[] = [];
    for (const achado of this.texto.matchAll(/useQuery\(\{/g)) {
      const inicio = achado.index;
      encontradas.push({ inicio, corpo: this.objetoLiteralEm(inicio + achado[0].length - 1) });
    }
    return encontradas;
  }

  private objetoLiteralEm(abertura: number): string {
    let profundidade = 0;
    for (let posicao = abertura; posicao < this.texto.length; posicao += 1) {
      const caractere = this.texto[posicao];
      if (caractere === "{") profundidade += 1;
      if (caractere === "}") {
        profundidade -= 1;
        if (profundidade === 0) return this.texto.slice(abertura, posicao + 1);
      }
    }
    return this.texto.slice(abertura);
  }
}

class Prova {
  private readonly texto: string;

  constructor(readonly arquivo: string) {
    this.texto = existsSync(join(raizDoRepositorio, arquivo))
      ? readFileSync(join(raizDoRepositorio, arquivo), "utf8")
      : "";
  }

  get existe(): boolean {
    return this.texto.length > 0;
  }

  menciona(...agulhas: string[]): boolean {
    return agulhas.some((agulha) => this.texto.includes(agulha));
  }
}

const rotasDoCodigo = discoverRoutes();
const fontePorCaminho = new Map(
  rotasDoCodigo.map((rota) => [rota.path, new FonteDaRota(rota.path, rota.files)]),
);

/** O nome do módulo da rota, como um teste de tela o importa: `@/routes/users`. */
function moduloDe(caminho: string): string {
  const rota = rotasDoCodigo.find((candidata) => candidata.path === caminho);
  const arquivo = rota?.files[0] ?? "";
  return `@/routes/${arquivo.replace(/^src\/routes\//, "").replace(/\.tsx$/, "")}`;
}

const restritas = () =>
  Fixture.entradas.filter(([, declaracao]) => declaracao.alcance in GUARDA_POR_ALCANCE);

describe("alcance por rota — toda rota declara quem a alcança", () => {
  it("nenhuma rota do código fica sem declaração, e a declaração é uma das quatro", () => {
    const semDeclaracao = rotasDoCodigo
      .map((rota) => ({ caminho: rota.path, alcance: Fixture.rotas[rota.path]?.alcance }))
      .filter(({ alcance }) => alcance === undefined || !ALCANCES.includes(alcance))
      .map(({ caminho, alcance }) => `${caminho} → ${alcance ?? "(sem declaração)"}`);

    expect(semDeclaracao).toEqual([]);
  });

  it("nenhuma declaração sobra — o fixture não guarda rota que o código não tem", () => {
    const orfas = Fixture.entradas
      .map(([caminho]) => caminho)
      .filter((caminho) => !fontePorCaminho.has(caminho));

    expect(orfas).toEqual([]);
  });

  it("a matriz não é feita só de rotas abertas — o canário da distribuição", () => {
    const contagem: Record<string, number> = {};
    for (const [, declaracao] of Fixture.entradas) {
      contagem[declaracao.alcance] = (contagem[declaracao.alcance] ?? 0) + 1;
    }

    expect(contagem).toEqual(DISTRIBUICAO_ESPERADA);
  });
});

describe("alcance por rota — a declaração concorda com o código", () => {
  it("quem declara alcance restrito tem, no `beforeLoad`, a guarda que declarou", () => {
    const mentirosas = restritas()
      .filter(([caminho, declaracao]) => {
        const guardas = fontePorCaminho.get(caminho)?.guardasDeclaradas ?? [];
        if (declaracao.guarda === undefined) return true;
        if (declaracao.guarda !== GUARDA_POR_ALCANCE[declaracao.alcance]) return true;
        return !guardas.includes(declaracao.guarda);
      })
      .map(([caminho, declaracao]) => `${caminho} → declarou ${declaracao.guarda ?? "(nada)"}`);

    expect(mentirosas).toEqual([]);
  });

  it("quem declara `autenticado` NÃO tem guarda de navegação — a concordância vale nos dois sentidos", () => {
    const mentirosas = Fixture.entradas
      .filter(([, declaracao]) => declaracao.alcance === "autenticado")
      .filter(([caminho]) => (fontePorCaminho.get(caminho)?.guardasDeclaradas ?? []).length > 0)
      .map(([caminho]) => `${caminho} → ${fontePorCaminho.get(caminho)?.guardasDeclaradas.join()}`);

    expect(mentirosas).toEqual([]);
  });

  /**
   * O `AuthGate` do `__root` embrulha o `<Outlet />`: enquanto for assim,
   * NENHUMA rota de arquivo é alcançável sem sessão, e declarar `publica`
   * seria mentira. Se um dia o gate sair dali, este teste cai junto e a
   * declaração volta a ser possível — de propósito.
   */
  it("`publica` não é dizível enquanto o AuthGate embrulhar o Outlet", () => {
    const raiz = readFileSync(join(raizDoRepositorio, "src", "routes", "__root.tsx"), "utf8");
    const gateEmbrulhaTudo = /<AuthGate>[\s\S]*<Outlet\b[\s\S]*<\/AuthGate>/.test(raiz);
    const publicas = Fixture.entradas
      .filter(([, declaracao]) => declaracao.alcance === "publica")
      .map(([caminho]) => caminho);

    expect({ gateEmbrulhaTudo, publicas }).toEqual({ gateEmbrulhaTudo: true, publicas: [] });
  });
});

describe("alcance por rota — a rota restrita exibe o gêmeo da negativa", () => {
  it("cada rota restrita nomeia o sinal de autorização, e a tela consulta esse sinal", () => {
    const mudas = restritas()
      .filter(
        ([caminho, declaracao]) =>
          declaracao.sinal === undefined ||
          !fontePorCaminho.get(caminho)?.consultaOSinal(declaracao.sinal),
      )
      .map(
        ([caminho, declaracao]) => `${caminho} → sinal ${declaracao.sinal ?? "(não declarado)"}`,
      );

    expect(mudas).toEqual([]);
  });

  it("a negativa declarada é `tela-nega` ou `somente-leitura`, nunca omitida", () => {
    const semNegativa = restritas()
      .filter(
        ([, declaracao]) =>
          declaracao.negativa !== "tela-nega" && declaracao.negativa !== "somente-leitura",
      )
      .map(([caminho]) => caminho);

    expect(semNegativa).toEqual([]);
  });

  it("quem declara `tela-nega` tem, na fonte, o ramo que nega ao sinal", () => {
    const mentirosas = restritas()
      .filter(([, declaracao]) => declaracao.negativa === "tela-nega")
      .filter(
        ([caminho, declaracao]) =>
          !fontePorCaminho.get(caminho)?.negaAoSinal(declaracao.sinal ?? ""),
      )
      .map(([caminho, declaracao]) => `${caminho} → sem ramo !${declaracao.sinal}`);

    expect(mentirosas).toEqual([]);
  });

  /**
   * O vazamento da onda 17, virado teste: a tela pode negar o DESENHO e
   * ainda assim disparar a consulta, porque o React avalia todo hook antes
   * do `return`. Aqui o `enabled` amarrado ao sinal deixa de ser costume e
   * vira exigência.
   */
  it("nenhuma consulta anterior ao ramo de negação sai sem `enabled` amarrado ao sinal", () => {
    const vazadas = restritas()
      .filter(([, declaracao]) => declaracao.negativa === "tela-nega")
      .flatMap(([caminho, declaracao]) =>
        (fontePorCaminho.get(caminho)?.consultasExpostasA(declaracao.sinal ?? "") ?? []).map(
          (consulta) => `${caminho} → ${consulta}`,
        ),
      );

    expect(vazadas).toEqual([]);
  });

  it("quem declara `somente-leitura` não abre consulta própria, e justifica por escrito", () => {
    const frouxas = restritas()
      .filter(([, declaracao]) => declaracao.negativa === "somente-leitura")
      .filter(
        ([caminho, declaracao]) =>
          fontePorCaminho.get(caminho)?.abreConsultaPropria === true ||
          (declaracao.justificativa ?? "").trim().length < TAMANHO_MINIMO_DA_JUSTIFICATIVA,
      )
      .map(([caminho]) => caminho);

    expect(frouxas).toEqual([]);
  });

  it("justificativa é escrita SÓ onde a leitura aberta precisa dela — não vira campo decorativo", () => {
    const sobrando = Fixture.entradas
      .filter(([, declaracao]) => declaracao.negativa !== "somente-leitura")
      .filter(([, declaracao]) => declaracao.justificativa !== undefined)
      .map(([caminho]) => caminho);

    expect(sobrando).toEqual([]);
  });
});

describe("alcance por rota — o gêmeo existe e prova a negativa", () => {
  it("cada rota restrita aponta uma prova de NAVEGAÇÃO que exercita a guarda dela", () => {
    const orfas = restritas()
      .filter(([, declaracao]) => {
        const prova = new Prova(declaracao.provaDeNavegacao ?? "");
        return !prova.existe || !prova.menciona(declaracao.guarda ?? "");
      })
      .map(([caminho, declaracao]) => `${caminho} → ${declaracao.provaDeNavegacao ?? "(nenhuma)"}`);

    expect(orfas).toEqual([]);
  });

  it("cada rota restrita aponta uma prova de TELA que monta a rota com quem não a alcança", () => {
    const orfas = restritas()
      .filter(([caminho, declaracao]) => {
        const prova = new Prova(declaracao.provaDeTela ?? "");
        return (
          !prova.existe ||
          !prova.menciona(moduloDe(caminho)) ||
          !prova.menciona(...FIXTURES_DE_QUEM_NAO_ALCANCA)
        );
      })
      .map(([caminho, declaracao]) => `${caminho} → ${declaracao.provaDeTela ?? "(nenhuma)"}`);

    expect(orfas).toEqual([]);
  });
});
