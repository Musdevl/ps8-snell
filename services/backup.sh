#!/bin/bash
# ---------------------------------------------------------------------------
# backup.sh — crée une sauvegarde chiffrée (AES-256) de MongoDB, et liste les
#             sauvegardes existantes.
#
#   ./backup.sh              → sauvegarde immédiate
#   ./backup.sh --list       → liste les sauvegardes présentes dans ../backup
#   ./backup.sh --genkey     → génère une clé de chiffrement à coller dans .env
#
# Ce script est aussi celui que cron lance automatiquement tous les jours à 2h
# du matin, à l'intérieur du conteneur snell-backup.
#
# Chaîne complète, entièrement en flux (rien n'est écrit en clair sur disque) :
#
#   mongodump --archive --gzip   →   openssl enc -aes-256-cbc   →   fichier .enc
#   (dump binaire compressé)         (chiffrement + sel + PBKDF2)
#
# ---------------------------------------------------------------------------
set -Eeuo pipefail
# -E : les traps sont héritées par les fonctions
# -e : on s'arrête à la première erreur
# -u : une variable non définie est une erreur
# -o pipefail : si mongodump échoue, le pipe entier échoue (sinon seule la
#               réussite d'openssl compterait et on écrirait une archive vide !)

# lib.sh est à côté du script dans le conteneur (/app/backup/), et dans le
# sous-dossier backup/ quand on est sur l'hôte (services/backup/).
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SELF_DIR/lib.sh" ]; then . "$SELF_DIR/lib.sh"; else . "$SELF_DIR/backup/lib.sh"; fi

# ===========================================================================
#  Génération de clé — la seule commande qui tourne sur l'hôte, avant tout
# ===========================================================================
genkey() {
  local key
  # 48 octets aléatoires en base64 (64 caractères) : c'est la passphrase, dont
  # openssl dérivera la vraie clé AES-256 via PBKDF2 au moment de chiffrer.
  if command -v openssl >/dev/null 2>&1; then
    key="$(openssl rand -base64 48 | tr -d '\n')"
  else
    key="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  fi

  echo
  echo "${C_BOLD}Ajoutez cette ligne dans services/.env :${C_RESET}"
  echo
  echo "  BACKUP_ENCRYPTION_KEY=\"$key\""
  echo
  echo "${C_YELLOW}${C_BOLD}IMPORTANT${C_RESET}"
  echo "  • services/.env n'est pas versionné : cette clé n'existe que chez vous."
  echo "  • Copiez-la aussi dans un gestionnaire de mots de passe."
  echo "    ${C_BOLD}Sans elle, les sauvegardes sont définitivement illisibles.${C_RESET}"
  echo "  • Si vous la changez, les anciennes archives deviennent illisibles :"
  echo "    gardez l'ancienne clé quelque part tant que ces archives existent."
  echo
  echo "  Puis rechargez le conteneur pour qu'il voie la nouvelle valeur :"
  echo "    cd services && docker compose up -d backup"
  echo
}

# ===========================================================================
#  Liste des sauvegardes
# ===========================================================================
list_backups() {
  echo
  echo "  Dossier    : $BACKUP_DIR  (= dossier ./backup à la racine du projet)"
  echo "  Rétention  : ${RETENTION_DAYS} jours glissants"
  if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "  Clé AES    : ${C_GREEN}présente${C_RESET} (BACKUP_ENCRYPTION_KEY, depuis services/.env)"
  else
    echo "  Clé AES    : ${C_RED}ABSENTE${C_RESET} → ./backup.sh --genkey"
  fi
  echo

  printf "  %-52s %8s  %-19s %s\n" "FICHIER" "TAILLE" "DATE" "INTÉGRITÉ"
  printf "  %-52s %8s  %-19s %s\n" "----------------------------------------------------" "--------" "-------------------" "---------"

  local count=0 f name stamp pretty status
  # archives_sorted (lib.sh) : de la plus récente à la plus ancienne, d'après
  # l'horodatage inscrit dans le nom du fichier.
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    name="$(basename "$f")"
    stamp="$(archive_stamp "$name")"
    # "2026-09-04_020000" → "2026-09-04 02:00:00"
    pretty="${stamp%%_*} ${stamp##*_}"
    pretty="${pretty:0:13}:${pretty:13:2}:${pretty:15:2}"

    if check_checksum "$f"; then status="${C_GREEN}ok${C_RESET}"; else status="${C_RED}CORROMPUE${C_RESET}"; fi

    printf "  %-52s %8s  %-19s %b\n" "$name" "$(human_size "$f")" "$pretty" "$status"
    count=$((count + 1))
  done < <(archives_sorted)

  echo
  if [ "$count" -eq 0 ]; then
    warn "Aucune sauvegarde pour l'instant."
    echo "     → Lancez-en une tout de suite avec : ./backup.sh"
  else
    echo "  $count sauvegarde(s) — total $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
    echo "  ${C_DIM}'latest' (valeur par défaut de test-backup.sh et restore-backup.sh)"
    echo "  désigne la première de cette liste.${C_RESET}"
    echo "  ${C_DIM}Journal des sauvegardes automatiques : docker logs snell-backup${C_RESET}"
  fi
  echo
}

usage() {
  cat <<USAGE

  ./backup.sh                 Crée une sauvegarde chiffrée maintenant
  ./backup.sh --list          Liste les sauvegardes existantes
  ./backup.sh --genkey        Génère une clé AES-256 à coller dans services/.env
  ./backup.sh --label <nom>   Ajoute une étiquette au nom du fichier

  Les sauvegardes automatiques ont lieu tous les jours à 2h du matin.
  Documentation : services/backup/README.md

USAGE
}

