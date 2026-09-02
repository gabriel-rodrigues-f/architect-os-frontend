import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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
 *      metade que o vazamento da onda 17 atravessou;
 *   7. consulta EMBRULHADA EM HOOK conta como consulta. Até a onda 19 a
 *      varredura só enxergava `useQuery({` literal, e o QA de integração
 *      mediu o buraco no navegador: um member em `/team-rules` disparava
 *      GET /career-levels, porque `useCareerLevelsByRank()` — um `useQuery`
 *      dentro de `store.tsx` — roda antes do ramo de negação. Não era
 *      vazamento (o catálogo é global), mas a promessa escrita era mais
 *      larga que a checagem. Agora os hooks de consulta de `store.tsx` são
 *      derivados por ponto fixo e varridos junto, e cada um que sobreviva
 *      antes da negativa tem de estar DECLARADO como catálogo global, com
 *      justificativa escrita;
 *   8. a guarda de navegação tem NOME. `beforeLoad: ({ context }) => …`
 *      escapava da varredura de guardas, e uma rota declarada `autenticado`
 *      podia ganhar guarda anônima sem a declaração mudar. As quatro rotas
 *      restritas já usavam a forma nomeada; isto fecha antes que deixem de
 *      usar.
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
const DIRETORIO_LIB = join(raizDoRepositorio, "src", "lib");

/**
 * Os módulos de `lib/` que abrem consulta e que a varredura LÊ. `store.tsx`
 * desde a onda 19; `context-scope.tsx` desde a onda 31, quando `/team` e a
 * ficha de carreira — que montam `<ContextScope>` — passaram a ser
 * restritas e o tripwire abaixo cobrou a extensão.
 */
const MODULOS_DE_CONSULTA_VARRIDOS = [
  join(DIRETORIO_LIB, "store.tsx"),
  join(DIRETORIO_LIB, "context-scope.tsx"),
];

type Alcance =
  | "publica"
  | "autenticado"
  | "admin"
  | "lead-com-vinculo"
  | "calibracao"
  | "lideranca"
  | "ficha-de-carreira";
type Negativa = "tela-nega" | "somente-leitura";

const ALCANCES: readonly Alcance[] = [
  "publica",
  "autenticado",
  "admin",
  "lead-com-vinculo",
  "calibracao",
  "lideranca",
  "ficha-de-carreira",
];

/** Qual guarda de navegação cada alcance restrito obriga. */
const GUARDA_POR_ALCANCE: Readonly<Record<string, string>> = {
  admin: "requireAdminReach",
  "lead-com-vinculo": "requireLeadReach",
  calibracao: "requireCalibrationReach",
  lideranca: "requireLeadershipReach",
  "ficha-de-carreira": "requireCareerFileReach",
};

/** Contas que NÃO alcançam uma rota restrita — o gêmeo de tela usa uma delas. */
const FIXTURES_DE_QUEM_NAO_ALCANCA = ["fixtureMemberUser", "fixtureUnassignedTechLeadUser"];

/** Declarar "somente leitura" sem dizer por quê é o mesmo buraco com outro nome. */
const TAMANHO_MINIMO_DA_JUSTIFICATIVA = 60;

/** Guarda de navegação é nomeada: `beforeLoad: requireAdminReach`, nunca uma seta anônima. */
const NOME_DE_GUARDA = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const DISTRIBUICAO_ESPERADA = {
  autenticado: 12,
  admin: 2,
  "lead-com-vinculo": 2,
  calibracao: 1,
  lideranca: 2,
  "ficha-de-carreira": 4,
};

interface CatalogoGlobal {
  readonly hook: string;
  readonly justificativa: string;
}

interface DeclaracaoDeAlcance {
  readonly alcance: Alcance;
  readonly guarda?: string;
  readonly sinal?: string;
  readonly negativa?: Negativa;
  readonly justificativa?: string;
  readonly catalogosGlobais?: readonly CatalogoGlobal[];
  readonly provaDeNavegacao?: string;
  readonly provaDeTela?: string;
}

