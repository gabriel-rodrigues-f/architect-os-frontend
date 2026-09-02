# syntax=docker/dockerfile:1

# ---------- build ----------
# Node 24, não 22 como o backend: é o que `.nvmrc` (24.16.0) e o CI declaram,
# e foi medido (2026-09-02) que o `package-lock.json` deste repositório exige
# o npm 11 — com o npm 10.9 do `node:22-alpine` o `npm ci` falha com
# "Missing: lru-cache@11.5.2 from lock file" (o mesmo sintoma da regra 33 da
# direção, cuja causa é a versão do npm, não a do Node: node 22 + npm 11
# instala). Um só major nos dois estágios para não medir em um e rodar em outro.
FROM node:24-alpine AS build
WORKDIR /app

# Mesmo idioma do backend/Dockerfile: `npm ci` exige o lockfile e instala
# exatamente o que ele descreve — build reproduzível. As devDependencies
# entram aqui porque o `vite build` É devDependency (vite, nitro, tailwind).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
# K8S-02: o preset `node-server` está pinado em vite.config.ts; a saída é
# `.output/` com `server/index.mjs` (servidor Node, lê PORT/HOST), `public/`
# (assets do cliente) e `server/node_modules/` — o nitro rastreia as
# dependências de runtime para dentro de `.output`, por isso não há estágio
# `prod-deps` aqui: o backend precisa dele porque `tsc` não empacota; o
# nitro empacota.
RUN npm run build

# ---------- runtime ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# `tini` como PID 1 encaminha SIGTERM ao Node (o graceful shutdown do nitro
# escuta SIGINT/SIGTERM) e faz reap de zumbis — o mesmo do backend.
RUN apk add --no-cache tini

COPY --from=build --chown=node:node /app/.output ./.output
COPY package.json ./

USER node
EXPOSE 3000

# A raiz `/` é a casca SSR: o servidor renderiza o HTML sem sessão (o
# AuthGate decide no cliente). 200 aqui prova que o processo Node, o
# manifesto do TanStack Start e a renderização estão de pé. Sem `wget`:
# o `fetch` global do Node basta, como no backend.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
