#!/bin/bash
# ---------------------------------------------------------------------------
# test-backup.sh — teste une sauvegarde SANS toucher aux données de production.
#
#   ./test-backup.sh                 → teste la sauvegarde la plus récente
#   ./test-backup.sh --full          → test approfondi
#   ./test-backup.sh snell-2026-09-04_020000.archive.gz.enc
#
# Une sauvegarde jamais testée n'est pas une sauvegarde. Deux niveaux :
#
#   RAPIDE (par défaut, quelques secondes)
#     1. l'empreinte SHA-256 correspond      → le fichier n'est pas corrompu
#     2. le déchiffrement AES aboutit        → la clé est la bonne
#     3. mongorestore --dryRun lit l'archive → le dump est valide
#        (--dryRun analyse tout le flux mais n'écrit RIEN dans la base)
#
#   COMPLET (--full, plus long)
#     4. l'archive est réellement restaurée dans des bases temporaires
#        "snellverify__<base>", les documents sont comptés, puis ces bases
#        temporaires sont supprimées. Les bases de production ne sont jamais
#        touchées : c'est une vraie répétition générale de la restauration.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

# lib.sh est à côté du script dans le conteneur (/app/backup/), et dans le
# sous-dossier backup/ quand on est sur l'hôte (services/backup/).
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SELF_DIR/lib.sh" ]; then . "$SELF_DIR/lib.sh"; else . "$SELF_DIR/backup/lib.sh"; fi

VERIFY_PREFIX="snellverify__"   # préfixe des bases temporaires du test complet

usage() {
  cat <<USAGE

  ./test-backup.sh [latest|<fichier>] [--full]

    (sans argument)   Teste la sauvegarde la plus récente
    --full            Restauration de contrôle réelle dans des bases
                      temporaires, puis suppression de ces bases

  Lister les sauvegardes : ./backup.sh --list

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
#    relancer après, c'était perdre --full et le nom de l'archive en route.
in_container || relaunch_in_container "$@"

# --- Arguments ------------------------------------------------------------
TARGET="latest"
FULL=false
while [ $# -gt 0 ]; do
  case "$1" in
    --full) FULL=true; shift ;;
    -*) die "Argument inconnu : $1  (voir ./test-backup.sh --help)" ;;
    *)  TARGET="$1"; shift ;;
  esac
done

require_key
require_mongo

ARCHIVE="$(resolve_backup "$TARGET")"
NAME="$(basename "$ARCHIVE")"

echo
info "Test de la sauvegarde : $NAME ($(human_size "$ARCHIVE"))"
echo

# --- Étape 1 : intégrité du fichier ---------------------------------------
if check_checksum "$ARCHIVE"; then
  ok "1/3  Intégrité du fichier (SHA-256) : conforme"
else
  die "1/3  Intégrité du fichier (SHA-256) : ÉCHEC — archive corrompue"
fi

# --- Étapes 2 et 3 : déchiffrement et lecture du dump ---------------------
# Si la clé était mauvaise ou le fichier tronqué, openssl échoue sur le
# contrôle de padding ; si l'archive était corrompue plus loin, mongorestore
# échoue en la parcourant. Les deux cas font échouer le pipe (grâce à pipefail).
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

if decrypt_stream < "$ARCHIVE" \
     | mongorestore --uri="$MONGO_DB_URL" --archive --gzip --dryRun \
                    --nsExclude='admin.*' --nsExclude='config.*' > "$LOG" 2>&1
then
  ok "2/3  Déchiffrement AES-256 : réussi (la clé correspond)"
  ok "3/3  Lecture du dump MongoDB : archive valide"
else
  cat "$LOG" >&2
  die "Déchiffrement ou lecture du dump : ÉCHEC
   → clé BACKUP_ENCRYPTION_KEY différente de celle ayant servi à créer
     l'archive, ou archive corrompue"
fi

# Le résumé de mongorestore indique le nombre de documents lus.
grep -E 'document\(s\) restored|documents? restored' "$LOG" | tail -n1 | sed 's/^/     /' || true

# --- Étape 4 (option --full) : vraie restauration de contrôle -------------
if [ "$FULL" = true ]; then
  echo
  info "Test complet : restauration dans des bases temporaires ${VERIFY_PREFIX}*"

  # --nsFrom / --nsTo réécrivent les noms de namespaces à la volée :
  #   $db$ et $col$ sont des variables comprises par mongorestore.
  #   "snell.users" devient donc "snellverify__snell.users".
  decrypt_stream < "$ARCHIVE" \
    | mongorestore --uri="$MONGO_DB_URL" --archive --gzip --drop --quiet \
                   --nsExclude='admin.*' --nsExclude='config.*' \
                   --nsFrom='$db$.$col$' --nsTo="${VERIFY_PREFIX}"'$db$.$col$'

  echo
  info "Contenu restauré (bases temporaires) :"
  mongosh "$MONGO_DB_URL" --quiet --eval "
    const prefix = '${VERIFY_PREFIX}';
    let total = 0;
    db.adminCommand({listDatabases:1}).databases
      .filter(d => d.name.startsWith(prefix))
      .forEach(d => {
        const t = db.getSiblingDB(d.name);
        t.getCollectionNames().sort().forEach(c => {
          const n = t.getCollection(c).countDocuments();
          total += n;
          print('  ' + d.name.slice(prefix.length) + '.' + c + ' : ' + n + ' documents');
        });
      });
    print('  ---');
    print('  Total : ' + total + ' documents restaurés avec succès');
  "

  # Nettoyage : on ne laisse jamais traîner les bases de test.
  info "Suppression des bases temporaires de test..."
  mongosh "$MONGO_DB_URL" --quiet --eval "
    const prefix = '${VERIFY_PREFIX}';
    db.adminCommand({listDatabases:1}).databases
      .filter(d => d.name.startsWith(prefix))
      .forEach(d => db.getSiblingDB(d.name).dropDatabase());
  "
  ok "Bases temporaires supprimées — la production n'a jamais été touchée"
fi

echo
ok "Sauvegarde $NAME : TESTÉE ET RESTAURABLE"
