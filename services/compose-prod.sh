#!/bin/bash
set -e
echo "☁️ Démarrage de l'environnement AWS..."
chmod +x aws_env_updater.sh
./aws_env_updater.sh

echo "🔨 Build des services..."
docker compose -f docker-compose-prod.yml build

ENV=prod docker compose -f docker-compose-prod.yml up -d
echo "✅ Environnement AWS démarré!"