import { existsSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { DoorRefusal } from "@/lib/door-refusal";
import { defaultRefusalPhrase } from "@/lib/refusal-phrase";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

import contratoDoBackend from "./a-recusa-fala-o-idioma-de-quem-le.fixture.json";

/**
 * A CATRACA DA RECUSA EM PORTUGUÊS — quantas frases o servidor ainda escreve
 * para a tela.
 *
 * Dono, 2026-09-08, com a captura da tela em inglês: *"as notificações não
 * estão sendo traduzidas para inglês no idioma inglês; aproveite e faça uma
 * varredura do que pode ter ficado de fora"*. Os avisos foram consertados
 * primeiro; a varredura devolveu a RECUSA como maior item, e ela é grande
 * demais para uma fatia só: o contrato de erro do backend tem 192 classes
 * concretas, e mais de cem delas escrevem a própria frase.
 *
 * Esta fatia cortou **pelo alcance, não pela facilidade**: primeiro a base
 * COMPARTILHADA — o "não encontrado" (que 44 classes publicam), o dialeto do
 * framework e o dialeto do banco, que qualquer tela alcança por qualquer rota
 * —, e a última porta sem sessão que ainda lia a frase do serviço.
 *
 * O resto está aqui, contado, com nome e motivo. A regra da catraca é a mesma
 * das outras da casa: **o número só desce**. Uma fatia que traduza mais
 * recusas baixa a linha no mesmo passo; uma classe nova que nasça escrevendo
 * a própria frase sobe o número e fica vermelha na hora.
 *
 * ## De onde vem o fixture
 *
 * É **cópia byte a byte** do `contrato-de-erro.fixture.json` do backend, que é
 * a fonte da verdade das recusas. Existe cópia aqui porque nenhum dos dois
 * repositórios lê o outro na CI — o mesmo raciocínio (e o mesmo mecanismo de
 * canário e comparação oportunista) de
 * `tests/lib/message-codes-de-sucesso.test.ts`. Atualizar é uma linha:
 *
 * ```
 * cp ../backend/tests/shared/errors/contrato-de-erro.fixture.json \
 *    tests/architecture/a-recusa-fala-o-idioma-de-quem-le.fixture.json
 * ```
 */

/**
 * A FAIXA QUE A TELA IMPRIME. `ApiFailureReading` cala o serviço no status 0 e
 * acima de 500 (onda 45, "o erro não conta nada"); abaixo disso a frase do
 * serviço chega inteira. É exatamente esta faixa que esta fatia veio traduzir,
 * e é nela que a dívida é contada.
 */
const FAIXA_IMPRESSA: ReadonlySet<number> = new Set([400, 401, 403, 404, 409, 412, 428]);

/**
 * O código INTERNO da recusa de alcance. Ele nunca vai ao fio — o motor
 * publica o `NOT_FOUND` do recurso ausente, byte a byte (regra 18, decisão 2)
 * —, então quem a traduz é a regra do `NOT_FOUND`. Sem esta linha, 24 classes
 * já traduzidas apareceriam como dívida.
 */
const PUBLICA_COMO: Readonly<Record<string, string>> = { OUT_OF_REACH: "NOT_FOUND" };

/**
 * As recusas da PORTA — login, primeiro acesso, criar senha, recuperação.
 * Elas não passam pela `RefusalPhrase`: quem escolhe a frase ali é a
 * `DoorRefusal`, que decide por código o que fala e o que cala, porque na
 * porta não há sessão para expirar e a régua é outra (dono, 2026-09-09).
 * Estão traduzidas nos dois idiomas, e por isso saem da dívida.
 */
const NA_PORTA: readonly string[] = [
  DoorRefusal.INVALID_CREDENTIALS_CODE,
  DoorRefusal.ACCOUNT_DISABLED_CODE,
  DoorRefusal.REFUSED_LINK_CODE,
  "WEAK_PASSWORD",
  "INVALID_CURRENT_PASSWORD",
];

/**
 * A DÍVIDA DE HOJE, medida no fixture, e a linha que só desce.
 *
 * 96 → 95: `TEAM_MEMBERSHIP_NOT_ASSIGNED` é a única ausência da casa com
 * código próprio, e entrou na política pelo código em vez de pela peça.
 *
 * O grosso do que sobra tem dois nomes:
 *
 *  - **`FORBIDDEN`, 13 classes com 13 frases diferentes.** Traduzir por código
 *    colapsaria as treze numa só, e o dono foi explícito sobre o custo disso:
 *    a recusa de ATO existe para dizer à pessoa o que fazer (regra 18, decisão
 *    3). O conserto é do BACKEND e é fatia própria — cada recusa de ato ganha
 *    o próprio código —, não uma escolha desta tela.
 *  - **as recusas de negócio de cada módulo** (409 e 400, sobretudo): elas
 *    dizem regra de produto por extenso, em prosa escrita para a pessoa. São
 *    tradução de texto, uma a uma, e cabem em fatias por módulo.
 */
const DIVIDA_DE_HOJE = 95;

/** Quantas classes de recusa a política JÁ compõe na tela, nos dois idiomas. */
const TRADUZIDAS_HOJE = 51;

const ORIGEM_DA_COPIA = "backend/tests/shared/errors/contrato-de-erro.fixture.json";

interface EntradaDeClasse {
  readonly arquivo: string;
  readonly code: string | null;
  readonly status: number;
  readonly mensagens: readonly string[];
}

const CLASSES: Readonly<Record<string, EntradaDeClasse>> = contratoDoBackend.classes;

class RecusaDoContrato {
  constructor(
    readonly classe: string,
    readonly entrada: EntradaDeClasse,
  ) {}

  /** O código que a tela LÊ — não o da classe, quando os dois diferem. */
  get codigoNoFio(): string {
    const proprio = this.entrada.code ?? "";
    return PUBLICA_COMO[proprio] ?? proprio;
  }

  /** Chega à tela e escreve a própria frase — é o que a fatia veio trocar. */
  get chegaComFrase(): boolean {
    return FAIXA_IMPRESSA.has(this.entrada.status) && this.entrada.mensagens.length > 0;
  }

  get traduzida(): boolean {
    return (
      defaultRefusalPhrase.phrasedCodes().includes(this.codigoNoFio) ||
      NA_PORTA.includes(this.codigoNoFio)
    );
  }

  toString(): string {
    return `${this.classe} (${this.codigoNoFio}, ${String(this.entrada.status)}, ${this.entrada.arquivo})`;
  }
}

const recusas = Object.entries(CLASSES).map(
  ([classe, entrada]) => new RecusaDoContrato(classe, entrada),
);
const emDivida = recusas.filter((recusa) => recusa.chegaComFrase && !recusa.traduzida);
const traduzidas = recusas.filter(
  (recusa) => FAIXA_IMPRESSA.has(recusa.entrada.status) && recusa.traduzida,
);

describe("a catraca: quantas recusas o servidor ainda escreve para a tela", () => {
  it("a dívida não sobe — classe nova que escreva a própria frase fica vermelha aqui", () => {
    expect(
      emDivida.length,
      `recusas ainda em português do servidor:\n${emDivida
        .slice(0, 12)
        .map((recusa) => `  ${recusa.toString()}`)
        .join("\n")}`,
    ).toBeLessThanOrEqual(DIVIDA_DE_HOJE);
  });

  it("a linha é a de hoje: baixar a dívida obriga a baixar o número no mesmo passo", () => {
    expect(emDivida.length).toBe(DIVIDA_DE_HOJE);
  });

  it("o que já foi traduzido não regride", () => {
    expect(traduzidas.length).toBeGreaterThanOrEqual(TRADUZIDAS_HOJE);
  });

  /**
   * O outro lado da conta: regra que não alcança recusa nenhuma é regra morta,
   * e regra morta esconde a que falta. Os códigos sem classe (o dialeto do
   * framework e o do banco) vivem na outra metade do fixture.
   */
  it("toda regra da política alcança um código que o backend publica", () => {
    const publicados = new Set([
      ...Object.values(CLASSES).map((entrada) => entrada.code ?? ""),
      ...Object.keys(contratoDoBackend.codigosSemClasse),
      // O motor traduz a recusa de alcance para este código antes de escrever
      // o corpo; ele não aparece como `code` de classe nenhuma.
      "NOT_FOUND",
    ]);
    const orfas = defaultRefusalPhrase
      .phrasedCodes()
      .filter((codigo) => !publicados.has(codigo))
      .sort();

    expect(orfas).toEqual([]);
  });
});

/**
 * A PROVA de que a tela não imprime mais o texto do servidor nas recusas que
 * esta fatia migrou — e ela passa pelo caminho REAL, do corpo HTTP até a
 * frase, não por comparação de duas listas de string.
 */
describe("do corpo do serviço até a frase da tela, sem passar pelo texto dele", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  /** Reproduz o que o `HttpResponder.fail` põe no fio depois desta fatia. */
  async function recusaDoServico(corpo: unknown, status: number): Promise<unknown> {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    return new ApiClient("http://api.local")
      .request("/qualquer-rota")
      .then(() => undefined)
      .catch((failure: unknown) => failure);
  }

  it("o 404 do serviço vira frase da casa, no idioma de quem lê", async () => {
    const falha = await recusaDoServico(
      {
        code: "NOT_FOUND",
        message: "profissional não encontrado",
        wording: { entity: "professional" },
        correlationId: "req-1",
      },
      404,
    );

    expect(falha).toBeInstanceOf(ApiError);
    const emIngles = defaultRefusalPhrase.sentenceOf(falha, (chave) => en[chave]);
    const emPortugues = defaultRefusalPhrase.sentenceOf(falha, (chave) => pt[chave]);

    expect(emIngles).toBe(en["refusal.notFound.professional"]);
    expect(emPortugues).toBe(pt["refusal.notFound.professional"]);
    expect(emIngles).not.toBe("profissional não encontrado");
  });

  it("as peças sobrevivem ao cliente HTTP — é por elas que a frase é escolhida", async () => {
    const falha = (await recusaDoServico(
      { code: "NOT_FOUND", message: "PDI não encontrado", wording: { entity: "developmentPlan" } },
      404,
    )) as ApiError;

    expect(falha.wording).toEqual({ entity: "developmentPlan" });
  });

  /**
   * A fronteira que a auditoria de erro fechou hoje continua fechada: acima de
   * 500 a casa cala o serviço INTEIRO — a frase, e também as peças. Esta fatia
   * traduz a recusa de NEGÓCIO; ela não abre a de infraestrutura.
   */
  it("acima de 500 nem as peças chegam — a fronteira da onda 45 continua de pé", async () => {
    const falha = (await recusaDoServico(
      {
        code: "DATABASE_UNAVAILABLE",
        message: "Serviço temporariamente indisponível. Tente novamente em instantes.",
        wording: { entity: "professional" },
      },
      503,
    )) as ApiError;

    expect(falha.wording).toBeUndefined();
    expect(falha.message).toBe(pt["error.unavailable"]);
  });
});

