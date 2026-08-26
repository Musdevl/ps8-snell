#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Nom de projet fixe : garantit que les volumes (ex: mongodb_data) restent
# toujours les mêmes, peu importe le dossier depuis lequel ce script est lancé.
export COMPOSE_PROJECT_NAME="snell"

ENV_MODE_DEFAULT="prod"
ENV_FILE="$SCRIPT_DIR/.env"
BUILD=false

for arg in "$@"; do
  case $arg in
    --env=*)
      ENV_FILE="${arg#--env=}"
      ;;
    --build)
      BUILD=true
      ;;
    *)
      echo "⚠️  Argument inconnu ignoré : $arg"
      ;;
  esac
done

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

# Variables déjà exportées avant le script : elles gardent la priorité sur le .env
PRESET_PUBLIC_URL="$PUBLIC_URL"
PRESET_ENV="$ENV"

# set -a exporte automatiquement tout ce qui vient du .env : docker compose,
# lancé plus bas dans ce même shell, les recevra sans "export" supplémentaire.
set -a
source "$ENV_FILE"
set +a

if [ -n "$PRESET_PUBLIC_URL" ]; then
  echo "⚠️  PUBLIC_URL déjà exportée dans l'environnement ($PRESET_PUBLIC_URL), elle prend le pas sur $ENV_FILE." >&2
  PUBLIC_URL="$PRESET_PUBLIC_URL"
fi

if [ -n "$PRESET_ENV" ]; then
  echo "⚠️  ENV déjà exportée dans l'environnement ($PRESET_ENV), elle prend le pas sur $ENV_FILE." >&2
  ENV="$PRESET_ENV"
fi

: "${ENV:=$ENV_MODE_DEFAULT}"
export ENV

if [ -z "$PUBLIC_URL" ]; then
  echo "❌ PUBLIC_URL n'est ni exportée, ni présente dans $ENV_FILE."
  exit 1
fi

write_env_files "$PUBLIC_URL"

# La gateway ne sert en TLS qu'en mode prod. Les services qui ouvrent une
# socket vers elle doivent viser le meme schema, sinon le handshake echoue
# sans le moindre message et le temps reel meurt en silence.
if [ "$ENV" = "prod" ]; then
  GATEWAY_INTERNAL_URL="https://gateway:8000"
else
  GATEWAY_INTERNAL_URL="http://gateway:8000"
fi

export GATEWAY_INTERNAL_URL

echo "🚀 Lancement en mode $ENV..."
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

if [ "$BUILD" = true ]; then
  docker compose --env-file "$ENV_FILE" up --build
else
  docker compose --env-file "$ENV_FILE" up -d
fi