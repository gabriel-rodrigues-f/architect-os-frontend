import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Deriva a lista de rotas DIRETO de `src/routes/` (file-based routing do
 * TanStack Router), em vez de manter uma lista à mão. É a lição da matriz
 * de permissão do backend: rede que congela ausência não é rede — rota
 * nova sem cobertura declarada tem que FALHAR o teste de cobertura em
 * `navigation-capture.spec.ts`, não passar em silêncio.
 *
 * Convenções espelhadas do router:
 *   `__root.tsx`  → não é rota navegável (layout raiz)
 *   `index.tsx`   → `/`
 *   `a.b.tsx`     → `/a/b` (ponto separa segmento)
 *   `a.index.tsx` → `/a` (mesma URL do layout `a.tsx` — deduplicado)
 *   `dir/index.tsx` → `/dir` (convenção de DIRETÓRIO — o ponto cego que o QA provou: sem varredura recursiva, rota em pasta nascia invisível à rede)
 *   `$param`      → segmento dinâmico, preservado literal para o mapa de
 *                   visitas resolver com um id real
 */
const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes");

export function discoverRoutePaths(): string[] {
  const paths = new Set<string>();
  const walk = (dir: string, prefixo: readonly string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), [...prefixo, entry.name]);
        continue;
      }
      if (!entry.name.endsWith(".tsx") || entry.name === "__root.tsx") continue;
      const segments = [...prefixo, ...entry.name.slice(0, -".tsx".length).split(".")];
      if (segments.at(-1) === "index") segments.pop();
      paths.add(`/${segments.join("/")}`);
    }
  };
  walk(ROUTES_DIR, []);
  return [...paths].sort();
}
