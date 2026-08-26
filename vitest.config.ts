import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Config próprio: o vite.config.ts do app carrega o preset da Lovable (TanStack
// Start + nitro), que não é necessário — nem saudável — dentro dos testes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // jsdom para os testes que renderizam componentes de tela.
    environment: "jsdom",
    setupFiles: ["./tests/test-setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-36 (§33, achado 3)
    // — "sem coverage report configurado" em nenhuma das duas pontas.
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/routeTree.gen.ts"],
    },
  },
});
