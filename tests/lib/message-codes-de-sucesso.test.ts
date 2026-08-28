import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n";
import { successMessageOf } from "@/lib/success-message";
import pt from "@/locales/pt.json";

import inventarioDoBackend from "./message-codes-de-sucesso.fixture.json";

/**
 * ARQ-18, metade (b) — o lado CONSUMIDOR dos `messageCode` de sucesso.
 *
 * O backend fechou a metade emissora em
 * `backend/tests/shared/http/message-codes-de-sucesso.test.ts` e declarou, no
 * ADR-0023 daquele repositório, que provar a existência da chave do outro lado
 * é fatia daqui: `backend/.git` e `frontend/.git` são repositórios separados e
 * a CI faz checkout de um só, então um teste do backend que lesse este locale
 * só passaria na máquina de quem tem os dois clonados lado a lado.
 *
 * O defeito é falha silenciosa por construção. `successMessageOf` monta
 * `msg.${code}` e faz `key in baseMessages ? key : fallback`. Renomear um
 * código no backend, ou esquecer a chave aqui, não gera erro de compilação,
 * não gera lint e não gera log: o toast degrada para o texto genérico do
 * fallback e ninguém percebe. Este arquivo é o único lugar do repositório que
 * fica vermelho quando isso acontece.
 *
 * A verificação passa pelo caminho real — `ApiClient` desembrulha o envelope,
 * guarda o código no `WeakMap` e `successMessageOf` resolve — e não por
 * comparação direta de duas listas de string. É a corrente inteira que precisa
 * continuar ligada, não só o dicionário.
 *
 * ## De onde vem `message-codes-de-sucesso.fixture.json`
 *
 * É **cópia byte a byte** do fixture do backend, que é a fonte da verdade dos
 * códigos emitidos. Existe uma cópia aqui porque nenhum dos dois repositórios
 * pode ler o outro na CI. Atualizar é uma linha, a partir da raiz deste repo:
 *
 * ```
 * cp ../backend/tests/shared/http/message-codes-de-sucesso.fixture.json \
 *    tests/lib/message-codes-de-sucesso.fixture.json
 * ```
 *
 * Cópia que envelhece calada é pior que cópia nenhuma, então há duas defesas:
 * o canário de contagem (`CODIGOS_ESPERADOS`), que obriga a olhar quando o
 * backend ganha ou perde um código, e a comparação oportunista contra o
 * fixture original — ela roda quando os dois repositórios estão lado a lado,
 * que é o caso da máquina de quem desenvolve, e se anuncia como pulada quando
 * só este repositório está clonado.
 */

const CODIGOS_ESPERADOS = 53;

const PREFIXO_DE_MENSAGEM = "msg.";

const ORIGEM_DA_COPIA = "backend/tests/shared/http/message-codes-de-sucesso.fixture.json";

/**
 * Os códigos que o backend emite e que este locale NÃO traduz hoje. A lista é
 * canário, não permissão: um terceiro nome aqui é dívida nova, e um nome que
 * saia daqui é dívida paga — as duas coisas passam por uma edição consciente
 * deste arquivo.
 *
 * Estes dois estão nomeados no ADR-0023 do backend com o mesmo veredito:
 * consertar exige mexer nos dois repositórios no mesmo movimento (renomear o
 * código lá OU acrescentar as chaves aqui), o que é mudança de contrato e não
 * cabe num lado só.
 */
const CODIGOS_SEM_TRADUCAO: readonly string[] = [
  "auth.user.create.success",
  "auth.user.update.success",
];

/**
 * As chaves `msg.*` que este locale define e que nenhum código emitido produz.
 * O caminho inverso importa pelo mesmo motivo: chave que ninguém alcança é
 * tradução morta, e tradução morta esconde a chave viva que falta.
 *
 * `msg.user.update.success` não é lixo puro — `src/routes/users.tsx:65` a passa
 * à mão como fallback, e é por isso que aquele toast mostra o texto certo
 * apesar de `auth.user.update.success` não resolver. `msg.user.create.success`
 * não é referenciada em lugar nenhum.
 *
 * **Não apagar por conta própria.** As duas são o outro lado exato dos dois
 * códigos sem tradução: apagá-las ou renomeá-las é a mesma mudança de
 * contrato, e ela decide qual lado cede.
 */
const CHAVES_SEM_EMISSOR: readonly string[] = [
  "msg.user.create.success",
  "msg.user.update.success",
];

const FALLBACK_GENERICO = "users.title" as MessageKey;

interface EntradaDoBackend {
  readonly rota: string;
  readonly arquivo: string;
  readonly linha: number;
  readonly resposta: string;
  readonly consumidorAusente?: boolean;
}

const CODIGOS_EMITIDOS: Readonly<Record<string, EntradaDoBackend>> = inventarioDoBackend.codigos;

/**
 * O número da linha é artefato de edição, não contrato: qualquer mexida no
 * backend o move e quebraria o build do frontend por ruído. O que precisa
 * casar é o conjunto de códigos e, para cada um, a rota, o arquivo e a forma
 * da resposta — isso sim é o que o frontend consome.
 */
