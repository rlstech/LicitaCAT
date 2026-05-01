#!/usr/bin/env bash
# Deploy do LicitaCAT no Docker Swarm.
# Carrega os secrets de /root/licitacat.secrets.env (fora do repositório)
# e substitui as variáveis no docker-stack.yml antes do deploy.
#
# Uso: ./deploy.sh [web|api|all]  (padrão: all)

set -euo pipefail

SECRETS_FILE="${SECRETS_FILE:-/root/licitacat.secrets.env}"
STACK_NAME="licitacat"
TARGET="${1:-all}"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "ERRO: arquivo de secrets não encontrado em $SECRETS_FILE"
  echo "Crie o arquivo com base em secrets.env.example e tente novamente."
  exit 1
fi

# Carrega as variáveis de ambiente do arquivo de secrets
set -a
# shellcheck disable=SC1090
source "$SECRETS_FILE"
set +a

echo "→ Fazendo deploy do stack '$STACK_NAME' (target: $TARGET)..."

if [[ "$TARGET" == "web" ]]; then
  docker service update --force "${STACK_NAME}_web"
elif [[ "$TARGET" == "api" ]]; then
  docker service update --force "${STACK_NAME}_api"
  docker service update --force "${STACK_NAME}_worker"
else
  docker stack deploy -c "$(dirname "$0")/docker-stack.yml" "$STACK_NAME"
fi

echo "✓ Deploy concluído."
