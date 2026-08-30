import { describe, expect, it } from "vitest";

import en from "../../src/locales/en.json";
import pt from "../../src/locales/pt.json";

/**
 * O QA de integração da onda 19 derrubou a conectividade do banco e viu o que
 * o usuário final vê: a tela de login com "Backend indisponível. Suba a API
 * com `docker compose up -d`." Instrução de desenvolvedor entregue a quem só
 * queria entrar no sistema.
 *
 * A casa já resolve isso no `ConnectionError` (`store.tsx`), que separa a
 * mensagem ao usuário da dica de dev por `import.meta.env.DEV`. O que faltava
 * era a régua: chave de usuário não fala de container, de porta nem de script.
 * Chave terminada em `.dev` é a exceção declarada — ela só é renderizada sob
 * `import.meta.env.DEV`.
 */
const MARCAS_DE_DESENVOLVEDOR = [
  "docker",
  "npm run",
  "localhost",
  "VITE_",
  "127.0.0.1",
  "node_modules",
  ".env",
];

describe("mensagem de usuário não é mensagem de desenvolvedor", () => {
  const locales: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["pt", pt as Record<string, string>],
    ["en", en as Record<string, string>],
  ];

  for (const [nome, dicionario] of locales) {
    it(`nenhuma chave de usuário do ${nome} carrega instrução de desenvolvedor`, () => {
      const infratoras = Object.entries(dicionario)
        .filter(([chave]) => !chave.endsWith(".dev"))
        .filter(([, texto]) =>
          MARCAS_DE_DESENVOLVEDOR.some((marca) =>
            texto.toLowerCase().includes(marca.toLowerCase()),
          ),
        )
        .map(([chave, texto]) => `${chave}: ${texto}`);

      expect(infratoras).toEqual([]);
    });
  }

  it("as duas línguas declaram exatamente as mesmas chaves de dev", () => {
    const chavesDev = (dicionario: Record<string, string>) =>
      Object.keys(dicionario)
        .filter((chave) => chave.endsWith(".dev"))
        .sort();

    expect(chavesDev(pt as Record<string, string>)).toEqual(
      chavesDev(en as Record<string, string>),
    );
  });
});
