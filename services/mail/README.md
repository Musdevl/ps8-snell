# Mail service

Envoie les mails transactionnels de Snell. Le service ne fait **que** ça : il
reçoit un destinataire et un lien déjà construit, met le mail en forme et
l'expédie.

Il ne connaît ni les comptes, ni les tokens, ni les durées de validité : ça
appartient au user service, qui possède déjà les utilisateurs. Il n'a donc pas de
base de données, comme `achievement` et `shop`.

Port `8006`, joignable uniquement depuis le réseau interne — le front ne l'appelle
jamais, il n'est donc pas routé par la gateway (même choix que `achievement`).

Dépendances : **Express** et **Nodemailer**.

---

## Endpoints

| Méthode | Route | Corps |
|---|---|---|
| `GET` | `/api/mail/health` | — |
| `POST` | `/api/mail/verification` | `{ to, username?, link }` |
| `POST` | `/api/mail/password-reset` | `{ to, username?, link }` |

`link` est l'URL complète sur laquelle l'utilisateur doit cliquer. C'est
l'appelant qui la fabrique, token compris.

```bash
curl -X POST http://localhost:8006/api/mail/verification \
  -H 'Content-Type: application/json' \
  -d '{"to":"test@exemple.fr","username":"Musdevl","link":"http://localhost:8000/api/user/verify?token=abc"}'
```

---

## Configuration

Tout passe par l'environnement, avec des valeurs par défaut qui visent Mailpit.

| Variable | Défaut | Rôle |
|---|---|---|
| `SMTP_HOST` | `mailpit` | hôte du relais |
| `SMTP_PORT` | `1025` | port du relais |
| `SMTP_SECURE` | `false` | `true` = TLS direct (465), `false` = STARTTLS (587, 2525) |
| `SMTP_USER` / `SMTP_PASS` | vides | omis si vides, ce qu'attend Mailpit |
| `MAIL_FROM` | `Snell <no-reply@snell.local>` | expéditeur affiché |

---

## Dev

```bash
docker compose up --build
```

Le compose de dev lance **Mailpit**, un faux serveur SMTP : rien ne sort de la
machine et les mails s'affichent sur <http://localhost:8025>. Le port `8006` est
publié pour pouvoir déclencher un envoi au curl.

## Envoyer sur de vraies adresses

Remplir `services/.env` à partir de [`.env.example`](../.env.example), puis :

```bash
docker compose up -d mail
```

Les variables sont lues à la création du conteneur, il n'y a pas besoin de
rebuild. `GET /api/mail/health` indique si le relais répond.

### Pourquoi Gmail

Le VPS n'a pas de nom de domaine, ce qui ferme deux portes.

Auto-héberger un SMTP est exclu : sans domaine, pas de SPF ni de DKIM, et le port
25 sortant est bloqué chez la plupart des hébergeurs.

Passer par un relais tiers (Brevo, Mailjet…) ne marche pas mieux. Depuis 2024,
Google, Yahoo et Microsoft exigent un expéditeur aligné DMARC, et personne
d'autre que Google ne peut signer en DKIM pour `gmail.com` : un relais tiers
affichant une adresse `@gmail.com` échoue cet alignement, et les mails se font
filtrer silencieusement.

Envoyer via Gmail avec un mot de passe d'application contourne le problème au
lieu de le combattre : on s'authentifie auprès de Google comme propriétaire réel
de l'adresse, donc l'alignement est natif.

Le code ne dépend d'aucun fournisseur — c'est du SMTP standard. Le jour où le
projet aura un nom de domaine, n'importe quel relais redeviendra utilisable en
changeant seulement le `.env`.

---

## Ce qu'il reste à faire côté user

Rien n'est encore branché ; l'ancien système de code de récupération reste en
place. Pour l'inscription, le user service devra générer un token, le stocker sur
l'utilisateur avec une date d'expiration, puis appeler :

```
POST http://mail:8006/api/mail/verification
{ "to": email, "username": username, "link": "<PUBLIC_GATEWAY_URL>/api/user/verify-email?token=<token>" }
```

`MAIL_SERVICE_URL` est déjà présent dans l'environnement du service `user` des
deux compose.
