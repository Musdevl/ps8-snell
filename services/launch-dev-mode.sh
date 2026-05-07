#!/usr/bin/env bash

./local_env_updater.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

run_service () {
  NAME="$1"
  DIR="$2"

  echo "▶ Lancement de $NAME..."

  (
    cd "$ROOT_DIR/$DIR"
    npm install
    npm run start
  ) &
}

run_service "user"    "user"
run_service "game" "game"
run_service "files"   "files"
run_service "gateway" "gateway"
run_service "chat" "chat"
run_service "achievement" "achievement"
run_service "shop" "shop"
run_service "ai" "AI"

echo ""
echo "Tous les services sont lancés."
echo "Ctrl+C pour arrêter."

# attend tous les process en background
wait

