#!/bin/bash
# ---------------------------------------------------------------------------
# restore-backup.sh — restaure MongoDB à partir d'une sauvegarde chiffrée.
#
#   ./restore-backup.sh              → restaure la sauvegarde la plus récente
#   ./restore-backup.sh snell-2026-09-02_020000.archive.gz.enc
#
# Chaîne inverse de la sauvegarde :
#
#   fichier .enc  →  openssl enc -d  →  mongorestore --archive --gzip  →  MongoDB
#
# ⚠️  Une restauration ÉCRASE les collections présentes dans l'archive.
#     Le script vérifie l'intégrité de l'archive et demande confirmation, mais
#     ne sauvegarde PAS l'état actuel au passage : une telle sauvegarde
#     automatique deviendrait la plus récente, et un `./restore-backup.sh`
#     lancé juste après (sans argument, donc sur "latest") restaurerait
#     l'état qu'on cherchait justement à écraser.
#     Si vous voulez ce filet, prenez-le explicitement AVANT :
#         ./backup.sh --label avant-restore
# ---------------------------------------------------------------------------
set -Eeuo pipefail

# lib.sh est à côté du script dans le conteneur (/app/backup/), et dans le
# sous-dossier backup/ quand on est sur l'hôte (services/backup/).
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SELF_DIR/lib.sh" ]; then . "$SELF_DIR/lib.sh"; else . "$SELF_DIR/backup/lib.sh"; fi

usage() {
  cat <<USAGE

  ./restore-backup.sh [latest|<fichier>] [--yes]

    (sans argument)   Restaure la sauvegarde la plus récente
    --yes             Ne demande pas de confirmation

  Lister les sauvegardes    : ./backup.sh --list
  Tester avant de restaurer : ./test-backup.sh <fichier>
  Garder l'état actuel      : ./backup.sh --label avant-restore

USAGE
}

# --help doit marcher même conteneur éteint : on le traite avant tout.
for arg in "$@"; do
  case "$arg" in -h|--help) usage; exit 0 ;; esac
done

# Sur l'hôte, on relance ce même script dans le conteneur snell-backup, qui
# possède mongorestore et openssl (voir lib.sh), avec les MÊMES arguments.
#
# ⚠️ Avant la boucle de parsing : celle-ci vide "$@" avec ses `shift`, et
#    relancer après, c'était perdre --yes et le nom de l'archive en route.
in_container || relaunch_in_container "$@"

# --- Arguments ------------------------------------------------------------
TARGET="latest"
ASSUME_YES=false        # --yes : ne pas demander de confirmation (usage scripté)

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true; shift ;;
    -*) die "Argument inconnu : $1  (voir ./restore-backup.sh --help)" ;;
    *)  TARGET="$1"; shift ;;
  esac
done

require_key
require_mongo

ARCHIVE="$(resolve_backup "$TARGET")"
NAME="$(basename "$ARCHIVE")"

info "Sauvegarde sélectionnée : $NAME ($(human_size "$ARCHIVE"))"

# --- 1. Intégrité du fichier ---------------------------------------------
if check_checksum "$ARCHIVE"; then
  ok "Empreinte SHA-256 valide"
else
  die "Empreinte SHA-256 INVALIDE : le fichier est corrompu, restauration annulée
   → Choisissez une autre sauvegarde : ./backup.sh --list"
fi

# --- 2. Confirmation ------------------------------------------------------
# On liste les bases actuellement présentes pour que l'utilisateur voie
# précisément ce qu'il est sur le point d'écraser.
if [ "$ASSUME_YES" != true ]; then
  echo
  echo "${C_YELLOW}Bases actuellement présentes sur $MONGO_DB_URL :${C_RESET}"
  mongosh "$MONGO_DB_URL" --quiet --eval '
    db.adminCommand({listDatabases:1}).databases
      .filter(d => !["admin","config","local"].includes(d.name))
      .forEach(d => print("  - " + d.name));
  ' || true
  echo
  echo "${C_RED}Ces données vont être remplacées par le contenu de $NAME.${C_RESET}"
  echo "${C_DIM}Pour garder une copie de l'état actuel, annulez et lancez d'abord :"
  echo "  ./backup.sh --label avant-restore${C_RESET}"
  read -r -p "Tapez 'restore' pour confirmer : " answer
  [ "$answer" = "restore" ] || die "Restauration annulée par l'utilisateur"
fi

# --- 3. Restauration ------------------------------------------------------
# --drop      : chaque collection présente dans l'archive est vidée avant
#               d'être réécrite (sinon les anciens documents survivraient et
#               se mélangeraient aux restaurés).
# --nsExclude : on ne restaure pas les bases internes de MongoDB (admin/config),
#               qui appartiennent au serveur et non à l'application.
info "Restauration en cours..."
decrypt_stream < "$ARCHIVE" \
  | mongorestore --uri="$MONGO_DB_URL" --archive --gzip --drop \
                 --nsExclude='admin.*' --nsExclude='config.*' \
                 --quiet

ok "Base restaurée depuis $NAME"

# --- 4. Résumé ------------------------------------------------------------
echo
info "État de la base après restauration :"
mongosh "$MONGO_DB_URL" --quiet --eval '
  db.adminCommand({listDatabases:1}).databases
    .filter(d => !["admin","config","local"].includes(d.name))
    .forEach(d => {
      const target = db.getSiblingDB(d.name);
      target.getCollectionNames().sort().forEach(c => {
        print("  " + d.name + "." + c + " : " + target.getCollection(c).countDocuments() + " documents");
      });
    });
'
