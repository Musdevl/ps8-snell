#!/bin/bash
# ---------------------------------------------------------------------------
# entrypoint.sh — démarrage du conteneur snell-backup.
#
# Rôle du conteneur : rester allumé et déclencher backup.sh tous les jours
# à 2h du matin via cron. Il ne sert rien sur le réseau.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

LOG=/var/log/snell-backup.log

# --- 1. Fuseau horaire ----------------------------------------------------
# Sans ça, cron raisonne en UTC et "2h du matin" tomberait à 3h ou 4h heure
# française selon la saison.
if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
  echo "$TZ" > /etc/timezone
fi

# --- 2. Transmission de l'environnement à cron ----------------------------
# cron démarre ses tâches dans un environnement quasiment vide : les variables
# passées par docker-compose (dont la clé de chiffrement lue dans services/.env)
# seraient perdues. On les recopie donc dans un fichier que lib.sh recharge à
# chaque exécution. Ce fichier n'est lisible que par root (chmod 600).
{
  echo "MONGO_DB_URL='${MONGO_DB_URL:-mongodb://mongodb:27017}'"
  echo "BACKUP_DIR='${BACKUP_DIR:-/backup}'"
  echo "BACKUP_ENCRYPTION_KEY='${BACKUP_ENCRYPTION_KEY:-}'"
  echo "BACKUP_RETENTION_DAYS='${BACKUP_RETENTION_DAYS:-14}'"
  echo "BACKUP_PBKDF2_ITER='${BACKUP_PBKDF2_ITER:-200000}'"
  echo "TZ='${TZ:-UTC}'"
} > /etc/snell-backup.env
chmod 600 /etc/snell-backup.env

# --- 3. Vérifications de démarrage ---------------------------------------
mkdir -p "${BACKUP_DIR:-/backup}"
touch "$LOG"

echo
echo "──────────────────────────────────────────────────────────────"
echo "  📦  BACKUP SERVICE "
echo "──────────────────────────────────────────────────────────────"

echo "   base          : ${MONGO_DB_URL:-mongodb://mongodb:27017}"
echo "   destination   : ${BACKUP_DIR:-/backup}  (dossier ./backup de l'hôte)"
echo "   rétention     : ${BACKUP_RETENTION_DAYS:-14} jours glissants"
echo "   fuseau        : ${TZ:-UTC}  —  heure actuelle : $(date '+%Y-%m-%d %H:%M:%S')"
echo "   planification : tous les jours à 02:00"
echo 


if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "⚠️  ATTENTION : BACKUP_ENCRYPTION_KEY est vide."
  echo "   Les sauvegardes échoueront tant que la clé n'est pas définie."
  echo "   → Depuis services/ :  ./backup.sh --genkey"
  echo "     puis collez la ligne dans services/.env"
  echo "     et rechargez :      docker compose up -d backup"
fi

# --- 4. Sauvegarde immédiate au démarrage (optionnelle) -------------------
if [ "${BACKUP_ON_START:-false}" = "true" ]; then
  echo "BACKUP_ON_START=true → sauvegarde immédiate..."
  bash /app/backup/backup.sh >> "$LOG" 2>&1 || echo "⚠️  La sauvegarde de démarrage a échoué (voir les logs)"
fi

# --- 5. cron en tâche de fond + log en avant-plan -------------------------
# On lance cron en démon puis on suit le fichier de log : ce `tail` garde le
# conteneur vivant ET fait remonter la sortie des sauvegardes dans
# `docker logs snell-backup`.
cron
exec tail -F "$LOG"
