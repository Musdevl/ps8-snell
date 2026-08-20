#!/bin/bash

# Ecrit l'URL publique du jeu dans les fichiers lus par le front et le user
# service. Cette valeur est executee dans le navigateur du visiteur : si elle
# pointe sur localhost, tous les appels API partent vers la machine du visiteur
# et rien ne fonctionne.
#
# Surchargeable pour deployer ailleurs :
#   PUBLIC_URL=http://mon-serveur:8000 ./aws_env_updater.sh

PUBLIC_URL="${PUBLIC_URL:-http://217.160.64.31:8000}"

FRONT_ENV_FILE="./files/front/env.js"
USER_ENV_FILE="./user/env.js"

cat > "$FRONT_ENV_FILE" << EOF
export const GATEWAY_URL = '$PUBLIC_URL';
EOF

cat > "$USER_ENV_FILE" << EOF
export const GATEWAY_URL = '$PUBLIC_URL';
EOF

echo "✅ URL publique : $PUBLIC_URL"
