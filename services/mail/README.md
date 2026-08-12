# Mail service

Envoi des mails transactionnels de Snell : **validation d'adresse à l'inscription** et
**réinitialisation de mot de passe**. Le service porte tout le cycle de vie des liens
(génération, expiration, usage unique) ; le user service n'aura qu'à exposer trois
routes internes pour appliquer le résultat.

Port `8006`. Joignable de l'extérieur via la gateway, sous `/api/mail/*`.

C'est le premier service du projet à utiliser des dépendances externes :
**Express** (redirections navigateur, que `badExpress` ne sait pas faire) et
**Nodemailer** (SMTP).

---

## Endpoints

| Méthode | Route | Appelé par | Rôle |
|---|---|---|---|
| `GET` | `/api/mail/health` | supervision | état du service + résultat du dernier test SMTP |
| `POST` | `/api/mail/verification/request` | user service | envoie le mail de validation — `{ userId, email, username? }` |
| `GET` | `/api/mail/verification/confirm?token=` | navigateur (lien du mail) | valide le compte puis redirige vers le front |
| `POST` | `/api/mail/password-reset/request` | front | envoie le mail de reset — `{ email }` |
| `GET` | `/api/mail/password-reset/confirm?token=` | navigateur (lien du mail) | vérifie le lien puis redirige vers le formulaire |
| `POST` | `/api/mail/password-reset/complete` | front | applique le nouveau mot de passe — `{ token, new_password }` |
| `GET` | `/api/mail/console` | toi, en dev | console d'envoi (page HTML), 404 si `ENV=prod` |
| `POST` | `/api/mail/test` | la console | envoie un mail réel — `{ to, type }`, 404 si `ENV=prod` |

Les redirections pointent vers `/pages/auth/login/` avec un état en query string :
`?verified=1`, `?verified=0&reason=expired|invalid|error`, `?reset_token=<token>`,
`?reset=0&reason=…`. Le front ne les lit pas encore.

---

## Sécurité

- **Tokens hashés** : 32 octets aléatoires, seul le SHA-256 est stocké. Une fuite de
  la collection `mail_tokens` ne permet pas de forger un lien.
- **Usage unique et atomique** : la consommation est un `updateOne` filtré sur
  `consumedAt: null`, donc deux clics simultanés ne peuvent pas passer tous les deux.
- **Expiration** : 24 h pour la validation, 1 h pour le reset. Index TTL Mongo en
  filet de sécurité, mais la vérification fait foi en code.
- **Un seul lien valide à la fois** : redemander un mail révoque le précédent.
- **Pas d'énumération de comptes** : `/password-reset/request` répond toujours
  `{ success: true }`, que l'adresse existe ou non.
- **Anti-spam** : 1 mail par adresse et par type toutes les 60 s (en mémoire, donc
  remis à zéro au redémarrage — suffisant à cette échelle).
- **Lien déjà consommé = succès** côté validation : les antivirus et « safe links »
  ouvrent les URL des mails avant l'utilisateur, ce qui brûlerait le token sinon.

---

## Configuration

Toutes les variables sont dans [`config.js`](config.js), alimentées par l'environnement.
Voir [`../.env.example`](../.env.example) pour les valeurs de prod.

