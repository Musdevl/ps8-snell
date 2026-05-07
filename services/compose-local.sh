#!/bin/bash
set -e
echo "🚀 Démarrage de l'environnement LOCAL..."

chmod +x local_env_updater.sh
./local_env_updater.sh

docker compose -f docker-compose-dev.yml up --build