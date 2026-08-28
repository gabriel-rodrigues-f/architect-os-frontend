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
