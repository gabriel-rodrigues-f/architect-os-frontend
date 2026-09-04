#!/usr/bin/env bash
# Para o frontend, seja ele qual for o processo que estiver na porta.
#
# Existe porque `npm run start` nem sempre devolve um terminal preso onde o
# Ctrl+C resolva — e ficar caçando PID à mão não é trabalho de ninguém.
#   npm run stop
set -uo pipefail

PORTA=${PORT:-3000}
PIDS=$(lsof -ti "tcp:$PORTA" 2>/dev/null)

if [ -z "$PIDS" ]; then
  echo "nada rodando na porta $PORTA — o frontend já está parado"
  exit 0
fi

kill $PIDS 2>/dev/null
for _ in $(seq 1 10); do
  sleep 0.5
  [ -z "$(lsof -ti "tcp:$PORTA" 2>/dev/null)" ] && { echo "frontend parado (porta $PORTA livre)"; exit 0; }
done

# Não saiu com o pedido educado: insiste.
kill -9 $(lsof -ti "tcp:$PORTA" 2>/dev/null) 2>/dev/null
sleep 1
if [ -z "$(lsof -ti "tcp:$PORTA" 2>/dev/null)" ]; then
  echo "frontend parado à força (porta $PORTA livre)"
else
  echo "não consegui liberar a porta $PORTA — veja quem está nela: lsof -nP -iTCP:$PORTA -sTCP:LISTEN" >&2
  exit 1
fi
