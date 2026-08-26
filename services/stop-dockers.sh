#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export COMPOSE_PROJECT_NAME="snell"

RESET=false
RESTART=false
BUILD=false

for arg in "$@"; do
  case $arg in
    --reset)
      RESET=true
      ;;
    --restart)
      RESTART=true
      ;;
    --build)
      BUILD=true
      ;;
    *)
      echo "⚠️  Argument inconnu ignoré : $arg"
      ;;
  esac
done

if [ "$RESET" = true ]; then
  echo "⚠️  Reset complet : suppression des containers et des volumes..."
  docker compose down -v
  echo "✅ Containers et volumes supprimés."
else
  echo "🛑 Arrêt propre des containers (volumes conservés)..."
  docker compose down
  echo "✅ Containers arrêtés."
fi

if [ "$RESTART" = true ]; then
  if [ "$BUILD" = true ]; then
    echo "🚀 Redémarrage avec rebuild..."
    ./launch.sh --build
  else
    echo "🚀 Redémarrage sans rebuild..."
    ./launch.sh
  fi
  echo "✅ Containers relancés."
fi