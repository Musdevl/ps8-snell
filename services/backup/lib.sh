#!/bin/bash
# ---------------------------------------------------------------------------
# lib.sh — configuration et fonctions communes aux trois scripts de sauvegarde
#          (backup.sh, test-backup.sh, restore-backup.sh).
#
# Ce fichier n'est jamais exécuté directement : il est "sourcé" par les autres.
# ---------------------------------------------------------------------------

CONTAINER="snell-backup"

# --- Rechargement de l'environnement (dans le conteneur) ------------------
# Piège classique : cron n'hérite PAS des variables d'environnement du
# conteneur Docker. entrypoint.sh les a donc recopiées dans ce fichier au
# démarrage. On le recharge ici pour que la sauvegarde automatique de 2h voie
# exactement la même configuration qu'une sauvegarde lancée à la main.
if [ -f /etc/snell-backup.env ]; then
  set -a           # tout ce qui suit est exporté (openssl doit voir la clé)...
  . /etc/snell-backup.env
  set +a           # ...et on repasse en mode normal.
fi

# --- Configuration --------------------------------------------------------
# Ces valeurs viennent de services/.env, transmises par docker-compose.yml.
MONGO_DB_URL="${MONGO_DB_URL:-mongodb://mongodb:27017}"   # base à sauvegarder
BACKUP_DIR="${BACKUP_DIR:-/backup}"                       # = dossier ./backup de l'hôte
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"             # rétention glissante, en jours
PBKDF2_ITER="${BACKUP_PBKDF2_ITER:-200000}"               # itérations de dérivation de clé

# Toutes les archives suivent ce motif : snell-<label?>-AAAA-MM-JJ_HHMMSS.archive.gz.enc
ARCHIVE_GLOB='snell-*.archive.gz.enc'

# --- Affichage ------------------------------------------------------------
# Couleurs uniquement si la sortie est un vrai terminal : dans le fichier de
# log de cron, on veut du texte brut sans codes d'échappement.
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_BOLD=''; C_DIM=''
fi

log()  { echo "${C_DIM}[$(date '+%Y-%m-%d %H:%M:%S')]${C_RESET} $*"; }
ok()   { log "${C_GREEN}✅ $*${C_RESET}"; }
info() { log "${C_BLUE}ℹ️  $*${C_RESET}"; }
warn() { log "${C_YELLOW}⚠️  $*${C_RESET}" >&2; }
die()  { log "${C_RED}❌ $*${C_RESET}" >&2; exit 1; }

# --- Hôte ou conteneur ? --------------------------------------------------
#
# Les trois scripts existent à DEUX endroits, mais c'est le même fichier :
#   - sur l'hôte      : services/backup.sh, services/test-backup.sh, ...
#   - dans l'image    : /app/backup/backup.sh, ... (copié par le Dockerfile,
#                       et remonté depuis l'hôte par docker-compose.yml)
#
# Lancé sur l'hôte, un script se relance tout seul à l'intérieur du conteneur
# snell-backup : c'est lui qui possède mongodump, mongorestore et openssl, et
# qui voit la base sur le réseau Docker. Vous n'avez donc jamais à taper une
# commande docker vous-même.
#
# Le fichier /.snell-backup est créé par le Dockerfile : il n'existe que dans
# le conteneur, et sert de marqueur.
in_container() { [ -f /.snell-backup ]; }

relaunch_in_container() {
  local me; me="$(basename "$0")"

  command -v docker >/dev/null 2>&1 \
    || die "docker est introuvable sur cette machine."

  docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
    || die "Le conteneur '$CONTAINER' ne tourne pas.
   → Démarrez la stack :        cd services && ./launch.sh
   → Ou seulement la sauvegarde : cd services && docker compose up -d backup"

  # -t seulement si on est dans un vrai terminal : sinon docker exec échoue
  # quand le script est appelé depuis un autre script ou une CI.
  # On appelle "bash <script>" plutôt que le script directement : ça marche
  # même si le bit d'exécution a été perdu (copie, zip, Windows...).
  if [ -t 0 ] && [ -t 1 ]; then
    exec docker exec -it "$CONTAINER" bash "/app/backup/$me" "$@"
  else
    exec docker exec -i  "$CONTAINER" bash "/app/backup/$me" "$@"
  fi
}

# --- Vérifications --------------------------------------------------------

