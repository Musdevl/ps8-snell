#!/usr/bin/env bash
#
# Configure le service mail pour envoyer sur de vraies adresses.
#
# Écrit services/.env (ignoré par git), recrée le conteneur mail et vérifie que
# le relais SMTP répond. À lancer depuis services/ :
#
#   ./setup-mail.sh
#
# Sans ce fichier .env, le service envoie tout dans Mailpit : rien ne sort de la
# machine. Supprimer ou renommer le .env suffit à revenir à ce comportement.

set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env"

say() { printf '%s\n' "$*"; }
ask() { local prompt="$1" default="${2:-}" answer; read -rp "$prompt" answer </dev/tty; printf '%s' "${answer:-$default}"; }

say "Configuration du service mail"
say "============================="
say ""

# ── Fournisseur ──────────────────────────────────────────────────────────────

say "1) Gmail          — 500 mails/jour, mot de passe d'application requis"
say "2) Brevo          — 300 mails/jour, meilleure délivrabilité"
say "3) Autre relais   — saisie manuelle de l'hôte et du port"
say ""
choice=$(ask "Fournisseur [1] : " "1")

case "$choice" in
    1) SMTP_HOST="smtp.gmail.com"; SMTP_PORT="587" ;;
    2) SMTP_HOST="smtp-relay.brevo.com"; SMTP_PORT="587" ;;
    3)
        SMTP_HOST=$(ask "Hôte SMTP : ")
        SMTP_PORT=$(ask "Port [587] : " "587")
        ;;
    *) say "Choix invalide."; exit 1 ;;
esac

# Le port 465 est du TLS direct, le 587 du STARTTLS. Se tromper ici produit un
# timeout peu parlant, donc on le déduit du port plutôt que de le demander.
if [ "$SMTP_PORT" = "465" ]; then SMTP_SECURE="true"; else SMTP_SECURE="false"; fi

# ── Identifiants ─────────────────────────────────────────────────────────────

say ""
if [ "$choice" = "1" ]; then
    say "Le mot de passe d'application se génère sur :"
    say "  https://myaccount.google.com/apppasswords"
    say "(la validation en deux étapes doit être active sur le compte)"
    say ""
fi

SMTP_USER=$(ask "Identifiant SMTP (ton adresse mail) : ")
[ -n "$SMTP_USER" ] || { say "Identifiant vide, abandon."; exit 1; }

read -rsp "Mot de passe SMTP (invisible) : " SMTP_PASS </dev/tty
say ""

# Google affiche le mot de passe d'application en 4 groupes de 4 : collé tel
# quel avec ses espaces, il est refusé. On les retire systématiquement.
SMTP_PASS="${SMTP_PASS// /}"
[ -n "$SMTP_PASS" ] || { say "Mot de passe vide, abandon."; exit 1; }

# Gmail n'autorise à envoyer qu'au nom du compte authentifié.
if [ "$choice" = "1" ]; then
    MAIL_FROM="Snell <$SMTP_USER>"
else
    sender=$(ask "Adresse d'expéditeur [$SMTP_USER] : " "$SMTP_USER")
    MAIL_FROM="Snell <$sender>"
fi

# ── Adresse publique ─────────────────────────────────────────────────────────

say ""
say "Détection de l'adresse publique du serveur..."
detected=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)

if [ -n "$detected" ]; then
    say "  trouvée : $detected"
    host=$(ask "Adresse pour les liens des mails [$detected] : " "$detected")
else
    say "  échec de la détection"
    host=$(ask "Adresse pour les liens des mails (IP ou domaine) : ")
fi
[ -n "$host" ] || { say "Adresse vide, abandon."; exit 1; }

case "$host" in
    http://*|https://*) PUBLIC_GATEWAY_URL="$host" ;;
    *) PUBLIC_GATEWAY_URL="http://$host:8000" ;;
esac

# ── Écriture ─────────────────────────────────────────────────────────────────

if [ -f "$ENV_FILE" ]; then
    backup="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
    cp "$ENV_FILE" "$backup"
    say ""
    say "Un $ENV_FILE existait déjà, sauvegardé dans $backup"
fi

# Les valeurs ne sont pas entourées de guillemets : docker compose lit le fichier
# lui-même, sans passer par un shell, donc des guillemets finiraient dans la valeur.
cat > "$ENV_FILE" <<EOF
# Généré par setup-mail.sh le $(date '+%Y-%m-%d %H:%M:%S')
# Ne jamais committer ce fichier (déjà couvert par .gitignore).

PUBLIC_GATEWAY_URL=$PUBLIC_GATEWAY_URL

SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
MAIL_FROM=$MAIL_FROM
EOF

chmod 600 "$ENV_FILE"

say ""
say "$ENV_FILE écrit :"
say "  relais      $SMTP_HOST:$SMTP_PORT (secure=$SMTP_SECURE)"
say "  expéditeur  $MAIL_FROM"
say "  liens       $PUBLIC_GATEWAY_URL"

# ── Redémarrage et vérification ──────────────────────────────────────────────

say ""
say "Recréation du conteneur mail..."
docker compose up -d mail

say "Attente du démarrage..."
sleep 4

say ""
say "État du relais :"
docker compose exec -T mail node -e "
fetch('http://localhost:8006/api/mail/health')
  .then(r => r.json())
  .then(h => {
      console.log('  SMTP  : ' + (h.smtp.ok ? 'joignable' : 'INJOIGNABLE — ' + h.smtp.error));
      console.log('  hôte  : ' + h.smtp.host + ':' + h.smtp.port);
      console.log('  liens : ' + h.publicBase);
      process.exit(h.smtp.ok ? 0 : 1);
  })
  .catch(e => { console.log('  service injoignable : ' + e.message); process.exit(1); });
" || {
    say ""
    say "Le relais ne répond pas. Les causes les plus fréquentes :"
    say "  - mot de passe d'application invalide ou 2FA inactive (Gmail)"
    say "  - port $SMTP_PORT sortant bloqué par l'hébergeur"
    say "  - SMTP_SECURE incohérent avec le port (465 = true, 587 = false)"
    say ""
    say "Détail : docker compose logs mail | tail -20"
    exit 1
}

console_host=${PUBLIC_GATEWAY_URL#*://}
console_host=${console_host%%:*}
console_host=${console_host%%/*}

say ""
say "Prêt. Console d'envoi : http://$console_host:8006"
say "Pour revenir à Mailpit : mv .env .env.off && docker compose up -d mail"