# ===========================================================================
#  Options traitées sur place, puis relance dans le conteneur
# ===========================================================================
# --help et --genkey ne touchent ni à Docker ni à la base : on les traite ici,
# avant tout, pour qu'ils marchent même quand le conteneur est éteint.
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage;  exit 0 ;;
    --genkey)  genkey; exit 0 ;;
  esac
done

# Pour tout le reste, on a besoin de mongodump/openssl : si on est sur l'hôte,
# on relance ce même script à l'intérieur du conteneur (voir lib.sh), en lui
# repassant les MÊMES arguments.
#
# ⚠️ Cette relance doit avoir lieu AVANT la boucle de parsing ci-dessous : celle-ci
#    vide "$@" au fur et à mesure avec ses `shift`. Relancer après, c'était
#    relancer sans aucun argument — et donc créer une sauvegarde alors qu'on
#    avait demandé --list.
in_container || relaunch_in_container "$@"

# ===========================================================================
#  Arguments
# ===========================================================================
LABEL=""        # étiquette optionnelle, ex: --label avant-restore
ACTION="backup" # backup | list

while [ $# -gt 0 ]; do
  case "$1" in
    -l|--list) ACTION="list"; shift ;;
    --label)   LABEL="$2"; shift 2 ;;
    --label=*) LABEL="${1#--label=}"; shift ;;
    *) die "Argument inconnu : $1  (voir ./backup.sh --help)" ;;
  esac
done

[ "$ACTION" = "list" ] && { list_backups; exit 0; }

# ===========================================================================
#  Sauvegarde
# ===========================================================================
require_key
require_mongo

STAMP="$(date +%Y-%m-%d_%H%M%S)"
if [ -n "$LABEL" ]; then
  NAME="snell-${LABEL}-${STAMP}.archive.gz.enc"
else
  NAME="snell-${STAMP}.archive.gz.enc"
fi

mkdir -p "$BACKUP_DIR"
FINAL="$BACKUP_DIR/$NAME"
# On écrit d'abord dans un fichier temporaire ".part" : si le dump plante en
# cours de route, aucune archive incomplète ne se retrouve dans le dossier
# (et donc "latest" ne pointera jamais sur une sauvegarde cassée).
TMP="$BACKUP_DIR/.${NAME}.part"

# En cas d'erreur ou d'interruption (Ctrl-C, arrêt du conteneur), on nettoie.
cleanup() { rm -f "$TMP"; }
trap cleanup ERR INT TERM

info "Sauvegarde de $MONGO_DB_URL en cours..."

# --archive : un seul flux binaire au lieu d'une arborescence de fichiers
# --gzip    : compression appliquée AVANT le chiffrement (chiffrer d'abord
#             rendrait la compression inutile, les données chiffrées étant
#             indiscernables d'un bruit aléatoire).
mongodump --uri="$MONGO_DB_URL" --archive --gzip --quiet | encrypt_stream > "$TMP"

# Garde-fou : une archive de quelques octets = un dump vide, donc un échec
# silencieux. Mieux vaut aucune sauvegarde qu'une fausse sauvegarde.
SIZE_BYTES=$(stat -c%s "$TMP")
[ "$SIZE_BYTES" -gt 256 ] || die "Archive suspecte (${SIZE_BYTES} octets) — sauvegarde annulée"

# Le renommage est instantané : l'archive apparaît d'un coup, complète.
mv "$TMP" "$FINAL"

# Empreinte d'intégrité posée à côté de l'archive : elle permettra plus tard de
# détecter une corruption du fichier (secteur disque abîmé, copie interrompue...).
( cd "$BACKUP_DIR" && sha256sum "$NAME" > "${NAME}.sha256" )

chmod 600 "$FINAL" "${FINAL}.sha256"   # lisible uniquement par le propriétaire
trap - ERR INT TERM

ok "Sauvegarde créée : $NAME ($(human_size "$FINAL"))"

# ===========================================================================
#  Rotation sur 14 jours glissants
# ===========================================================================
# On supprime les archives dont la date (lue dans le NOM du fichier, plus fiable
# que la date de modification qui change lors d'une copie) est antérieure à la
# limite de rétention. Le fichier .sha256 associé part avec.
CUTOFF="$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)"
DELETED=0

for f in "$BACKUP_DIR"/$ARCHIVE_GLOB; do
  [ -e "$f" ] || continue                       # aucun fichier ne correspond
  stamp="$(archive_stamp "$(basename "$f")")"
  [ -n "$stamp" ] || continue                   # nom non standard : on n'y touche pas
  day="${stamp%%_*}"                            # AAAA-MM-JJ

  # Comparaison de chaînes AAAA-MM-JJ : l'ordre lexicographique correspond à
  # l'ordre chronologique, pas besoin de reconvertir en timestamp.
  if [[ "$day" < "$CUTOFF" ]]; then
    rm -f "$f" "${f}.sha256"
    DELETED=$((DELETED + 1))
  fi
done

[ "$DELETED" -gt 0 ] && info "Rotation : $DELETED sauvegarde(s) de plus de ${RETENTION_DAYS} jours supprimée(s)"

TOTAL=$(ls -1 "$BACKUP_DIR"/$ARCHIVE_GLOB 2>/dev/null | wc -l)
info "$TOTAL sauvegarde(s) conservée(s) (rétention : ${RETENTION_DAYS} jours glissants)"

# Le log de cron ne doit pas grossir indéfiniment : on garde les 2000 dernières lignes.
LOG=/var/log/snell-backup.log
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
