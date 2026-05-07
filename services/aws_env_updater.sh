#!/bin/bash

# Chemin du fichier
FRONT_ENV_FILE="./files/front/env.js"

USER_ENV_FILE="./user/env.js"

# Nouvelle valeur
GATEWAY_URL="https://snell.ps8.pns.academy"

# Créer le contenu
cat > "$FRONT_ENV_FILE" << EOF
export const GATEWAY_URL = '$GATEWAY_URL';
EOF

echo "✅ Fichier $FRONT_ENV_FILE mis à jour avec GATEWAY_URL = $GATEWAY_URL"

# Créer le contenu
cat > "$USER_ENV_FILE" << EOF
export const GATEWAY_URL = '$GATEWAY_URL';
EOF

echo "✅ Fichier $USER_ENV_FILE mis à jour avec GATEWAY_URL = $GATEWAY_URL"