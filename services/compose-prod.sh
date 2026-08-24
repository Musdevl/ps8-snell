#!/bin/bash
set -e

# ENV n'est volontairement pas mis a "prod" : cela ferait basculer la gateway en
# HTTPS, or sans nom de domaine il n'y a pas de certificat valide possible.
# Le jour ou le projet aura un domaine, ajouter ENV=prod devant la commande up
# et remonter le volume ../secrets/https dans docker-compose-prod.yml.

echo "☁️ Démarrage de l'environnement de production..."
chmod +x aws_env_updater.sh
./aws_env_updater.sh

echo "🔨 Build des services..."
docker compose -f docker-compose-prod.yml build

docker compose -f docker-compose-prod.yml up -d

echo "✅ En ligne sur ${PUBLIC_URL:-http://217.160.64.31:8000}"
