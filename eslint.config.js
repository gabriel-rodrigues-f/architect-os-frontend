import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * QA-11d — `any` escrito à mão é zero nos dois repositórios; estas regras
 * congelam a propriedade em vez de deixá-la dependendo de vigilância.
 * `src/routeTree.gen.ts` é GERADO pelo plugin do TanStack Router e tem 18
 * `any` que não são nossos: fica de fora do lint, não "corrigido".
 */
const UNSAFE_ANY_RULES = {
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
};

/**
 * Dívida pré-existente das fronteiras não tipadas (Sentry, `import.meta.env`,
 * `window.__TSR__`): fica como aviso, com contagem visível, até a fronteira
 * ganhar schema. Nenhuma delas é código desta onda.
 */
const UNSAFE_ANY_RULES_AS_WARNINGS = Object.fromEntries(
  Object.keys(UNSAFE_ANY_RULES).map((rule) => [rule, "warn"]),
);

/**
 * CQ-03 — nome de uma letra esconde o que o valor é. A regra é para código NOVO:
 * as ocorrências de hoje (quase todas parâmetros de callback em cadeias
 * `.map`/`.filter`, cuja renomeação em massa o dono descartou por ser ruído)
 * estão registradas em `eslint-suppressions.json`, um livro-razão com contagem
 * por arquivo que só encolhe. `error` em vez de `warn` porque a supressão em
 * lote deixa o gate vermelho para o nome novo sem afogar a saída do lint em
 * ~950 avisos que ninguém leria.
 *
 * `t` é o tradutor do i18n e `_` é o descarte explícito: vocabulário
 * estabelecido, não abreviação preguiçosa.
 */
const NOMES_CURTOS_ESTABELECIDOS = ["t", "_"];

/**
 * Nos arquivos de cor as letras SÃO o vocabulário da especificação: `l`/`c`/`h`
 * são os eixos do OKLCH, `a`/`b` os do OKLab, `l`/`m`/`s` as respostas dos cones
 * e `r`/`g`/`b` os canais lineares. Renomear afasta o código da referência que
 * ele implementa em vez de aproximá-lo do leitor.
 */
const CANAIS_DE_COR = ["l", "c", "h", "a", "b", "m", "s", "r", "g"];

const ARQUIVOS_DE_COR = ["src/lib/design/color.ts", "src/lib/accessibility/color-vision.ts"];

export default tseslint.config(
  { ignores: ["dist", ".output", ".worktrees", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "id-length": [
        "error",
        { min: 2, properties: "never", exceptions: NOMES_CURTOS_ESTABELECIDOS },
      ],
    },
  },
  {
    files: ARQUIVOS_DE_COR,
    rules: {
      "id-length": [
        "error",
        {
          min: 2,
          properties: "never",
          exceptions: [...NOMES_CURTOS_ESTABELECIDOS, ...CANAIS_DE_COR],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: UNSAFE_ANY_RULES,
  },
  {
    files: [
      "src/lib/api-client.ts",
      "src/lib/error-tracking.client.ts",
      "src/lib/error-tracking.server.ts",
      "src/routes/__root.tsx",
      "tests/**/*.{ts,tsx}",
    ],
    rules: UNSAFE_ANY_RULES_AS_WARNINGS,
  },
  eslintPluginPrettier,
);