interface ConsultaDaRota {
  readonly inicio: number;
  readonly corpo: string;
  readonly hook?: string;
  readonly rotulo: string;
}

/**
 * Os hooks E componentes de consulta que um módulo exporta. Fecho por PONTO
 * FIXO: é de consulta quem chama `useQuery(`/`useQueries(` ou quem chama
 * outro de consulta do mesmo módulo — senão `useGapSeverityRuler()`, que só
 * chama `useScoringBands()`, voltaria a ser invisível pelo mesmo motivo que
 * `useCareerLevelsByRank()` era. `<ContextScope>` é um componente que abre
 * as consultas de contexto ao montar: conta como consulta, e a rota o
 * referencia como JSX, não como chamada.
 */
class HooksDeConsulta {
  private constructor(private readonly blocos: ReadonlyMap<string, string>) {}

  static de(arquivo: string): HooksDeConsulta {
    const texto = readFileSync(arquivo, "utf8");
    const inicios = [...texto.matchAll(/^export /gm)].map((achado) => achado.index);
    const blocos = new Map<string, string>();
    for (const [ordem, inicio] of inicios.entries()) {
      const bloco = texto.slice(inicio, inicios[ordem + 1] ?? texto.length);
      const nome = /^export function ([A-Za-z0-9_]+)/.exec(bloco)?.[1];
      if (nome !== undefined) blocos.set(nome, bloco);
    }
    return new HooksDeConsulta(blocos);
  }

  get nomes(): string[] {
    const consultam = new Set<string>();
    let cresceu = true;
    while (cresceu) {
      cresceu = false;
      for (const [nome, bloco] of this.blocos) {
        if (consultam.has(nome) || !HooksDeConsulta.consulta(bloco, consultam)) continue;
        consultam.add(nome);
        cresceu = true;
      }
    }
    return [...consultam].sort();
  }

  private static consulta(bloco: string, conhecidos: ReadonlySet<string>): boolean {
    if (/\buseQuer(?:y|ies)\(/.test(bloco)) return true;
    return [...conhecidos].some((nome) => HooksDeConsulta.referencia(nome).test(bloco));
  }

  /** Hook é chamado (`useX(`); componente é montado (`<X`). */
  static referencia(nome: string): RegExp {
    return nome.startsWith("use")
      ? new RegExp(`\\b${nome}\\s*\\(`, "g")
      : new RegExp(`<${nome}\\b`, "g");
  }
}

/**
 * Módulos de `lib/` que abrem consulta e que esta varredura NÃO lê. Enquanto
 * nenhuma rota restrita importar um deles, o limite é teórico; no dia em que
 * importar, o tripwire abaixo cobra a extensão da varredura em vez de deixar
 * a promessa crescer sozinha — foi assim que `context-scope.tsx` entrou.
 */
class ModulosDeConsultaForaDaVarredura {
  static get nomes(): string[] {
    return readdirSync(DIRETORIO_LIB, { recursive: true, withFileTypes: true })
      .filter((entrada) => entrada.isFile() && /\.tsx?$/.test(entrada.name))
      .map((entrada) => join(entrada.parentPath, entrada.name))
      .filter((arquivo) => !MODULOS_DE_CONSULTA_VARRIDOS.includes(arquivo))
      .filter((arquivo) => /\buseQuer(?:y|ies)\(/.test(readFileSync(arquivo, "utf8")))
      .map((arquivo) => `@/lib/${relative(DIRETORIO_LIB, arquivo).replace(/\.tsx?$/, "")}`)
      .sort();
  }
}

const HOOKS_DE_CONSULTA_DO_STORE = MODULOS_DE_CONSULTA_VARRIDOS.flatMap(
  (modulo) => HooksDeConsulta.de(modulo).nomes,
);

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
    return this.beforeLoads.filter((valor) => NOME_DE_GUARDA.test(valor));
  }