| Variable | Défaut | Rôle |
|---|---|---|
| `MAIL_SERVICE_PORT` | `8006` | port d'écoute |
| `MONGO_DB_URL` | `mongodb://localhost:27017` | base `snelldb`, collection `mail_tokens` |
| `USER_SERVICE_URL` | `http://localhost:8010` | pour appliquer validation et nouveau mot de passe |
| `PUBLIC_GATEWAY_URL` | `http://localhost:8000` | **base de tous les liens envoyés** |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `mailpit` / `1025` / `false` | relais SMTP |
| `SMTP_USER` / `SMTP_PASS` | vides | omis si vides (Mailpit accepte l'anonyme) |
| `MAIL_FROM` | `Snell <no-reply@snell.local>` | expéditeur affiché |

`PUBLIC_GATEWAY_URL` est la variable la plus facile à rater : si elle vaut
`http://localhost:8000` en prod, les mails partent avec des liens qui ne mènent
nulle part chez le destinataire.

### Choix du relais SMTP

Le VPS n'a pas de nom de domaine, donc **auto-héberger un SMTP est exclu** : sans
domaine, pas de SPF/DKIM/DMARC, et le port 25 sortant est bloqué chez la plupart des
hébergeurs — les mails seraient rejetés ou classés en spam. Il faut un relais tiers.
Le code ne dépend d'aucun fournisseur : c'est du SMTP standard.

Gratuits et utilisables **sans nom de domaine** (expéditeur = une adresse perso validée) :
**Brevo** (300/jour, recommandé) ou **Gmail** (500/jour, mot de passe d'application).

---

## Lancer et tester

Depuis `services/`, sans aucune configuration préalable :

```bash
docker compose up --build
```

Le compose de dev embarque **Mailpit** : faux serveur SMTP, rien ne sort de la
machine, et tous les mails envoyés s'affichent dans une interface web.

Trois adresses, en remplaçant `localhost` par l'IP du serveur le cas échéant :

| Adresse | Quoi |
|---|---|
| <http://localhost:8006> | **console d'envoi** — formulaire pour déclencher un mail |
| <http://localhost:8025> | **Mailpit** — les mails reçus |
| <http://localhost:8000> | le jeu |

La console est servie par le service lui-même sur son port `8006`, publié en dev.
Elle contourne donc la gateway, qui exigerait un JWT sur `/api/mail/test` comme sur
`/api/mail/health`. Elle renvoie 404 si `ENV=prod`.

Le mail de test part avec un **vrai token** : le lien reçu est cliquable et déroule
le même chemin que le parcours réel (consommation du token, redirection vers le
front), seul l'utilisateur est fictif.

Sans `PUBLIC_GATEWAY_URL`, la base des liens est déduite de l'hôte par lequel la
requête est arrivée — les liens sont donc corrects sur un serveur distant sans rien
configurer. Les avertissements de configuration sont affichés au démarrage :
`docker compose logs mail`.

> Ni la console ni Mailpit n'ont d'authentification, et les ports `8006` et `8025`
> ne sont publiés que par le compose de dev. Ne pas les laisser ouverts sur Internet
> en dehors des tests.

---

## Ce qu'il reste à faire côté user (prochaine passe)

Le service est complet et testable seul, mais l'étape finale de chaque parcours
appelle le user service, qui n'expose pas encore ces routes. Elles échouent
aujourd'hui avec un log explicite — c'est volontaire.

| Route à créer | Corps | Effet attendu |
|---|---|---|
| `GET /api/user/internal/by-email/{email}` | — | `{ userId, username }` ou 404 |
| `POST /api/user/internal/verify-account` | `{ userId }` | passe `email_verified` à `true` |
| `POST /api/user/internal/set-password` | `{ userId, new_password }` | hash bcrypt + sauvegarde |

Puis, toujours côté user :

1. appeler `POST {MAIL_SERVICE_URL}/api/mail/verification/request` à l'inscription ;
2. ajouter `MAIL_SERVICE_URL=http://mail:8006` à l'environnement du service `user`
   dans les deux compose ;
3. **ajouter `/api/user/internal/` à `BLACK_LIST_ROUTES`** dans la gateway, sinon ces
   routes deviennent joignables depuis Internet et `set-password` permet de changer le
   mot de passe de n'importe qui (c'est exactement le trou actuel de
   `/api/user/hard-reset-password`, à supprimer au passage) ;
4. retirer `generateCode()`, le champ `verification_code` et la popup de
   `register.js`, puis réécrire le parcours « mot de passe oublié » du front autour de
   `?reset_token=`.

Note : `/password-reset/complete` impose 8 caractères minimum, alors que
l'inscription n'impose rien aujourd'hui. À aligner lors de cette passe.
