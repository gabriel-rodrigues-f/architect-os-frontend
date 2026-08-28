#!/usr/bin/env bash
# Gate único do repositório. Existe porque montar a cadeia à mão já falhou:
# `npm run typecheck | grep ...` dentro de um && devolve o código do grep, e um
# typecheck quebrado passou por verde. Aqui cada etapa é medida pelo próprio
# código de saída, e a primeira que falhar interrompe e mostra o erro cru.
#
#   ./scripts/gate.sh          typecheck + lint + test + build
# Não há --full aqui: o frontend não tem suíte de integração própria.
set -uo pipefail

cd "$(dirname "$0")/.."

ETAPAS=(typecheck lint test build)
# o frontend não tem suíte de integração própria: o build É o gate extra

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

falhou=""
for etapa in "${ETAPAS[@]}"; do
  log="$LOG_DIR/${etapa//[:\/]/-}.txt"
  printf '  %-26s ' "$etapa"
  npm run "$etapa" > "$log" 2>&1
  codigo=$?
  resumo=$(grep -E 'Tests +[0-9]|built in|✖ [0-9]+ problem' "$log" | tail -1 | sed 's/^ *//')
  if [ "$codigo" -eq 0 ]; then
    printf 'EXIT=0  %s\n' "$resumo"
  else
    printf 'EXIT=%s  FALHOU\n' "$codigo"
    falhou="$etapa"
    echo
    echo "----- saída de $etapa (últimas 40 linhas) -----"
    grep -v '^npm warn' "$log" | tail -40
    break
  fi
done

if [ -n "$falhou" ]; then
  echo
  echo "GATE VERMELHO em '$falhou'. Nada foi mascarado: o código de saída acima é o do npm."
  exit 1
fi

echo
echo "GATE VERDE — ${#ETAPAS[@]} etapas, todas com exit 0."
