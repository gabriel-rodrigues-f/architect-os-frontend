import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * **Este repositório é PÚBLICO.** A auditoria de segurança de 2026-09-03
 * confirmou: `architect-os-frontend` é público; backend, infra e direção são
 * privados. Senha literal aqui é senha publicada — e o histórico do git não
 * esquece, então o estrago não se desfaz apagando a linha depois.
 *
 * Foi exatamente o que aconteceu: ao consertar o harness de entrega, a senha
 * dos quatro perfis de seed entrou como valor padrão em `scripts/e2e-nav.sh`
 * e foi publicada. Esta catraca existe para que a próxima onda não repita.
 *
 * O que ela proíbe: valor literal em variável cujo NOME diz que é segredo. O
 * que ela permite: ler do ambiente (`${VAR}`), exigir que venha de fora, e
 * falar sobre senha em texto de tela ou em comentário — a regra é sobre
 * ATRIBUIÇÃO, não sobre a palavra.
 */
const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const PASTAS_IGNORADAS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".output",
  ".nitro",
  "coverage",
  "playwright-report",
  "test-results",
  ".worktrees",
]);

const EXTENSOES = [".sh", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".env"];

/**
 * Fora da varredura, com motivo:
 * - `package-lock.json`: hash de integridade não é segredo, e é imenso;
 * - `src/locales/*`: é texto de TELA — ali a palavra "senha" tem de aparecer;
 * - `e2e/` e `tests/`: a massa de teste cria contas efêmeras em banco efêmero,
 *   e a senha delas é declaradamente de mentira. O que esta catraca defende é a
 *   senha que abre conta DE VERDADE — a de script de operação e a de `src/`.
 */
const FORA_DA_VARREDURA = ["package-lock.json", `${"src"}/locales/`, `${"e2e"}/`, `${"tests"}/`];

/** Nome que anuncia segredo: senha, token, chave, credencial. */
const NOME_DE_SEGREDO = "(PASSWORD|SENHA|SECRET|API_?KEY|CREDENTIAL|PASSWD)";

/**
 * Atribuição com valor literal. `${...}` no valor é leitura de ambiente e
 * passa; string vazia passa (é placeholder explícito); e a forma
 * `${VAR:-${OUTRA}}` também passa, porque continua vindo de fora.
 */
const ATRIBUICOES_SUSPEITAS: readonly { nome: string; padrao: RegExp }[] = [
  {
    nome: 'shell: VARIAVEL_DE_SEGREDO="literal"',
    padrao: new RegExp(`\\b\\w*${NOME_DE_SEGREDO}\\w*=["']([^"'$\\n]{4,})["']`, "i"),
  },
  {
    nome: "shell: ${VARIAVEL_DE_SEGREDO:-literal}",
    padrao: new RegExp(`\\$\\{\\w*${NOME_DE_SEGREDO}\\w*:-([^}$\\n]{4,})\\}`, "i"),
  },
  {
    // O nome TERMINA no vocabulário de segredo (`senhaDoAdmin`, `API_KEY`), e o
    // valor não tem espaço: `autoComplete="new-password"` e texto de tela ficam
    // de fora, que é o que separa catraca de ruído.
    nome: 'código: nomeDeSegredo = "literal"',
    padrao: new RegExp(
      `(?<![-\\w])\\w*${NOME_DE_SEGREDO}["']?\\s*[:=]\\s*["']([^"'$\\s]{6,})["']`,
      "i",
    ),
  },
];

function arquivosDoRepositorio(pasta: string): string[] {
  return readdirSync(pasta).flatMap((entrada) => {
    if (PASTAS_IGNORADAS.has(entrada)) return [];
    const caminho = join(pasta, entrada);
    if (statSync(caminho).isDirectory()) return arquivosDoRepositorio(caminho);
    return EXTENSOES.some((extensao) => entrada.endsWith(extensao)) ? [caminho] : [];
  });
}

/** O teste desta catraca fala de senha o tempo todo; ele é o próprio oráculo. */
const ARQUIVOS_QUE_FALAM_DE_SENHA_SEM_TER_UMA = new Set([
  join(raizDoRepositorio, "tests", "architecture", "nenhuma-senha-no-repositorio-publico.ts"),
  import.meta.filename ?? "",
]);

describe("repositório público — nenhuma senha literal", () => {
  it("nenhum arquivo atribui valor literal a variável de segredo", () => {
    const achados = arquivosDoRepositorio(raizDoRepositorio)
      .filter((caminho) => !ARQUIVOS_QUE_FALAM_DE_SENHA_SEM_TER_UMA.has(caminho))
      .filter((caminho) => !FORA_DA_VARREDURA.some((trecho) => caminho.includes(trecho)))
      .flatMap((caminho) =>
        readFileSync(caminho, "utf8")
          .split("\n")
          .flatMap((linha, indice) =>
            ATRIBUICOES_SUSPEITAS.filter(({ padrao }) => padrao.test(linha)).map(
              ({ nome }) => `${caminho.replace(raizDoRepositorio, ".")}:${indice + 1} — ${nome}`,
            ),
          ),
      );

    expect(achados).toEqual([]);
  });

  it("a catraca pega a atribuição que já foi publicada uma vez", () => {
    const publicadaEm2026 = 'export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-Synaps#1234}"';

    expect(ATRIBUICOES_SUSPEITAS.some(({ padrao }) => padrao.test(publicadaEm2026))).toBe(true);
  });

  it("ler do ambiente continua permitido — a regra é sobre valor literal", () => {
    const doAmbiente = 'export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD}"';
    const vazio = 'export E2E_ADMIN_PASSWORD=""';
    const deOutraVariavel =
      'export E2E_MEMBER_PASSWORD="${E2E_MEMBER_PASSWORD:-${E2E_ADMIN_PASSWORD-}}"';

    for (const permitido of [doAmbiente, vazio, deOutraVariavel]) {
      expect(ATRIBUICOES_SUSPEITAS.some(({ padrao }) => padrao.test(permitido))).toBe(false);
    }
  });
});
