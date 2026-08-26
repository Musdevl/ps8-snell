#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Valeurs par défaut ---
MODE="prod"
ENV_FILE="$SCRIPT_DIR/.env"
BUILD=false

# --- Parsing des arguments ---
for arg in "$@"; do
  case $arg in
    --env=*)
      ENV_FILE="${arg#--env=}"
      ;;
    --prod)
      MODE="prod"
      ;;
    --dev)
      MODE="dev"
      ;;
    --build)
      BUILD=true
      ;;
    *)
      echo "⚠️  Argument inconnu ignoré : $arg"
      ;;
  esac
done

# --- Vérification obligatoire du fichier .env ---
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Erreur : aucun fichier .env trouvé à l'emplacement : $ENV_FILE"
  echo "   → Créez ce fichier, ou précisez son chemin avec --env=\"/chemin/vers/.env\""
  exit 1
fi

FRONT_ENV_FILE="./files/front/env.js"
USER_ENV_FILE="./user/env.js"

write_env_files() {
  local url="$1"

  cat > "$FRONT_ENV_FILE" << EOF
export const GATEWAY_URL = '$url';
EOF

  cat > "$USER_ENV_FILE" << EOF
export const GATEWAY_URL = '$url';
EOF

  echo "✅ Fichiers env.js mis à jour avec GATEWAY_URL = $url"
}

load_public_url_from_env() {

  # Une variable déjà exportée garde la priorité sur le .env
  local preset="$PUBLIC_URL"

  set -a
  source "$ENV_FILE"
  set +a

  if [ -n "$preset" ]; then
    echo "⚠️  PUBLIC_URL déjà exportée dans l'environnement ($preset), elle prend le pas sur $ENV_FILE." >&2
  fi

  local result="${preset:-${PUBLIC_URL}}"

  if [ -z "$result" ]; then
    echo "❌ PUBLIC_URL n'est ni exportée, ni présente dans $ENV_FILE."
    exit 1
  fi

  echo "$result"
}

PUBLIC_URL="$(load_public_url_from_env)"
write_env_files "$PUBLIC_URL"

# Exportées pour que `docker compose` les substitue dans docker-compose.yml
export ENV="$MODE"
export PUBLIC_URL

echo "🚀 Lancement en mode ${MODE^^}..."
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
if [ "$BUILD" = true ]; then
  docker compose --env-file "$ENV_FILE" up --build
else
  docker compose up -d
fi