function semLinhas(codigos: Readonly<Record<string, EntradaDoBackend>>): unknown {
  return Object.fromEntries(
    Object.entries(codigos).map(([code, entrada]) => {
      const { linha: _linha, ...contrato } = entrada;
      return [code, contrato];
    }),
  );
}

const TRADUCOES: Readonly<Record<string, string>> = pt;

const chavesDeMensagem = (): string[] =>
  Object.keys(TRADUCOES).filter((chave) => chave.startsWith(PREFIXO_DE_MENSAGEM));

const codigoDaChave = (chave: string): string => chave.slice(PREFIXO_DE_MENSAGEM.length);

function fixtureOriginal(): string | undefined {
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

const fetchMock = vi.fn();

/**
 * Reproduz o que o backend põe no fio: `HttpResponder.ok/created` guardam o
 * código, o hook de `preSerialization` devolve `{ data, message: { code } }`.
 */
async function respostaComCodigo(code: string): Promise<unknown> {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ data: { id: "x1" }, message: { code } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  return new ApiClient("http://api.local").post<{ id: string }>("/qualquer-rota", {});
}

describe("ARQ-18 — todo messageCode que o backend emite tem tradução aqui", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("o toast resolve o código emitido, em vez de degradar para o texto genérico", async () => {
    const degradaram: string[] = [];

    for (const [code, entrada] of Object.entries(CODIGOS_EMITIDOS)) {
      if (CODIGOS_SEM_TRADUCAO.includes(code)) continue;

      const resolvida = successMessageOf(await respostaComCodigo(code), FALLBACK_GENERICO);
      if (resolvida !== `${PREFIXO_DE_MENSAGEM}${code}`) {
        degradaram.push(`${code} (${entrada.rota}, ${entrada.arquivo}:${String(entrada.linha)})`);
      }
    }

    expect(degradaram, `sem chave "${PREFIXO_DE_MENSAGEM}<code>" em src/locales/pt.json`).toEqual(
      [],
    );
  });

  it("os códigos sem tradução são exatamente os declarados", () => {
    const ausentes = Object.keys(CODIGOS_EMITIDOS).filter(
      (code) => !(`${PREFIXO_DE_MENSAGEM}${code}` in TRADUCOES),
    );

    expect(ausentes).toEqual([...CODIGOS_SEM_TRADUCAO]);
  });

  it("o fixture e este locale concordam sobre quais códigos estão quebrados", () => {
    const marcadosPeloBackend = Object.entries(CODIGOS_EMITIDOS)
      .filter(([, entrada]) => entrada.consumidorAusente === true)
      .map(([code]) => code);

    expect(marcadosPeloBackend).toEqual([...CODIGOS_SEM_TRADUCAO]);
  });
});

describe("ARQ-18 — chaves de tradução que nenhum código emite", () => {
  it("as chaves mortas são exatamente as declaradas", () => {
    const mortas = chavesDeMensagem().filter(
      (chave) => !(codigoDaChave(chave) in CODIGOS_EMITIDOS),
    );

    expect(mortas).toEqual([...CHAVES_SEM_EMISSOR]);
  });

  it("toda chave de mensagem que não está na lista morta tem emissor no backend", () => {
    const orfas = chavesDeMensagem()
      .filter((chave) => !CHAVES_SEM_EMISSOR.includes(chave))
      .filter((chave) => !(codigoDaChave(chave) in CODIGOS_EMITIDOS));

    expect(orfas).toEqual([]);
  });
});

describe("ARQ-18 — procedência da cópia do fixture do backend", () => {
  it("a cópia enxerga os 53 códigos que o backend declara emitir", () => {
    expect(Object.keys(CODIGOS_EMITIDOS)).toHaveLength(CODIGOS_ESPERADOS);
  });

  it("todo código do fixture nomeia a rota, o arquivo e a linha que o emitem", () => {
    for (const [code, entrada] of Object.entries(CODIGOS_EMITIDOS)) {
      expect(entrada.rota, code).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \//);
      expect(entrada.arquivo, code).toMatch(/\.controller\.ts$/);
      expect(entrada.linha, code).toBeGreaterThan(0);
    }
  });

  /**
   * Oportunista de propósito. Exigir o repositório vizinho seria o teste que o
   * ADR-0023 recusou — o que só passa em quem tem os dois clonados. Como aviso,
   * porém, ele é exatamente o que impede a cópia de envelhecer calada: na
   * máquina de quem desenvolve, uma divergência aparece no `npm test`.
   */
  it.skipIf(fixtureOriginal() === undefined)(
    "a cópia está idêntica ao fixture do backend, quando os dois repositórios estão lado a lado",
    () => {
      const original = fixtureOriginal();
      if (original === undefined) return;

      expect(
        semLinhas(
          (
            JSON.parse(readFileSync(original, "utf8")) as {
              codigos: Record<string, EntradaDoBackend>;
            }
          ).codigos,
        ),
        `cópia defasada: rode "cp ${original} tests/lib/message-codes-de-sucesso.fixture.json"`,
      ).toEqual(semLinhas(CODIGOS_EMITIDOS));
    },
  );
});
