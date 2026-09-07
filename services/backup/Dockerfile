# ---------------------------------------------------------------------------
# snell-backup — conteneur dédié aux sauvegardes chiffrées de MongoDB.
#
# On part de l'image officielle mongo : elle fournit mongosh et les outils
# mongodump / mongorestore compilés pour la bonne version du serveur.
# On y ajoute cron (planification) et openssl (chiffrement AES-256).
# ---------------------------------------------------------------------------
FROM mongo:7.0

ENV DEBIAN_FRONTEND=noninteractive

# cron       : planification de la sauvegarde quotidienne
# openssl    : chiffrement AES-256 des archives
# tzdata     : pour que "2h du matin" soit bien l'heure locale et pas UTC
# Selon les versions de l'image mongo, mongodump/mongorestore ne sont pas
# toujours inclus : on ne les installe que s'ils manquent réellement.
RUN apt-get update \
 && apt-get install -y --no-install-recommends cron openssl tzdata ca-certificates \
 && (command -v mongodump >/dev/null 2>&1 || apt-get install -y --no-install-recommends mongodb-database-tools) \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backup

# Le contexte de build est le dossier services/ (voir docker-compose.yml).
# Les trois scripts sont les MÊMES fichiers que ceux de services/ : sur l'hôte
# ils se relancent d'eux-mêmes ici, dans le conteneur ils font le vrai travail.
COPY backup.sh test-backup.sh restore-backup.sh ./
COPY backup/lib.sh ./lib.sh
COPY backup/entrypoint.sh /entrypoint.sh
COPY backup/crontab /etc/cron.d/snell-backup

# /.snell-backup est le marqueur qui permet aux scripts de savoir qu'ils
# tournent DANS le conteneur (voir in_container() dans lib.sh).
#
# /etc/cron.d/* est lu automatiquement par cron : aucune commande `crontab`
# n'est nécessaire. Le fichier doit juste appartenir à root et ne pas être
# modifiable par les autres (0644), sinon cron l'ignore silencieusement.
RUN touch /.snell-backup /var/log/snell-backup.log \
 && chmod +x /entrypoint.sh ./*.sh \
 && chmod 0644 /etc/cron.d/snell-backup

ENTRYPOINT ["/entrypoint.sh"]