# La clé de chiffrement vient de services/.env (variable BACKUP_ENCRYPTION_KEY),
# transmise au conteneur par docker-compose. Sans elle, rien n'est possible :
# on s'arrête net plutôt que de produire une archive qu'on ne saurait pas relire.
require_key() {
  [ -n "${BACKUP_ENCRYPTION_KEY:-}" ] || die "BACKUP_ENCRYPTION_KEY est vide ou absente de services/.env
   → Générez une clé :   ./backup.sh --genkey
   → Collez la ligne affichée dans services/.env
   → Puis rechargez le conteneur : cd services && docker compose up -d backup
     (un 'restart' ne suffit pas : il ne relit pas le .env)"

  # 32 caractères ≈ 24 octets d'entropie : en dessous, la clé n'est plus
  # sérieuse face à une attaque hors-ligne sur l'archive.
  [ "${#BACKUP_ENCRYPTION_KEY}" -ge 32 ] \
    || die "BACKUP_ENCRYPTION_KEY est trop courte (${#BACKUP_ENCRYPTION_KEY} caractères, minimum 32)
   → Générez-en une correcte avec : ./backup.sh --genkey"
}

require_mongo() {
  mongosh "$MONGO_DB_URL" --quiet --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1 \
    || die "MongoDB injoignable sur $MONGO_DB_URL (le conteneur mongodb tourne-t-il ?)"
}

# --- Chiffrement / déchiffrement -----------------------------------------
#
# AES-256-CBC + PBKDF2 (200 000 itérations, SHA-512) + sel aléatoire.
#   -salt      : sel différent à chaque archive → deux sauvegardes identiques
#                donnent deux fichiers chiffrés différents.
#   -pbkdf2    : la clé AES est dérivée lentement de BACKUP_ENCRYPTION_KEY, ce
#                qui rend une attaque par dictionnaire très coûteuse.
#   -pass env: : openssl lit la clé dans la variable d'environnement. Elle
#                n'apparaît donc jamais dans la ligne de commande (visible par
#                `ps aux`) ni dans l'historique du shell.
#
# Les deux fonctions travaillent en flux (stdin → stdout) : la base n'est
# jamais écrite en clair sur le disque, même temporairement.

encrypt_stream() {
  openssl enc -aes-256-cbc -md sha512 -pbkdf2 -iter "$PBKDF2_ITER" -salt \
          -pass env:BACKUP_ENCRYPTION_KEY
}

decrypt_stream() {
  openssl enc -d -aes-256-cbc -md sha512 -pbkdf2 -iter "$PBKDF2_ITER" \
          -pass env:BACKUP_ENCRYPTION_KEY
}

# --- Utilitaires sur les archives ----------------------------------------

# Extrait l'horodatage AAAA-MM-JJ_HHMMSS du nom de fichier.
archive_stamp() {
  echo "$1" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}' | head -n1
}

# Taille lisible par un humain (12M, 1.4G...).
human_size() {
  du -h "$1" 2>/dev/null | cut -f1
}

# Liste les archives de la plus RÉCENTE à la plus ancienne.
#
# On trie sur l'horodatage contenu dans le NOM du fichier, pas sur la date de
# modification (`ls -t`) : copier ou restaurer le dossier ./backup remet les
# dates de modification à zéro, et "la plus récente" désignerait alors
# n'importe quoi. Le nom, lui, ne ment jamais.
archives_sorted() {
  local f stamp
  for f in "$BACKUP_DIR"/$ARCHIVE_GLOB; do
    [ -e "$f" ] || continue
    stamp="$(archive_stamp "$(basename "$f")")"
    [ -n "$stamp" ] || continue
    printf '%s\t%s\n' "$stamp" "$f"
  done | sort -r | cut -f2-      # tri décroissant sur l'horodatage, on garde le chemin
}

# Résout l'argument passé par l'utilisateur en chemin d'archive complet.
# Accepte : "latest" (ou rien) → la plus récente
#           "snell-2026-09-04_020000.archive.gz.enc" → un nom simple
#           "/backup/xxx.enc" → un chemin complet
resolve_backup() {
  local wanted="${1:-latest}"

  if [ "$wanted" = "latest" ] || [ -z "$wanted" ]; then
    local newest
    newest=$(archives_sorted | head -n1)
    [ -n "$newest" ] || die "Aucune sauvegarde trouvée dans $BACKUP_DIR
   → Créez-en une avec : ./backup.sh"
    echo "$newest"
    return
  fi

  [ -f "$wanted" ] && { echo "$wanted"; return; }
  [ -f "$BACKUP_DIR/$wanted" ] && { echo "$BACKUP_DIR/$wanted"; return; }
  die "Sauvegarde introuvable : $wanted
   → Listez les sauvegardes disponibles avec : ./backup.sh --list"
}

# Vérifie l'empreinte SHA-256 stockée à côté de l'archive (fichier .sha256).
# Détecte une corruption du fichier (disque, copie interrompue, transfert).
check_checksum() {
  local archive="$1"
  local sidecar="${archive}.sha256"

  [ -f "$sidecar" ] || { warn "Pas d'empreinte .sha256 pour $(basename "$archive") — vérification ignorée"; return 0; }

  # On se place dans le dossier : le fichier .sha256 ne contient que le nom court.
  ( cd "$(dirname "$archive")" && sha256sum -c "$(basename "$sidecar")" >/dev/null 2>&1 )
}
