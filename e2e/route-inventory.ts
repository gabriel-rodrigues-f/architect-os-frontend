import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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
 *
 * Onda 19 — a varredura passou a devolver também os ARQUIVOS por rota
 * (`discoverRoutes`). Quem alcança uma rota é uma pergunta que só se
 * responde lendo a fonte dela, e reimplementar este mesmo `walk` no teste
 * de arquitetura seria a segunda ocorrência da mesma varredura
 * (`REGRAS.md` 6). `discoverRoutePaths` continua sendo a projeção que o
 * Playwright consome.
 */
const RAIZ_DO_REPOSITORIO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES_DIR = join(RAIZ_DO_REPOSITORIO, "src", "routes");

export interface DiscoveredRoute {
  /** `/a/b` — a URL que o router monta. */
  readonly path: string;
  /** Arquivos que compõem a rota, relativos à raiz do repositório. */
  readonly files: readonly string[];
}

export function discoverRoutes(): DiscoveredRoute[] {
  const files = new Map<string, string[]>();
  const walk = (dir: string, prefixo: readonly string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), [...prefixo, entry.name]);
        continue;
      }
      if (!entry.name.endsWith(".tsx") || entry.name === "__root.tsx") continue;
      const segments = [...prefixo, ...entry.name.slice(0, -".tsx".length).split(".")];
      if (segments.at(-1) === "index") segments.pop();
      const path = `/${segments.join("/")}`;
      const found = files.get(path) ?? [];
      found.push(relative(RAIZ_DO_REPOSITORIO, join(dir, entry.name)));
      files.set(path, found);
    }
  };
  walk(ROUTES_DIR, []);
  return [...files.entries()]
    .sort(([esquerda], [direita]) => esquerda.localeCompare(direita, "en"))
    .map(([path, found]) => ({ path, files: [...found].sort() }));
}

export function discoverRoutePaths(): string[] {
  return discoverRoutes().map((route) => route.path);
}

/**
 * Onda 33 — quem ALCANÇA cada rota, lido da mesma declaração que a catraca
 * `tests/architecture/alcance-por-rota.test.ts` confere contra o código.
 * A captura por papel precisa saber onde cada papel deveria aterrissar
 * (abrir a tela ou ser devolvido à home pela guarda), e reescrever essa
 * tabela no spec seria a segunda cópia da matriz de alcance (`REGRAS.md`
 * 6). Aqui só se lê; quem muda alcance muda o fixture, e a catraca cobra
 * a guarda no código.
 */
export type DeclaredReach =
  | "publica"
  | "autenticado"
  | "admin"
  | "lead-com-vinculo"
  | "calibracao"
  | "lideranca"
  | "ficha-de-carreira";

const FIXTURE_DE_ALCANCE = join(
  RAIZ_DO_REPOSITORIO,
  "tests",
  "architecture",
  "alcance-por-rota.fixture.json",
);

export function declaredReachByRoute(): Record<string, DeclaredReach> {
  const fixture = JSON.parse(readFileSync(FIXTURE_DE_ALCANCE, "utf8")) as {
    rotas: Record<string, { alcance: DeclaredReach }>;
  };
  return Object.fromEntries(
    Object.entries(fixture.rotas).map(([path, declaracao]) => [path, declaracao.alcance]),
  );
}
