import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RefusalNumber, type NamedAbsenceRoute } from "@/lib/refusal-number";
import { raizDoFrontend, Varredura } from "../helpers/catraca";

/**
 * A CATRACA QUE FALTAVA na regra 18 (dono, 2026-09-09).
 *
 * A verificação (`direcao/o-403-vira-404-2026-09-09.md`, §4) mediu o preço da
 * troca no frontend e achou o pior número de todos: **nenhum** dos 43 pontos
 * de teste do frontend fica vermelho quando o backend troca o status, porque
 * todos simulam a resposta do servidor. *"A mudança passa verde e cala, que é
 * pior do que quebrar."* Uma suíte inteira continuaria afirmando um produto
 * que não existe mais.
 *
 * Esta catraca é a resposta. Ela não simula resposta nenhuma: lê o código de
 * `src/` e afirma três coisas que o servidor não pode desfazer sozinho.
 *
 *  1. **Nenhuma linha de tela compara status com o número cru.** Quem lê 403
 *     ou 404 lê pela família (`RefusalNumber`), e a família tem nome, dono e
 *     motivo escrito. Enquanto o número estava solto em oito linhas, mudar a
 *     régua era caçar as oito de novo — e esquecer uma passava despercebido.
 *  2. **A lista de quem lê é fechada.** Cada arquivo que consulta o número
 *     está na fixture com o porquê. Um arquivo novo entrando na lista é uma
 *     decisão, não um acidente: ou ele reconhece um ATO (e fica em 403), ou
 *     reconhece ALCANCE (e passa a olhar 404).
 *  3. **A leitura de AUSÊNCIA é assinada por rota.** Depois da regra 18 o 404
 *     quer dizer duas coisas ao mesmo tempo, de propósito. Só as duas rotas
 *     que o dono deixou fora do lote — o quadro do time e a régua do nível —
 *     podem lê-lo como "ainda não existe"; em qualquer outra, engolir o 404
 *     faz a recusa sumir sem nada na tela.
 *
 * Nenhuma delas pode passar a distinguir pelo `code`: se o código separasse
 * alcance de inexistente, ele viraria o oráculo que o número deixou de ser, e
 * a regra voltaria ao começo.
 */

/** Comparação com o número cru — `status === 403`, `403 !== status`, e afins. */
const NUMERO_CRU_COMPARADO = /(?:[=!]==?\s*40[34]\b)|(?:\b40[34]\s*[=!]==?)/g;

const FIXTURE = join(raizDoFrontend, "tests", "architecture", "o-numero-da-recusa.fixture.json");

interface Baseline {
  readonly ato: Record<string, string>;
  readonly ausencia: Record<string, NamedAbsenceRoute>;
}

const baseline = JSON.parse(readFileSync(FIXTURE, "utf8")) as Baseline;

const varredura = new Varredura();

/** Onde o arquivo é o próprio dono da régua — ele pode escrever os números. */
const A_PROPRIA_REGUA = "src/lib/refusal-number.ts";

const ordenado = (chaves: readonly string[]): string[] => [...chaves].sort();

const arquivosQue = (padrao: RegExp): string[] =>
  ordenado(Object.keys(varredura.contagem((arquivo) => arquivo.ocorrencias(padrao))));

describe("o número da recusa tem nome, e a lista de quem o lê é fechada", () => {
  it("nenhuma linha de tela compara status com 403 ou 404 cru", () => {
    expect(arquivosQue(NUMERO_CRU_COMPARADO)).toEqual([]);
  });

  it("a régua reconhece a comparação e ignora o número que é dado", () => {
    expect("error.status === 403".match(NUMERO_CRU_COMPARADO)).toEqual(["=== 403"]);
    expect("if (404 !== s)".match(NUMERO_CRU_COMPARADO)).toEqual(["404 !=="]);
    expect('new ApiError("x", 404, undefined, "NOT_FOUND")'.match(NUMERO_CRU_COMPARADO)).toBeNull();
    expect("<h1>404</h1>".match(NUMERO_CRU_COMPARADO)).toBeNull();
  });

  it("quem lê a família está na fixture, e quem está na fixture lê a família", () => {
    const declarados = ordenado([...Object.keys(baseline.ato), ...Object.keys(baseline.ausencia)]);
    const leitores = arquivosQue(/\bRefusalNumber\b/g).filter(
      (arquivo) => arquivo !== A_PROPRIA_REGUA,
    );
    expect(leitores).toEqual(declarados);
  });

  it("cada leitor declara POR QUE lê o número que lê", () => {
    for (const [arquivo, motivo] of Object.entries(baseline.ato)) {
      expect(motivo.length, arquivo).toBeGreaterThan(30);
    }
  });
});

describe("o ato fica em 403 e o alcance passa a 404 — os dois números, congelados", () => {
  it("recusa de ato é 403: a frase do serviço é contrato e a tela a imprime", () => {
    expect(RefusalNumber.ACT).toBe(403);
  });

  it("recusa de alcance é 404, o mesmo de recurso inexistente — é o que fecha o oráculo", () => {
    expect(RefusalNumber.OUT_OF_REACH).toBe(404);
  });
});

describe("a leitura de ausência é assinada por rota", () => {
  it("só as duas exceções nomeadas pelo dono podem ler o 404 como ausência", () => {
    expect(RefusalNumber.namedAbsenceRoutes).toEqual(["quadro-do-time", "regua-do-nivel"]);
  });

  it("cada exceção diz o significado de negócio que o 404 já ocupava naquela rota", () => {
    for (const rota of RefusalNumber.namedAbsenceRoutes) {
      expect(RefusalNumber.absenceMeaningOf(rota), rota).toMatch(/^GET \/teams\/:teamId\//);
    }
  });

  it("nenhum arquivo fora da fixture assina uma exceção", () => {
    const assinantes = arquivosQue(/answersAbsenceOn\(/g).filter(
      (arquivo) => arquivo !== A_PROPRIA_REGUA,
    );
    expect(assinantes).toEqual(ordenado(Object.keys(baseline.ausencia)));
  });

  it("a rota que cada arquivo assina é a que a fixture declara", () => {
    for (const [arquivo, rota] of Object.entries(baseline.ausencia)) {
      const conteudo = readFileSync(join(raizDoFrontend, arquivo), "utf8");
      const assinaturas = [...conteudo.matchAll(/answersAbsenceOn\("([^"]+)"/g)].map(
        (achado) => achado[1],
      );
      expect(assinaturas.length, arquivo).toBeGreaterThan(0);
      expect(new Set(assinaturas), arquivo).toEqual(new Set([rota]));
    }
  });
});