  get guardasAnonimas(): string[] {
    return this.beforeLoads.filter((valor) => !NOME_DE_GUARDA.test(valor));
  }

  importa(modulo: string): boolean {
    return this.texto.includes(`from "${modulo}"`);
  }

  private get beforeLoads(): string[] {
    return [...this.texto.matchAll(/beforeLoad:\s*([^\s,][^,\n]*)/g)].flatMap(
      (achado) => achado[1]?.trim() ?? [],
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

  get todasAsConsultas(): ConsultaDaRota[] {
    return this.consultas;
  }

  /**
   * As consultas declaradas antes do ramo de negação — as que um usuário
   * negado ainda executaria, porque o React avalia todo hook antes de
   * qualquer `return`. As que vêm depois moram em componentes que só montam
   * do outro lado da negativa; para elas a barreira é não existirem.
   */
  consultasExpostasA(sinal: string): ConsultaDaRota[] {
    const negativa = this.posicaoDaNegativa(sinal);
    return this.consultas
      .filter((consulta) => negativa < 0 || consulta.inicio < negativa)
      .filter((consulta) => !new RegExp(`enabled:[^\\n]*\\b${sinal}\\b`).test(consulta.corpo));
  }

  chamaOHook(hook: string): boolean {
    return this.consultas.some((consulta) => consulta.hook === hook);
  }

  private get consultas(): ConsultaDaRota[] {
    return [...this.consultasLiterais, ...this.consultasEmHook].sort(
      (esquerda, direita) => esquerda.inicio - direita.inicio,
    );
  }

  private get consultasLiterais(): ConsultaDaRota[] {
    return [...this.texto.matchAll(/useQuery\(\{/g)].map((achado) => {
      const inicio = achado.index;
      const corpo = this.objetoLiteralEm(inicio + achado[0].length - 1);
      return {
        inicio,
        corpo,
        rotulo: corpo.split("\n")[1]?.trim() ?? corpo.slice(0, 60),
      };
    });
  }

  /**
   * `useCareerLevelsByRank()` é um `useQuery` com outro nome. Um hook não
   * aceita `enabled`, então toda chamada anterior ao ramo de negação sai
   * SEMPRE — a única saída honesta é declará-la como catálogo global e
   * escrever por quê.
   */
  private get consultasEmHook(): ConsultaDaRota[] {
    return HOOKS_DE_CONSULTA_DO_STORE.flatMap((hook) =>
      [...this.texto.matchAll(HooksDeConsulta.referencia(hook))].map((achado) => ({
        inicio: achado.index,
        corpo: "",
        hook,
        rotulo: hook.startsWith("use") ? `${hook}()` : `<${hook}>`,
      })),
    );
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

/** Toda guarda que a rota instala, nomeada ou anônima. */
const guardasDe = (caminho: string): string[] => {
  const fonte = fontePorCaminho.get(caminho);
  return [...(fonte?.guardasDeclaradas ?? []), ...(fonte?.guardasAnonimas ?? [])];
};

const catalogosDeclaradosEm = (declaracao: DeclaracaoDeAlcance): string[] =>
  (declaracao.catalogosGlobais ?? []).map((catalogo) => catalogo.hook);

const naoDeclaradas = (
  consultas: readonly ConsultaDaRota[],
  declaracao: DeclaracaoDeAlcance,
): string[] => {
  const declarados = catalogosDeclaradosEm(declaracao);
  return consultas
    .filter((consulta) => consulta.hook === undefined || !declarados.includes(consulta.hook))
    .map((consulta) => consulta.rotulo);
};

describe("alcance por rota — toda rota declara quem a alcança", () => {
  it("nenhuma rota do código fica sem declaração, e a declaração é um alcance conhecido", () => {
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
      .map(([caminho]) => ({ caminho, guardas: guardasDe(caminho) }))
      .filter(({ guardas }) => guardas.length > 0)
      .map(({ caminho, guardas }) => `${caminho} → ${guardas.join()}`);

    expect(mentirosas).toEqual([]);
  });

  /**
   * `beforeLoad: ({ context }) => …` escapava da varredura de guardas: o
   * casamento pedia identificador e a seta não é um. Uma rota `autenticado`
   * podia ganhar guarda anônima sem a declaração mudar, e a rota restrita
   * podia trocar a guarda nomeada por uma cópia inline. Guarda tem nome.
   */
  it("nenhuma guarda de navegação é anônima — `beforeLoad` nomeia quem guarda", () => {
    const anonimas = rotasDoCodigo
      .map((rota) => ({
        caminho: rota.path,
        guardas: fontePorCaminho.get(rota.path)?.guardasAnonimas ?? [],
      }))
      .filter(({ guardas }) => guardas.length > 0)
      .map(({ caminho, guardas }) => `${caminho} → ${guardas.join()}`);

    expect(anonimas).toEqual([]);
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
        naoDeclaradas(
          fontePorCaminho.get(caminho)?.consultasExpostasA(declaracao.sinal ?? "") ?? [],
          declaracao,
        ).map((consulta) => `${caminho} → ${consulta}`),
      );

    expect(vazadas).toEqual([]);
  });

  it("quem declara `somente-leitura` não abre consulta própria, e justifica por escrito", () => {
    const frouxas = restritas()
      .filter(([, declaracao]) => declaracao.negativa === "somente-leitura")
      .filter(
        ([caminho, declaracao]) =>
          naoDeclaradas(fontePorCaminho.get(caminho)?.todasAsConsultas ?? [], declaracao).length >
            0 || (declaracao.justificativa ?? "").trim().length < TAMANHO_MINIMO_DA_JUSTIFICATIVA,
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

describe("alcance por rota — o catálogo global é declarado, não presumido", () => {
  /**
   * A declaração é a saída honesta para o hook que não aceita `enabled`; ela
   * não pode virar a porta dos fundos. Catálogo declarado que a rota não
   * consulta é declaração podre — o mesmo defeito do fixture que registra
   * ausência —, e catálogo sem justificativa escrita é o buraco com outro
   * nome.
   */
  it("todo catálogo global declarado é consultado pela rota, e diz por escrito por que pode sair", () => {
    const podres = Fixture.entradas.flatMap(([caminho, declaracao]) =>
      (declaracao.catalogosGlobais ?? [])
        .filter(
          (catalogo) =>
            fontePorCaminho.get(caminho)?.chamaOHook(catalogo.hook) !== true ||
            catalogo.justificativa.trim().length < TAMANHO_MINIMO_DA_JUSTIFICATIVA,
        )
        .map((catalogo) => `${caminho} → ${catalogo.hook}`),
    );

    expect(podres).toEqual([]);
  });

  it("catálogo global só é dizível por quem declara alcance restrito", () => {
    const sobrando = Fixture.entradas
      .filter(([, declaracao]) => !(declaracao.alcance in GUARDA_POR_ALCANCE))
      .filter(([, declaracao]) => declaracao.catalogosGlobais !== undefined)
      .map(([caminho]) => caminho);

    expect(sobrando).toEqual([]);
  });

  /**
   * A varredura lê `store.tsx` e mais nada de `lib/`. Enquanto rota restrita
   * nenhuma importar outro módulo que abra consulta, o limite é teórico; no
   * dia em que importar, a promessa passaria a ser mais larga que a checagem
   * outra vez — que é exatamente o defeito que esta fatia veio fechar.
   */
  it("rota restrita não importa consulta de módulo que a varredura não lê", () => {
    const cegas = restritas().flatMap(([caminho]) =>
      ModulosDeConsultaForaDaVarredura.nomes
        .filter((modulo) => fontePorCaminho.get(caminho)?.importa(modulo) === true)
        .map((modulo) => `${caminho} → ${modulo}`),
    );

    expect(cegas).toEqual([]);
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
