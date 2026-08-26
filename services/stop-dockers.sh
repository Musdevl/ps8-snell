#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Valeurs par défaut ---
RESET=false
RESTART=false
BUILD=false

# --- Parsing des arguments ---
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

# --- Étape 1 : arrêt / suppression ---
if [ "$RESET" = true ]; then
  echo "⚠️  Reset complet : suppression des containers et des volumes..."
  docker compose down -v
  echo "✅ Containers et volumes supprimés."
else
  echo "🛑 Arrêt propre des containers..."
  docker compose down
  echo "✅ Containers arrêtés."
fi

# --- Étape 2 : redémarrage, seulement si --restart est passé ---
if [ "$RESTART" = true ]; then
  if [ "$RESET" = true ]; then
    # Après un reset, les containers/volumes n'existent plus : un simple
    # "restart" n'a rien à relancer, il faut un "up".
    if [ "$BUILD" = true ]; then
      echo "🚀 Redémarrage avec rebuild..."
      docker compose up --build -d
    else
      echo "🚀 Redémarrage sans rebuild..."
      docker compose up -d
    fi
  else
    if [ "$BUILD" = true ]; then
      echo "🔁 Restart avec rebuild..."
      docker compose up --build -d
    else
      echo "🔁 Restart simple (sans rebuild)..."
      docker compose restart
    fi
  fi
  echo "✅ Containers relancés."
fi