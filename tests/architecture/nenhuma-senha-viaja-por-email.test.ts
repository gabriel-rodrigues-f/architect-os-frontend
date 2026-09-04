import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * NENHUMA SENHA VIAJA POR E-MAIL — a catraca da correção do dono.
 *
 * Em 2026-09-04 ele pediu: *"quero poder resetar a senha do usuário / uma
 * senha inicial precisa ser enviada a ele por e-mail"*. E, ao escolher o
 * desenho, corrigiu O PRÓPRIO PEDIDO: **"a senha não deve ser enviada por
 * e-mail"**. O e-mail leva um LINK, e quem escolhe a senha é a pessoa.
 *
 * Um pedido que o dono corrige é o tipo que volta: quem ler o pedido original
 * num handoff daqui a três ondas vai escrever "sua senha inicial é ..." sem
 * saber da correção, e nada na tela denuncia isso — o texto fica bonito e a
 * regra fica quebrada. Esta é a rede, e ela existe porque a correção não pode
 * depender de alguém lembrar dela.
 *
 * A RÉGUA, e o que ela NÃO é: não é a proibição das palavras "senha" e
 * "e-mail" juntas — `password.requirement.ownEmail` ("não ter o seu e-mail
 * dentro dela") precisa das duas. É a proibição da SENHA COMO OBJETO de um
 * verbo de envio, nas duas ordens em que a frase pode sair: ativa ("enviamos
 * a senha") e passiva ("a senha foi enviada"), mais a forma curta com o
 * canal colado ("a senha por e-mail").
 *
 * ONDE ELA OLHA: os dois dicionários, que são o endereço de todo texto de
 * tela por definição — a mesma fronteira que a catraca vizinha
 * `mensagem-de-usuario-nao-e-de-desenvolvedor` já escolheu. Uma frase montada
 * em `src/` escaparia daqui, e escaparia da régua de i18n antes: texto de
 * tela nasce no dicionário.
 */

/** Artigos e determinantes que cabem entre o verbo e a palavra "senha". */
const DETERMINANTE_PT = "(?:a|as|uma|umas|sua|suas|essa|essas|esta|estas|nova|novas|inicial)\\s+";
const DETERMINANTE_EN = "(?:the|a|an|your|new|initial|temporary)\\s+";

const FRASES_PROIBIDAS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "ativa em pt — 'enviamos a senha'",
    new RegExp(`\\b(?:envi|mand|remet)\\w*\\s+(?:${DETERMINANTE_PT})*senhas?\\b`, "i"),
  ],
  [
    "passiva em pt — 'a senha foi enviada'",
    /\bsenhas?\b(?:\s+[^\s.]+){0,2}\s+(?:enviad|mandad|remetid)\w*/i,
  ],
  ["canal colado em pt — 'a senha por e-mail'", /\bsenhas?\b(?:\s+[^\s.]+){0,2}\s+por\s+e-?mail/i],
  [
    "ativa em en — 'we send the password'",
    new RegExp(
      `\\b(?:send|sends|sending|sent|email|emails|emailed|mail|mails|mailed)\\s+(?:${DETERMINANTE_EN})*passwords?\\b`,
      "i",
    ),
  ],
  [
    "passiva em en — 'the password was sent'",
    /\bpasswords?\b(?:\s+[^\s.]+){0,3}\s+(?:sent|emailed|mailed)\b/i,
  ],
  [
    "canal colado em en — 'the password by email'",
    /\bpasswords?\b(?:\s+[^\s.]+){0,2}\s+(?:by|via)\s+e-?mail/i,
  ],
];

const DICIONARIOS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["pt", pt as Record<string, unknown>],
  ["en", en as Record<string, unknown>],
];

describe("nenhuma tela diz que uma senha foi, é ou será enviada", () => {
  for (const [idioma, dicionario] of DICIONARIOS) {
    it(`nenhum texto do ${idioma} põe a senha como objeto de um envio`, () => {
      const infratoras = Object.entries(dicionario)
        .filter(([, valor]) => typeof valor === "string")
        .flatMap(([chave, valor]) =>
          FRASES_PROIBIDAS.filter(([, proibida]) => proibida.test(valor as string)).map(
            ([nome]) => `${idioma}:${chave} — ${nome} — "${valor as string}"`,
          ),
        );

      expect(
        infratoras,
        'o e-mail leva um LINK; a senha quem escolhe é a pessoa (dono, 2026-09-04: "a senha não deve ser enviada por e-mail")',
      ).toEqual([]);
    });
  }

  /**
   * O oráculo da própria catraca. Sem ele, um erro nas expressões acima a
   * deixaria verde para sempre — e uma rede que nunca pode ficar vermelha não
   * é rede.
   */
  it("a catraca pega a frase que o pedido original teria produzido", () => {
    const oPedidoAntesDaCorrecao = [
      "Enviamos a senha inicial para o e-mail dela.",
      "A senha temporária foi enviada por e-mail.",
      "Você vai receber a senha por e-mail.",
      "We emailed the initial password to them.",
      "The temporary password was sent to your inbox.",
      "You will receive your password by email.",
    ];

    for (const frase of oPedidoAntesDaCorrecao) {
      expect(
        FRASES_PROIBIDAS.some(([, proibida]) => proibida.test(frase)),
        frase,
      ).toBe(true);
    }
  });

  /**
   * E o outro lado do oráculo: o que a régua NÃO pode reprovar. Estas são as
   * frases que a aplicação precisa dizer — o link que viaja, a exigência que
   * fala do e-mail, o canal de fora que o cadastro usa.
   */
  it("a catraca deixa passar o que a aplicação precisa dizer", () => {
    const legitimas = [
      "Enviamos a {nome} o link para criar a senha. Ele vale por 1 hora.",
      "Se houver uma conta com esse e-mail, você recebe em instantes um link para criar a sua senha.",
      "não ter o seu e-mail dentro dela",
      "A senha nova não pode ter o seu e-mail dentro dela.",
      "Repasse a senha temporária por um canal fora da aplicação.",
      "We sent {nome} the link to create the password. It is valid for 1 hour.",
      "You will receive a link to create your password in a moment.",
      "The new password cannot contain your email address.",
    ];

    for (const frase of legitimas) {
      const pegas = FRASES_PROIBIDAS.filter(([, proibida]) => proibida.test(frase)).map(
        ([nome]) => nome,
      );
      expect(pegas, frase).toEqual([]);
    }
  });
});
