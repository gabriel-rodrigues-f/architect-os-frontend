import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A saída do build é um servidor Node — a rede da regra 2 do frontend.
 *
 * Texto da regra: "O build é gate — o preset de saída já mudou de forma
 * silenciosa antes." O `@lovable.dev/vite-tanstack-config` deixa o nitro no
 * preset `cloudflare-module` quando ninguém diz nada, e a Lovable pode trocar
 * esse padrão em qualquer versão. Em Kubernetes (K8S-02) o frontend roda em
 * Node: `node .output/server/index.mjs`, lendo `PORT` e `HOST`.
 *
 * Três pontas precisam concordar, e cada uma pode envelhecer sozinha:
 * - `vite.config.ts` pina o preset `node-server` do nitro (o nome que a
 *   versão instalada registra em `_presets.mjs`, com alias `node`);
 * - `npm start` executa a saída do build, não o `vite dev` — `dev` continua
 *   sendo o servidor de desenvolvimento;
 * - o `Dockerfile` segue o idioma do backend (alpine, multi-stage, tini como
 *   PID 1, `USER node`, `HEALTHCHECK`) e sobe exatamente esse servidor na
 *   porta 3000. O major do Node é o 24 do `.nvmrc`, não o 22 do backend: o
 *   lockfile daqui exige npm 11 (medido: `node:22-alpine`, npm 10.9, falha o
 *   `npm ci` com "Missing: lru-cache@11.5.2 from lock file"). O
 *   `.dockerignore` impede que um `.output` velho do host entre na imagem no
 *   lugar do build feito dentro dela.
 *
 * A prova de que o servidor gerado responde é o `npm run build` + `npm start`
 * do gate de integração; este teste é a parte que roda antes do build.
 */

const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function conteudoDe(arquivo: string): string {
  return readFileSync(join(raizDoRepositorio, arquivo), "utf8");
}

describe("a saída do build é um servidor Node (K8S-02)", () => {
  it("vite.config.ts pina o preset node-server do nitro", () => {
    expect(conteudoDe("vite.config.ts")).toMatch(/nitro:\s*\{[^}]*preset:\s*"node-server"/);
  });

  it("npm start sobe a saída do build e npm run dev continua sendo o vite", () => {
    const { scripts } = JSON.parse(conteudoDe("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(scripts["start"]).toBe("node .output/server/index.mjs");
    expect(scripts["dev"]).toBe("vite dev");
  });

  it("o Dockerfile existe, fala o idioma do backend e sobe o servidor Node na 3000", () => {
    expect(existsSync(join(raizDoRepositorio, "Dockerfile"))).toBe(true);
    const dockerfile = conteudoDe("Dockerfile");
    expect(dockerfile).toMatch(/^FROM node:24-alpine AS build$/m);
    expect(dockerfile).toMatch(/^FROM node:24-alpine AS runtime$/m);
    expect(dockerfile).toMatch(/apk add --no-cache tini/);
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toMatch(/^EXPOSE 3000$/m);
    expect(dockerfile).toMatch(/^HEALTHCHECK /m);
    expect(dockerfile).toMatch(/^ENTRYPOINT \["\/sbin\/tini", "--"\]$/m);
    expect(dockerfile).toMatch(/^CMD \["node", "\.output\/server\/index\.mjs"\]$/m);
  });

  it(".dockerignore mantém node_modules e .output do host fora do contexto da imagem", () => {
    expect(existsSync(join(raizDoRepositorio, ".dockerignore"))).toBe(true);
    const linhas = conteudoDe(".dockerignore").split("\n");
    expect(linhas).toContain("node_modules");
    expect(linhas).toContain(".output");
  });
});
