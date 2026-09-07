#!/bin/bash
# ---------------------------------------------------------------------------
# entrypoint.sh — bannière de démarrage commune à tous les services Node.
#
# Un seul fichier pour tous les services : `helpers/` est déjà copié dans
# chaque image, donc ce script s'y trouve automatiquement. Chaque Dockerfile
# n'a que deux lignes à ajouter :
#
#     ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
#     CMD ["node", "index.js"]
#
# Le script affiche un résumé de la configuration, puis passe la main au
# serveur. Il n'ajoute ni fichier de log ni `tail` : les services écrivent sur
# stdout, que Docker capte déjà (`docker logs <service>`).
# ---------------------------------------------------------------------------
set -Eeuo pipefail

# --- Quel service sommes-nous ? -------------------------------------------
# Chaque Dockerfile pose WORKDIR /app/<service>. Le nom du dossier courant est
# donc le nom du service : pas de variable à définir image par image.
SERVICE="$(basename "$PWD")"

case "$SERVICE" in
  gateway)     EMOJI="🚪"; LABEL="API GATEWAY" ;;
  game)        EMOJI="🎮"; LABEL="GAME SERVICE" ;;
  user)        EMOJI="👤"; LABEL="USER SERVICE" ;;
  files)       EMOJI="📁"; LABEL="FILE SERVICE" ;;
  chat)        EMOJI="💬"; LABEL="CHAT SERVICE" ;;
  achievement) EMOJI="🏆"; LABEL="ACHIEVEMENT SERVICE" ;;
  shop)        EMOJI="🛒"; LABEL="SHOP SERVICE" ;;
  ai)          EMOJI="🤖"; LABEL="AI SERVICE" ;;
  mail)        EMOJI="✉️ "; LABEL="MAIL SERVICE" ;;
  *)           EMOJI="📦"; LABEL="$(echo "$SERVICE" | tr '[:lower:]' '[:upper:]') SERVICE" ;;
esac

# --- Couleurs -------------------------------------------------------------
# Uniquement si la sortie est un terminal : `docker logs` n'en est pas un, et
# on évite ainsi de truffer les logs de codes d'échappement illisibles.
if [ -t 1 ]; then
  B=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[36m'; GREEN=$'\033[32m'; R=$'\033[0m'
else
  B=''; DIM=''; CYAN=''; GREEN=''; R=''
fi

# Une ligne "  label   valeur" alignée.
# Pas de bordure à droite volontairement : la padder correctement supposerait
# une locale UTF-8 dans l'image, sinon bash compte les octets et chaque
# caractère accentué décale le cadre.
line() { printf "  ${DIM}%-18s${R} %s\n" "$1" "$2"; }

# --- Bannière -------------------------------------------------------------
echo
echo "${CYAN}──────────────────────────────────────────────────────────────${R}"
echo "${CYAN}${R}  ${B}${EMOJI}  ${LABEL}${R}                             "
echo "${CYAN}──────────────────────────────────────────────────────────────${R}"

line "environnement" "${ENV:-dev}"
# line "node"          "$(node --version 2>/dev/null || echo '?')"
line "fuseau"        "${TZ:-UTC}  —  $(date '+%Y-%m-%d %H:%M:%S')"

# --- Dépendances ----------------------------------------------------------
# On affiche automatiquement toutes les variables d'environnement en *_URL :
# docker-compose n'en passe pas les mêmes à chaque service, et la liste
# s'adapte donc toute seule sans table à maintenir ici.
DEPS="$(env | grep -E '^[A-Z0-9_]+_URL=' | sort || true)"
if [ -n "$DEPS" ]; then
  echo
  while IFS='=' read -r key value; do
    [ -n "$key" ] || continue
    # USER_SERVICE_URL → "user", MONGO_DB_URL → "mongo db"
    # (le suffixe _SERVICE n'apporte rien : ce bloc ne liste que des services)
    pretty="$(echo "${key%_URL}" | sed 's/_SERVICE$//' | tr '[:upper:]_' '[:lower:] ')"
    line "$pretty" "$value"
  done <<< "$DEPS"
fi

# --- Secrets --------------------------------------------------------------
# On confirme leur présence sans jamais afficher leur valeur : un secret qui
# passe dans `docker logs` est un secret partagé avec tous ceux qui y ont accès.
SECRETS="$(env | grep -E '^[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|_KEY)[A-Z0-9_]*=' | cut -d= -f1 | sort || true)"
if [ -n "$SECRETS" ]; then
  echo
  while read -r key; do
    [ -n "$key" ] || continue
    pretty="$(echo "$key" | tr '[:upper:]_' '[:lower:] ')"
    line "$pretty" "${GREEN}défini${R} ${DIM}(valeur masquée)${R}"
  done <<< "$SECRETS"
fi

echo

# --- Démarrage ------------------------------------------------------------
# `exec` remplace ce shell par la commande : le serveur devient PID 1 et reçoit
# donc directement le SIGTERM du `docker compose down`, ce qui déclenche les
# arrêts propres codés dans chaque service. Son code de sortie devient celui
# du conteneur : s'il meurt, le conteneur meurt, et la politique `restart:`
# du compose peut faire son travail.
#
# "$@" = la CMD du Dockerfile (["node", "index.js"]). On garde ainsi la
# possibilité de lancer autre chose ponctuellement :
#   docker compose run --rm gateway bash
exec "$@"
