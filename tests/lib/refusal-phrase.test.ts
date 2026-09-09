import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { defaultRefusalPhrase } from "@/lib/refusal-phrase";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * A RECUSA FALA O IDIOMA DE QUEM LÊ — a metade que compõe a frase.
 *
 * Dono, 2026-09-08, com a captura da tela em inglês: *"as notificações não
 * estão sendo traduzidas para inglês no idioma inglês; aproveite e faça uma
 * varredura do que pode ter ficado de fora"*. Os avisos foram consertados; a
 * varredura devolveu a RECUSA como maior item.
 *
 * O mecanismo estava medido: `ApiFailureReading` só cala o serviço no status
 * 0 e acima de 500, então 400, 401, 403, 404, 409, 412 e 428 imprimiam
 * `body.message` literal — a frase que o backend escreve, e o backend só
 * escreve pt-BR. "profissional não encontrado" chegava assim ao navegador de
 * quem escolheu inglês.
 *
 * Aqui a frase deixa de vir pronta e passa a NASCER na tela, a partir do
 * `code` e das peças (`wording`) — o mesmo desenho do `NoticePhrase`, e de
 * propósito: uma regra por código, uma frase por chave, e a chave do
 * dicionário escolhida pela PEÇA quando a sentença muda de forma.
 *
 * O "não encontrado" é o caso que ensina por que a escolha é de CHAVE: em
 * português a frase concorda em gênero com o recurso ("profissional não
 * encontrado" × "capacidade não encontradA"), e o servidor colava sempre o
 * masculino. Uma frase por recurso resolve os dois idiomas de uma vez, sem
 * ninguém montar sufixo em código.
 */
const traduzir = (dicionario: Record<string, string>) => (chave: string) =>
  dicionario[chave] ?? `«${chave}»`;

const emPortugues = traduzir(pt as Record<string, string>);
const emIngles = traduzir(en as Record<string, string>);

describe("a recusa compõe a frase na tela, pelo código e pelas peças", () => {
  it("escolhe a frase do recurso que a peça nomeia, no idioma de quem lê", () => {
    const recusa = new ApiError(
      "profissional não encontrado",
      404,
      undefined,
      "NOT_FOUND",
      undefined,
      {
        wording: { entity: "professional" },
      },
    );

    expect(defaultRefusalPhrase.sentenceOf(recusa, emIngles)).toContain("professional");
    expect(defaultRefusalPhrase.sentenceOf(recusa, emIngles)).not.toContain("profissional");
    expect(defaultRefusalPhrase.sentenceOf(recusa, emPortugues)).toContain("profissional");
  });

  /**
   * A regressão que esta fatia veio fechar, dita como teste: a frase do
   * servidor não pode aparecer na tela de quem lê em inglês.
   */
  it("a frase do servidor NÃO é o que a tela mostra", () => {
    const recusa = new ApiError("time não encontrado", 404, undefined, "NOT_FOUND", undefined, {
      wording: { entity: "team" },
    });

    expect(defaultRefusalPhrase.sentenceOf(recusa, emIngles)).not.toBe("time não encontrado");
  });

  /**
   * O gênero é da CHAVE, nunca de sufixo montado — a mesma lição que o plural
   * ensinou na fatia dos avisos. "capacidade não encontradO" é o que a
   * concatenação do servidor produzia.
   */
  it("cada recurso tem a própria frase, e o português concorda com ela", () => {
    const recusaDe = (entity: string) =>
      new ApiError("não encontrado", 404, undefined, "NOT_FOUND", undefined, {
        wording: { entity },
      });

    expect(defaultRefusalPhrase.sentenceOf(recusaDe("capability"), emPortugues)).toMatch(
      /esta capacidade/,
    );
    expect(defaultRefusalPhrase.sentenceOf(recusaDe("professional"), emPortugues)).toMatch(
      /este profissional/,
    );
  });

  /**
   * A RESERVA. O `entity` é contrato extensível: o backend estreia um recurso
   * e a tela aprende a frase dele depois. Sem esta linha, o dia da estreia
   * seria a chave crua na tela.
   */
  it("recurso que a tela ainda não conhece cai na frase geral do 'não encontrado'", () => {
    const desconhecido = new ApiError(
      "coisa nova não encontrada",
      404,
      undefined,
      "NOT_FOUND",
      undefined,
      {
        wording: { entity: "coisaQueAindaNaoExiste" },
      },
    );

    expect(defaultRefusalPhrase.sentenceOf(desconhecido, emPortugues)).toBe(pt["error.notFound"]);
  });

  it("404 sem peça nenhuma também tem frase — o corpo antigo não quebra a tela", () => {
    const semPecas = new ApiError("algo não encontrado", 404, undefined, "NOT_FOUND");

    expect(defaultRefusalPhrase.sentenceOf(semPecas, emPortugues)).toBe(pt["error.notFound"]);
  });

  it("o dialeto do framework fala pelas duas línguas, e não pela frase do servidor", () => {
    const corpoVazio = new ApiError(
      "O conteúdo enviado não pode ser vazio.",
      400,
      undefined,
      "EMPTY_REQUEST_BODY",
    );

    expect(defaultRefusalPhrase.sentenceOf(corpoVazio, emIngles)).not.toContain("conteúdo");
    expect(defaultRefusalPhrase.sentenceOf(corpoVazio, emIngles)).not.toBeNull();
  });

  it("a recusa do banco fala pelas duas línguas — o nome da constraint não vira frase", () => {
    const duplicado = new ApiError(
      "Já existe um registro com esse identificador",
      409,
      undefined,
      "UNIQUE_VIOLATION",
    );

    expect(defaultRefusalPhrase.sentenceOf(duplicado, emIngles)).not.toContain("Já existe");
    expect(defaultRefusalPhrase.sentenceOf(duplicado, emPortugues)).not.toBeNull();
  });

  /**
   * A política diz "não sei" em vez de inventar. Quem chama é que decide o
   * que fazer com isso — hoje, mostrar a frase do serviço, que é o que a
   * catraca de dívida conta.
   */
  it("código que a política não conhece devolve null, em vez de uma frase errada", () => {
    const recusaDeNegocio = new ApiError(
      "Esta avaliação já foi concluída e está bloqueada para edição.",
      409,
      undefined,
      "ASSESSMENT_LOCKED",
    );

    expect(defaultRefusalPhrase.sentenceOf(recusaDeNegocio, emPortugues)).toBeNull();
  });

  it("o que não é recusa do serviço não tem código para ler", () => {
    expect(defaultRefusalPhrase.sentenceOf(new Error("boom"), emPortugues)).toBeNull();
    expect(defaultRefusalPhrase.sentenceOf(undefined, emPortugues)).toBeNull();
  });
});

/**
 * O item 3 da ordem: **os dois catálogos terminam com o mesmo conjunto de
 * chaves**. O teste vizinho de i18n compara pt com en e não pegaria a ausência
 * dos DOIS — uma chave que falta nos dois está em paridade perfeita. Aqui cada
 * chave que a política pode pedir é cobrada nome a nome, nos dois dicionários.
 */
describe("toda frase que a política pode pedir existe nas duas línguas", () => {
  it("nenhuma chave da política falta em pt ou em en", () => {
    const dicionarios: ReadonlyArray<readonly [string, Record<string, string>]> = [
      ["pt", pt as Record<string, string>],
      ["en", en as Record<string, string>],
    ];
    const ausentes = dicionarios.flatMap(([idioma, dicionario]) =>
      defaultRefusalPhrase
        .messageKeys()
        .filter((chave) => typeof dicionario[chave] !== "string")
        .map((chave) => `${idioma}:${chave}`),
    );

    expect(ausentes).toEqual([]);
  });

  it("nenhuma frase da política sai vazia em qualquer das duas línguas", () => {
    const vazias = [
      ...defaultRefusalPhrase.messageKeys().map((chave) => `pt:${chave}:${emPortugues(chave)}`),
      ...defaultRefusalPhrase.messageKeys().map((chave) => `en:${chave}:${emIngles(chave)}`),
    ].filter((linha) => linha.endsWith(":") || linha.includes("«"));

    expect(vazias).toEqual([]);
  });

  /** Catraca não pode ser decorativa: a política precisa cobrir alguma coisa. */
  it("a política conhece os códigos que esta fatia migrou", () => {
    expect(defaultRefusalPhrase.phrasedCodes()).toContain("NOT_FOUND");
    expect(defaultRefusalPhrase.messageKeys().length).toBeGreaterThan(30);
  });
});
