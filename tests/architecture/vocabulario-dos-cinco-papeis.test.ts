import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * O VOCABULÁRIO DOS CINCO PAPÉIS — catraca de baseline ZERO, irmã da que o
 * backend guarda em `tests/architecture/vocabulario-dos-cinco-papeis.test.ts`.
 *
 * Dono (2026-09-06, regra 7), literal: *"Não quero que exista um perfil
 * 'Diretoria'. Renomeie para administrador, tanto frontend e backend. Teremos
 * então: administrador, suporte, gerente, tech lead e profissional."*
 *
 * Os VALORES técnicos não mudam — `admin`, `support`, `manager`, `tech_lead`
 * e `member` continuam sendo o que a sessão traz e o que a política pergunta.
 * O que muda é o NOME que a pessoa lê. Por isso a régua olha duas coisas:
 *
 *  1. o nome morto não sobrou em `src/` nem em `tests/` — nem como rótulo,
 *     nem como prosa de comentário, nem em inglês ("Directors");
 *  2. os cinco nomes estão escritos, em pt e en, no ponto único onde a tela
 *     lê o papel (`users.role.*`).
 */
const NOME_MORTO = /diretoria|\bdirectors\b/i;
/** A régua não é contada por ela — é o único lugar onde o nome morto pode ser citado. */
const DONA_DA_REGUA = "vocabulario-dos-cinco-papeis.test.ts";

const raizDoFrontend = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const arquivosDe = (pasta: string): string[] =>
  readdirSync(join(raizDoFrontend, pasta), { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile() && /\.(tsx?|json)$/.test(entrada.name))
    .map((entrada) => relative(raizDoFrontend, join(entrada.parentPath, entrada.name)))
    .filter((caminho) => !caminho.endsWith(DONA_DA_REGUA))
    .sort();

type Catalogo = Record<string, string>;

const NOMES_DOS_PAPEIS: Record<string, { pt: string; en: string }> = {
  admin: { pt: "Administrador", en: "Administrator" },
  support: { pt: "Suporte", en: "Support" },
  manager: { pt: "Gerente", en: "Manager" },
  tech_lead: { pt: "Tech Lead", en: "Tech Lead" },
  member: { pt: "Profissional", en: "Professional" },
};

describe("os cinco papéis têm os nomes que o dono ditou", () => {
  it("nenhum arquivo de `src/` ou `tests/` escreve o nome morto", () => {
    const infratores = [...arquivosDe("src"), ...arquivosDe("tests")].filter((caminho) =>
      NOME_MORTO.test(readFileSync(join(raizDoFrontend, caminho), "utf8")),
    );

    expect(infratores).toEqual([]);
  });

  it("a régua reconhece o nome morto em qualquer caixa e nos dois idiomas", () => {
    expect(NOME_MORTO.test('"users.role.admin": "Diretoria"')).toBe(true);
    expect(NOME_MORTO.test("a diretoria lê a organização inteira")).toBe(true);
    expect(NOME_MORTO.test('"users.role.admin": "Directors"')).toBe(true);
    expect(NOME_MORTO.test('"users.role.admin": "Administrador"')).toBe(false);
  });

  for (const [papel, nomes] of Object.entries(NOMES_DOS_PAPEIS)) {
    it(`\`${papel}\` chama-se "${nomes.pt}" em pt e "${nomes.en}" em en`, () => {
      expect((pt as Catalogo)[`users.role.${papel}`]).toBe(nomes.pt);
      expect((en as Catalogo)[`users.role.${papel}`]).toBe(nomes.en);
    });
  }

  it("o papel do profissional não se chama mais pelo nome de lista de e-mail", () => {
    expect((pt as Catalogo)["users.role.member"]).not.toBe("Membro");
    expect((en as Catalogo)["users.role.member"]).not.toBe("Member");
  });
});
