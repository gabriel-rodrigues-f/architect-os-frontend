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
  echo "  npm run seed:access-profiles          (os quatro perfis locais, com a senha)" >&2
  echo >&2
  echo "Outro endereço? Exporte E2E_API_URL." >&2
  exit 1
fi

# Os QUATRO perfis que o `seed:access-profiles` do backend cria (ADR-0084, um
# cadastro por pessoa). O seed EXCLUI as contas do modelo antigo de três papéis
# — `admin@synapse.local`, `dev@synapse.local` — e o harness ficou apontando
# para elas: contra banco novo o login era recusado e o sintoma chegava como
# "locator('nav') não ficou visível em 120 s".
#
# O E-MAIL tem default; a SENHA não, e nunca vai ter. Este repositório é
# PÚBLICO, e senha literal aqui é senha publicada — ela entra no histórico e
# não sai mais. A senha vem do ambiente, e quem a imprime é o próprio seed,
# uma vez, no terminal de quem rodou.
export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@synapse.com.br}"
export E2E_MANAGER_EMAIL="${E2E_MANAGER_EMAIL:-gestor@synapse.com.br}"
export E2E_TECH_LEAD_EMAIL="${E2E_TECH_LEAD_EMAIL:-techlead@synapse.com.br}"
export E2E_MEMBER_EMAIL="${E2E_MEMBER_EMAIL:-profissional@synapse.com.br}"
# A senha do papel de MEMBRO/gestor/tech lead cai para a do admin quando não
# vier própria: os quatro perfis do seed nascem com a mesma, e repetir a
# exportação à mão em quatro linhas só multiplica a chance de esquecer uma.
export E2E_MANAGER_PASSWORD="${E2E_MANAGER_PASSWORD:-${E2E_ADMIN_PASSWORD-}}"
export E2E_TECH_LEAD_PASSWORD="${E2E_TECH_LEAD_PASSWORD:-${E2E_ADMIN_PASSWORD-}}"
export E2E_MEMBER_PASSWORD="${E2E_MEMBER_PASSWORD:-${E2E_ADMIN_PASSWORD-}}"

if [ -z "${E2E_ADMIN_PASSWORD-}" ]; then
  echo "ERRO: exporte E2E_ADMIN_PASSWORD antes de rodar o harness." >&2
  echo >&2
  echo "A senha não mora neste repositório — ele é público. Ela é impressa pelo seed:" >&2
  echo "  (no repositório do backend)  npm run seed:access-profiles" >&2
  echo "  export E2E_ADMIN_PASSWORD=... (a senha que o seed imprimiu)" >&2
  echo >&2
  echo "Perfis com senha própria? Exporte também E2E_MANAGER_PASSWORD, E2E_TECH_LEAD_PASSWORD e E2E_MEMBER_PASSWORD." >&2
  exit 1
fi

# A credencial é pré-condição como o backend é: o harness inteiro passa pelo
# login, e uma recusa aqui custa 120 s de espera por um `nav` que não vem,
# num erro que não diz o motivo. Uma chamada de um segundo diz.
json() { local texto=${1//\\/\\\\}; printf '%s' "${texto//\"/\\\"}"; }
corpo=$(printf '{"email":"%s","password":"%s"}' \
  "$(json "$E2E_ADMIN_EMAIL")" "$(json "$E2E_ADMIN_PASSWORD")")
codigo_login=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST "$API/api/v1/auth/login" \
  -H 'content-type: application/json' -d "$corpo")
if [ "$codigo_login" != "200" ]; then
  echo "ERRO: o login de admin ($E2E_ADMIN_EMAIL) foi recusado — HTTP $codigo_login." >&2
  echo >&2
  case "$codigo_login" in
    401) echo "As contas do seed não estão neste banco. No repositório do backend:" >&2
         echo "  npm run seed && npm run seed:demo && npm run seed:access-profiles" >&2
         echo "O seed imprime os quatro perfis e a senha; exporte E2E_ADMIN_* para usar outras." >&2 ;;
    503) echo "A API respondeu, mas o limitador de tentativas não alcança o Redis." >&2
         echo "Sem Redis o login é recusado por desenho — suba o Redis e confira" >&2
         echo "  curl -s $API/health/ready   (espera-se \"redis\":{\"ok\":true})" >&2 ;;
    *)   echo "Resposta inesperada da API. Confira o log do backend." >&2 ;;
  esac
  exit 1
fi

# html além do list: `npm run e2e:nav:report` abre o relatório com o anexo
# `navegacao-resumo` (rota → destino final por papel). `never` porque o
# comando é quem decide quando abrir, não a falha.
export PLAYWRIGHT_HTML_OPEN=never
exec npx playwright test e2e/navigation-capture.spec.ts --reporter=list,html "$@"
