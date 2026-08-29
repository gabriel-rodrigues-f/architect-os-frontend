#!/usr/bin/env bash
# Gate de entrega — navegação E2E com captura por tela (ver README, seção
# "Gate de entrega"). Exige o BACKEND no ar: o frontend o playwright.config
# sobe sozinho, mas a API não é deste repositório — e falhar cedo com uma
# mensagem clara vale mais que 17 telas de login quebradas.
set -uo pipefail

cd "$(dirname "$0")/.."

API="${E2E_API_URL:-http://localhost:4000}"
if ! curl -fsS -m 3 "$API/health/ready" > /dev/null 2>&1; then
  echo "ERRO: backend não responde em $API/health/ready." >&2
  echo >&2
  echo "Suba a stack no repositório do backend antes de rodar o harness:" >&2
  echo "  docker compose up -d postgres redis   (Postgres 5433 / Redis 6380)" >&2
  echo "  npm run dev                           (API em :4000)" >&2
  echo "  npm run seed:access-profiles          (credenciais locais de admin/member)" >&2
  echo >&2
  echo "Outro endereço? Exporte E2E_API_URL." >&2
  exit 1
fi

# Defaults locais = seed:access-profiles do backend (senha impressa pelo
# próprio seed). Na CI as variáveis já vêm definidas pelo job e2e e estes
# defaults nunca são usados.
export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@synapse.local}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-synapse-local-dev}"
export E2E_MEMBER_EMAIL="${E2E_MEMBER_EMAIL:-dev@synapse.local}"
export E2E_MEMBER_PASSWORD="${E2E_MEMBER_PASSWORD:-synapse-local-dev}"

# html além do list: `npm run e2e:nav:report` abre o relatório com o anexo
# `navegacao-resumo` (rota → destino final por papel). `never` porque o
# comando é quem decide quando abrir, não a falha.
export PLAYWRIGHT_HTML_OPEN=never
exec npx playwright test e2e/navigation-capture.spec.ts --reporter=list,html "$@"
