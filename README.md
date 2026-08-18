# Synapse — Frontend

Interface de gestão de capacidades técnicas de um time de Arquitetos de Soluções: matriz de
competências, assessments, gaps, PDIs, OKRs, trilhas, mentorias, evidências e 9-box.

TanStack Start + React 19 + Tailwind 4, consumindo a API em
[architect-os-backend](https://github.com/gabriel-rodrigues-f/architect-os-backend).

## Rodar

Pré-requisito: **Node ≥ 20.19** (o Vite 8 / rolldown não roda em versões anteriores).

```sh
cd frontend
nvm use          # lê o .nvmrc (Node 24.16)
npm install
npm run start    # ou npm run dev; roda em primeiro plano, Ctrl+C encerra
```

- App: http://localhost:8080
- Aponta para `http://localhost:4000` por padrão; para mudar, crie um `.env` a partir de
  `.env.example` com `VITE_API_URL` (e adicione a origem em `CORS_ORIGINS` no backend).
- Se a 8080 estiver ocupada, o Vite sobe em 8081/8082 e continua funcionando: o CORS do
  backend libera qualquer porta em `localhost`/`127.0.0.1`. Confira no log qual porta saiu.

**O frontend depende do backend no ar** — sem ele a tela mostra "Não foi possível carregar os
dados". Suba a API antes (`cd ../backend && docker compose up -d --build`).

## Primeiro acesso

O app exige login (e-mail e senha). Na instância nova, a tela de entrada aparece como
**"Primeiro acesso"** e a primeira conta criada vira administradora. As demais pessoas podem
criar conta pela mesma tela, em "Criar uma nova conta".

O token é guardado no `localStorage` e a sessão é revalidada a cada carga.

## Como conversa com a API

O front hidrata a store com uma chamada a `GET /api/state` e, nas mutações, atualiza o cache
do React Query na hora e envia a alteração à API; em erro, revalida o snapshot.

## Idioma

A interface é toda em português. Os valores de status continuam gravados em inglês no banco
(`Draft`, `In Review`, `Not Started`, …) e são traduzidos só na exibição, pela camada de
rótulos em `src/lib/labels.ts` — trocar um rótulo não exige migração de dados.

Os 11 domínios de competência são sempre renderizados em ordem alfabética (`localeCompare`
pt-BR, no front e no backend).

## Scripts

```sh
npm test                  # unitários
RUN_INTEGRATION=1 npm test  # inclui contrato contra a API real (backend no ar)
npm run typecheck
npm run lint
npm run screenshots       # captura cada tela em docs/screenshots (ver docs/FUNCIONAL.md)
```

## Documentação funcional

[`docs/FUNCIONAL.md`](docs/FUNCIONAL.md) — o que cada tela faz, com captura de tela, do
ponto de vista de quem usa o produto (não de arquitetura de código).

## Built with

- TanStack Start
- TypeScript
- React 19
- Tailwind CSS 4
