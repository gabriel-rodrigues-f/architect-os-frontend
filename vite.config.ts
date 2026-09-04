// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // K8S-02: em Kubernetes o frontend roda em Node (`node .output/server/index.mjs`, lendo
  // PORT/HOST). Sem isto o wrapper cai no `cloudflare-module` — preset de saída já mudou
  // de forma silenciosa antes (frontend/REGRAS.md, regra 2); a catraca é
  // tests/architecture/saida-do-build-e-node.test.ts. Só vale no `vite build`; o `vite dev`
  // não passa pelo nitro.
  nitro: {
    preset: "node-server",
    // 2026-09-04 — MEDIDO: o build entrega 2,9 MB de JavaScript, e o servidor
    // os mandava sem compressão nenhuma. Sob o Ingress do Kubernetes quem
    // comprimia era o Traefik; com a saída do k8s o frontend passou a servir
    // direto, o compressor foi embora junto, e ninguém notou — a queixa chegou
    // como "a tela demora muito para carregar".
    //
    // `compressPublicAssets` gera .gz e .br no BUILD e o servidor entrega o
    // arquivo pronto conforme o `Accept-Encoding`. Comprimir no build, e não a
    // cada requisição, é o que torna isto de graça em tempo de resposta.
    // O tipo do wrapper da Lovable só declara `preset`; a opção existe no
    // nitro e funciona (o build gera 57 arquivos .br). O espalhamento é o que
    // deixa passar sem mentir sobre o tipo do objeto inteiro.
    ...({ compressPublicAssets: true } as Record<string, unknown>),
  },
});