describe("procedência da cópia do contrato do backend", () => {
  it("a cópia enxerga o contrato inteiro, e não um pedaço dele", () => {
    expect(Object.keys(CLASSES).length).toBe(192);
  });

  /**
   * Oportunista de propósito — o mesmo desenho de
   * `message-codes-de-sucesso.test.ts`: exigir o repositório vizinho seria um
   * teste que só passa em quem tem os dois clonados. Como AVISO, é o que
   * impede a cópia de envelhecer calada.
   */
  it.skipIf(fixtureOriginal() === undefined)(
    "a cópia está idêntica ao contrato do backend, quando os dois repositórios estão lado a lado",
    () => {
      const original = fixtureOriginal();
      if (original === undefined) return;

      expect(
        JSON.parse(readFileSync(original, "utf8")),
        `cópia defasada: rode "cp ${original} tests/architecture/a-recusa-fala-o-idioma-de-quem-le.fixture.json"`,
      ).toEqual(contratoDoBackend);
    },
  );
});

/**
 * O backend QUE CORRESPONDE A ESTE CHECKOUT — worktree espelho primeiro, main
 * depois. A frota trabalha em worktrees, e comparar worktree com main acusaria
 * defasagem em toda fatia de contrato, que é justamente quando o aviso precisa
 * ser confiável.
 */
function fixtureOriginal(): string | undefined {
  const partes = fileURLToPath(import.meta.url).split(sep);
  const emWorktree = partes.lastIndexOf(".worktrees");
  if (emWorktree !== -1) {
    const raizDosRepos = partes.slice(0, emWorktree - 1).join(sep);
    const fatia = partes[emWorktree + 1];
    if (fatia !== undefined) {
      const alvo = join(
        raizDosRepos,
        "backend",
        ".worktrees",
        fatia,
        ORIGEM_DA_COPIA.slice("backend/".length),
      );
      if (existsSync(alvo)) return alvo;
    }
  }
  let diretorio = dirname(fileURLToPath(import.meta.url));
  for (let subida = 0; subida < 8; subida += 1) {
    const alvo = join(diretorio, ORIGEM_DA_COPIA);
    if (existsSync(alvo)) return alvo;
    const pai = dirname(diretorio);
    if (pai === diretorio) return undefined;
    diretorio = pai;
  }
  return undefined;
}
