#!/usr/bin/env python3
"""
Test du service mail : vérifie que le relais SMTP répond, puis envoie un vrai mail.

N'utilise que la bibliothèque standard, il n'y a donc rien à installer — ni sur le
serveur, ni dans un conteneur.

Exemples :

    ./test-mail.py --to cyrilinveb@gmail.com
    ./test-mail.py --to cyrilinveb@gmail.com --type password-reset
    ./test-mail.py --to cyrilinveb@gmail.com --type all

Depuis un autre conteneur de la stack, le service est joignable par son nom :

    ./test-mail.py --to cyrilinveb@gmail.com --url http://mail:8006
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

TIMEOUT = 20

TYPES = {
    "verification": "/api/mail/verification",
    "password-reset": "/api/mail/password-reset",
}


def call(url, payload=None):
    """Appelle le service. Renvoie (code_http, corps_decode)."""
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    request = urllib.request.Request(url, data=data, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        # Le service renvoie ses erreurs en JSON, on veut les lire aussi.
        body = error.read()
        try:
            return error.code, json.loads(body or b"{}")
        except json.JSONDecodeError:
            return error.code, {"error": body.decode(errors="replace")}
    except urllib.error.URLError as error:
        raise SystemExit(
            f"✗ Service injoignable sur {url}\n"
            f"  {error.reason}\n\n"
            f"  Le conteneur tourne-t-il ? docker compose ps mail"
        )


def check_health(base_url):
    """Affiche l'état du relais SMTP. Renvoie True s'il est joignable."""
    _, body = call(f"{base_url}/api/mail/health")
    smtp = body.get("smtp", {})

    if smtp.get("ok"):
        print(f"✓ Relais SMTP joignable — {smtp.get('target')}")
        return True

    print(f"✗ Relais SMTP injoignable — {smtp.get('target')}")
    print(f"  {smtp.get('error')}")
    print()
    print("  Invalid login       -> identifiants faux dans mail/config.yaml,")
    print("                         ou mot de passe généré sur un autre compte Google")
    print("  Connection timeout  -> port sortant bloqué par l'hébergeur")
    return False


def send(base_url, kind, to, username, link):
    """Envoie un mail et affiche le résultat."""
    status, body = call(f"{base_url}{TYPES[kind]}", {"to": to, "username": username, "link": link})

    if status == 200 and body.get("success"):
        print(f"✓ {kind:15} accepté par le relais, à destination de {to}")
        return True

    print(f"✗ {kind:15} refusé (HTTP {status})")
    print(f"  {body.get('error', body)}")
    if body.get("message"):
        print(f"  {body['message']}")
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Envoie un mail de test via le service mail.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--to", required=True, help="adresse du destinataire")
    parser.add_argument("--url", default="http://localhost:8006", help="URL du service (défaut : %(default)s)")
    parser.add_argument("--type", choices=[*TYPES, "all"], default="verification",
                        help="type de mail à envoyer (défaut : %(default)s)")
    parser.add_argument("--username", default="Testeur", help="pseudo affiché dans le mail")
    parser.add_argument("--link", default="http://localhost:8000/",
                        help="lien placé derrière le bouton (défaut : %(default)s)")

    args = parser.parse_args()
    base_url = args.url.rstrip("/")

    print(f"Service : {base_url}")
    print()

    # Un relais injoignable ferait échouer tous les envois : autant s'arrêter là
    # avec un message clair plutôt que d'enchaîner des erreurs identiques.
    if not check_health(base_url):
        sys.exit(1)

    print()

    kinds = list(TYPES) if args.type == "all" else [args.type]
    results = [send(base_url, kind, args.to, args.username, args.link) for kind in kinds]

    print()
    if all(results):
        print(f"Terminé. Vérifie la boîte de {args.to} — et les spams.")
        sys.exit(0)

    sys.exit(1)


if __name__ == "__main__":
    main()
