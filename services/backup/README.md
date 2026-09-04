# 🔐 Sauvegardes chiffrées de MongoDB

Sauvegardes **automatiques**, **chiffrées en AES-256** et **restaurables** de la
base MongoDB de Snell.

- ⏰ une sauvegarde par jour, **à 2h du matin**, sans rien avoir à lancer
- 🔒 chaque archive est chiffrée **AES-256-CBC** avec une clé qui reste chez vous
- 🗂 les archives atterrissent dans le dossier **`backup/`** à la racine du dépôt
- ♻️ **rétention de 14 jours glissants** : le ménage est fait tout seul
- 🧪 chaque sauvegarde peut être **testée** sans toucher à la production
- ⏪ restauration en une commande, avec filet de sécurité

---

## Table des matières

- [Les trois scripts](#les-trois-scripts)
- [Démarrage en 3 minutes](#démarrage-en-3-minutes)
- [Comment ça marche](#comment-ça-marche)
- [Où sont les fichiers](#où-sont-les-fichiers)
- [Scénarios courants](#scénarios-courants)
- [Configuration](#configuration)
- [Dépannage](#dépannage)

---

## Les trois scripts

Tout se passe depuis le dossier `services/`, à côté de `launch.sh` :

| Script | Rôle |
|---|---|
| **`./backup.sh`** | Crée une sauvegarde chiffrée. C'est aussi celui que cron lance à 2h. |
| **`./test-backup.sh`** | Teste une sauvegarde sans toucher à la production. |
| **`./restore-backup.sh`** | Restaure la base à partir d'une sauvegarde. |

| Commande | Ce qu'elle fait |
|---|---|
| `./backup.sh` | Sauvegarde immédiate (en plus de celle de 2h). |
| `./backup.sh --list` | Liste les sauvegardes : nom, taille, date, intégrité. |
| `./backup.sh --genkey` | Génère une clé AES-256 à coller dans `services/.env`. |
| `./test-backup.sh` | Teste la **dernière** sauvegarde. |
| `./test-backup.sh --full` | Test approfondi : restauration de contrôle réelle. |
| `./test-backup.sh <fichier>` | Teste une sauvegarde précise. |
| `./restore-backup.sh` | Restaure depuis la **dernière** sauvegarde. |
| `./restore-backup.sh <fichier>` | Restaure depuis une sauvegarde précise. |
| `docker logs -f snell-backup` | Journal des sauvegardes automatiques. |

Partout où un fichier est attendu, le mot-clé **`latest`** (valeur par défaut)
désigne la sauvegarde la plus récente. Chaque script accepte `--help`.

> 💡 **Vous n'avez jamais à taper une commande `docker`.** Lancés depuis l'hôte,
> les scripts se relancent tout seuls à l'intérieur du conteneur `snell-backup`
> (voir [Comment ça marche](#hôte-ou-conteneur-)).

---

## Démarrage en 3 minutes

### 1. Générer la clé de chiffrement (une seule fois)

```bash
cd services
./backup.sh --genkey
```

Le script affiche une ligne prête à coller dans **`services/.env`** :

```dotenv
BACKUP_ENCRYPTION_KEY="H/sIeKNkrfUJvkJqR1t7ty7CCQXB14mdagEtFFc53enm..."
```

> ⚠️ **Sauvegardez cette clé ailleurs** (gestionnaire de mots de passe, clé USB).
> `services/.env` n'est pas versionné : la clé n'existe que sur votre machine.
> **Sans elle, aucune sauvegarde ne peut être relue** — c'est tout l'intérêt du
> chiffrement, et tout son danger.

### 2. Démarrer la stack

```bash
./launch.sh
```

Le conteneur **`snell-backup`** démarre avec les autres et programme le cron de 2h.
Pour ne (re)lancer que lui : `docker compose up -d backup`.

> ⚠️ Après avoir modifié `.env`, utilisez **`docker compose up -d backup`** et non
> `docker compose restart backup` : un `restart` ne relit pas le `.env`.

### 3. Vérifier que tout est en place

```bash
./backup.sh --list     # la clé est-elle bien vue ? y a-t-il des sauvegardes ?
./backup.sh            # une première sauvegarde tout de suite
./test-backup.sh       # on vérifie qu'elle est bien restaurable
```

C'est fini. À partir de là, une sauvegarde est créée chaque nuit à 2h.

---

## Comment ça marche

### La sauvegarde

```
  MongoDB
     │  mongodump --archive --gzip      ← dump binaire compressé, en flux
     ▼
   [flux]
     │  openssl enc -aes-256-cbc        ← chiffrement + sel + PBKDF2 200 000 tours
     ▼
  backup/snell-2026-09-04_020000.archive.gz.enc
  backup/snell-2026-09-04_020000.archive.gz.enc.sha256   ← empreinte d'intégrité
```

Trois détails qui comptent :

1. **Tout se fait en flux** (`|`). La base n'est jamais écrite en clair sur le
   disque, même temporairement.
2. **On compresse avant de chiffrer.** L'inverse ne servirait à rien : des données
   chiffrées ressemblent à du bruit aléatoire et ne se compressent pas.
3. **Écriture atomique.** L'archive est d'abord écrite en `.part`, puis renommée
   seulement si tout s'est bien passé. Une sauvegarde interrompue ne laisse donc
   jamais de fichier incomplet qui se ferait passer pour la « dernière ».

### Le chiffrement

```
openssl enc -aes-256-cbc -md sha512 -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_KEY
```

| Option | Pourquoi |
|---|---|
| `-aes-256-cbc` | AES 256 bits. |
| `-pbkdf2 -iter 200000` | La clé AES est *dérivée* de `BACKUP_ENCRYPTION_KEY` par 200 000 tours de hachage : une attaque par dictionnaire devient très coûteuse. |
| `-salt` | Un sel aléatoire par archive : deux sauvegardes identiques donnent deux fichiers chiffrés différents. |
| `-pass env:` | La clé est lue dans une variable d'environnement, jamais passée en argument : elle n'apparaît donc ni dans `ps aux` ni dans l'historique du shell. |

La clé vit dans **`services/.env`** (déjà ignoré par git) et est transmise au
conteneur par `docker-compose.yml`.

> 🔎 **À savoir :** une variable d'environnement de conteneur est visible par
> quiconque peut lancer `docker inspect snell-backup` sur la machine. C'est le
> même niveau de confidentialité que `STRIPE_SECRET_KEY`, déjà géré ainsi dans ce
> projet. Ce qui compte ici, c'est que la clé ne parte **ni sur GitHub, ni avec
> les archives** — et ça, c'est garanti.

### Hôte ou conteneur ?

Les trois scripts existent à deux endroits, mais c'est **le même fichier** :

- sur l'hôte : `services/backup.sh`, `services/test-backup.sh`, …
- dans le conteneur : `/app/backup/backup.sh`, … (monté depuis l'hôte par
  `docker-compose.yml`, donc **une modification est prise en compte sans rebuild**)

Lancé sur l'hôte, un script détecte qu'il n'est pas dans le conteneur (absence du
fichier marqueur `/.snell-backup`) et **se relance tout seul dedans** via
`docker exec`. C'est le conteneur qui possède `mongodump`, `mongorestore` et
`openssl`, et qui voit la base sur le réseau Docker.

Résultat : vous tapez `./backup.sh`, et tout le reste est transparent.

### La planification

Le conteneur `snell-backup` ne sert rien sur le réseau : il héberge simplement un
cron. La ligne, dans `backup/crontab` :

```
0 2 * * * root ... bash /app/backup/backup.sh >> /var/log/snell-backup.log
│ │ │ │ │
│ │ │ │ └── tous les jours de la semaine
│ │ │ └──── tous les mois
│ │ └────── tous les jours du mois
│ └──────── à 2 h
└────────── à la minute 0
```

Le conteneur fixe son fuseau horaire via `TZ` (`Europe/Paris` par défaut) :
sans ça, cron raisonnerait en UTC et « 2h du matin » dériverait avec les saisons.

> 💡 **Pourquoi un fichier `/etc/snell-backup.env` ?** cron démarre ses tâches dans
> un environnement quasiment vide : les variables passées par docker-compose (dont
> la clé) seraient perdues. L'`entrypoint.sh` les recopie donc dans ce fichier
> (lisible par root uniquement), que `lib.sh` recharge au démarrage de chaque script.

### La rétention sur 14 jours

À la fin de **chaque** sauvegarde, les archives dont la date — lue dans le **nom
du fichier**, plus fiable que la date de modification — remonte à plus de 14 jours
sont supprimées, avec leur empreinte `.sha256`.

Vous avez donc en permanence les **14 derniers jours** de sauvegardes, et le
dossier ne grossit jamais indéfiniment.

---

## Où sont les fichiers

```
ps8-snell/
├── backup/                      ← les archives chiffrées atterrissent ici
│   ├── snell-2026-09-04_020000.archive.gz.enc
│   └── snell-2026-09-04_020000.archive.gz.enc.sha256
└── services/
    ├── .env                     ← contient BACKUP_ENCRYPTION_KEY (jamais versionné)
    ├── backup.sh                ← sauvegarde (+ --list, --genkey)
    ├── test-backup.sh           ← test d'une sauvegarde
    ├── restore-backup.sh        ← restauration
    ├── docker-compose.yml       ← contient le service `backup`
    └── backup/
        ├── Dockerfile           ← image : mongo + cron + openssl
        ├── entrypoint.sh        ← démarrage du conteneur, lancement de cron
        ├── crontab              ← la planification (2h du matin)
        ├── lib.sh               ← configuration + fonctions communes aux 3 scripts
        └── README.md            ← ce document
```

`backup/` est dans le `.gitignore`, et la clé vit dans `services/.env`, lui aussi
ignoré : ni les données ni la clé ne partent sur GitHub.

---

## Scénarios courants

### « Je veux vérifier que mes sauvegardes valent quelque chose »

Une sauvegarde jamais testée n'est pas une sauvegarde. Deux niveaux de test :

```bash
./test-backup.sh          # rapide (quelques secondes)
```
1. l'empreinte SHA-256 correspond → le fichier n'est pas corrompu
2. le déchiffrement AES aboutit → la clé est la bonne
3. `mongorestore --dryRun` relit toute l'archive → le dump est valide
   (`--dryRun` analyse le flux mais **n'écrit rien** dans la base)

```bash
./test-backup.sh --full   # approfondi (plus long)
```
En plus : l'archive est **réellement restaurée** dans des bases temporaires
`snellverify__<base>`, les documents sont comptés et affichés, puis ces bases
temporaires sont supprimées. Les bases de production ne sont **jamais** touchées.
C'est une vraie répétition générale.

### « J'ai cassé la base, je veux revenir en arrière »

```bash
./backup.sh --list                                              # 1. choisir
./test-backup.sh snell-2026-09-02_020000.archive.gz.enc         # 2. tester
./restore-backup.sh snell-2026-09-02_020000.archive.gz.enc      # 3. restaurer
```

La restauration :
1. vérifie l'empreinte du fichier et **refuse** de continuer s'il est corrompu ;
2. affiche les bases actuelles et demande de taper `restore` pour confirmer ;
3. restaure avec `--drop` (chaque collection de l'archive est vidée avant d'être
   réécrite, sinon d'anciens documents survivraient) ;
4. affiche le nombre de documents par collection après restauration.

Pour restaurer sans confirmation (script, CI) : `--yes`.

> 💡 **Vous voulez garder une copie de l'état actuel avant d'écraser ?**
> Prenez-la explicitement, juste avant :
>
> ```bash
> ./backup.sh --label avant-restore
> ./restore-backup.sh snell-2026-09-02_020000.archive.gz.enc
> ```
>
> Le script ne le fait **pas** tout seul, et c'est volontaire : une sauvegarde
> automatique prise à cet instant deviendrait la plus récente. Un
> `./restore-backup.sh` lancé juste après — donc sur `latest` — restaurerait
> alors l'état que vous cherchiez précisément à écraser.

### « Est-ce que la sauvegarde de cette nuit s'est bien passée ? »

```bash
docker logs snell-backup     # ou : ./backup.sh --list
```

### « Je change de machine / je remonte le projet ailleurs »

Copiez **deux choses** : le dossier `backup/` **et** la ligne
`BACKUP_ENCRYPTION_KEY` de `services/.env`. L'un sans l'autre ne sert à rien.

### « J'ai perdu la clé »

Les sauvegardes existantes sont définitivement illisibles — c'est le principe
d'un chiffrement AES-256. Générez une nouvelle clé (`--genkey`) et refaites une
sauvegarde : les nouvelles archives utiliseront la nouvelle clé.

### « Je veux changer de clé »

Gardez l'ancienne de côté tant que des archives chiffrées avec elle existent
(14 jours). Pour relire une vieille archive, remettez temporairement l'ancienne
valeur dans `.env`, ou déchiffrez à la main (voir plus bas).

---

## Configuration

Toutes ces variables se règlent dans **`services/.env`** :

| Variable | Défaut | Rôle |
|---|---|---|
| `BACKUP_ENCRYPTION_KEY` | *(aucun)* | **Obligatoire.** Clé de chiffrement, générée par `./backup.sh --genkey`. |
| `BACKUP_RETENTION_DAYS` | `14` | Nombre de jours glissants conservés. |
| `TZ` | `Europe/Paris` | Fuseau du conteneur, donc heure réelle du cron. |

Après toute modification du `.env` : `docker compose up -d backup`.

Pour changer **l'heure** de la sauvegarde, modifiez la ligne de
`services/backup/crontab` puis reconstruisez :

```bash
docker compose up -d --build backup
```

Exemples : `0 2 * * *` → 2h du matin (défaut) · `30 3 * * *` → 3h30 ·
`0 */6 * * *` → toutes les 6 heures.

> Le `crontab` est copié dans l'image, donc il faut `--build`. Les trois scripts,
> eux, sont montés depuis l'hôte : les modifier ne demande aucun rebuild.

---

## Dépannage

| Symptôme | Cause probable et solution |
|---|---|
| `Le conteneur 'snell-backup' ne tourne pas` | La stack n'est pas démarrée → `./launch.sh`, ou `docker compose up -d backup`. |
| `BACKUP_ENCRYPTION_KEY est vide ou absente` | Ajoutez la ligne dans `services/.env` (`./backup.sh --genkey`), puis `docker compose up -d backup`. Attention : `restart` ne relit pas le `.env`. |
| La clé est dans `.env` mais l'erreur persiste | Le conteneur tourne encore avec l'ancien environnement → `docker compose up -d backup` (recrée le conteneur). |
| `MongoDB injoignable` | Le conteneur `mongodb` est arrêté ou pas encore prêt → `docker compose ps`. |
| `Déchiffrement : ÉCHEC` | La clé actuelle n'est pas celle qui a servi à créer l'archive. Remettez l'ancienne valeur dans `.env`. |
| `Empreinte SHA-256 INVALIDE` | Le fichier a été corrompu ou modifié. Utilisez une sauvegarde plus ancienne (`--list` montre l'intégrité de chacune). |
| Aucune sauvegarde n'apparaît le matin | `docker logs snell-backup` pour voir l'erreur. Vérifiez aussi l'heure du conteneur : `docker exec snell-backup date`. |
| Le dossier `backup/` grossit trop | Baissez `BACKUP_RETENTION_DAYS` dans `services/.env`, puis `docker compose up -d backup`. |
| `SELinux is preventing bash from … access on /app/backup/backup.sh` | Voir [SELinux](#selinux-fedora-rhel-centos) ci-dessous. |

### SELinux (Fedora, RHEL, CentOS)

Sur ces distributions, les fichiers du dépôt portent l'étiquette `user_home_t`,
alors qu'un conteneur tourne en `container_t` : SELinux refuse alors tout accès
aux fichiers montés depuis l'hôte.

```
SELinux is preventing bash from ioctl access on the file /app/backup/backup.sh
```

C'est réglé par le suffixe **`:z`** sur les montages du service `backup` dans
`docker-compose.yml` (déjà en place) : Docker réétiquette les fichiers en
`container_file_t` au moment du montage.

```yaml
- ../backup:/backup:z
- ./backup.sh:/app/backup/backup.sh:ro,z
```

- `:z` (minuscule) = étiquette partagée, plusieurs conteneurs peuvent lire.
  `:Z` (majuscule) réserverait le fichier à un seul conteneur — à éviter ici,
  puisque ce sont des fichiers de votre dépôt.
- Ne suivez **pas** la suggestion `restorecon` de l'alerte SELinux : elle
  remettrait justement l'étiquette qui bloque. Si un jour vous lancez un
  `restorecon -R` sur le projet, relancez simplement
  `docker compose up -d backup` pour réappliquer les étiquettes.
- Les autres services du projet qui montent des fichiers de l'hôte
  (`mail/config.yaml`, `secrets/https`) rencontreront le même problème sur ces
  distributions : le remède est identique.

---

### Déchiffrer une archive à la main (sans les scripts)

Utile pour inspecter une archive depuis n'importe quelle machine ayant openssl :

```bash
export BACKUP_ENCRYPTION_KEY="…la clé…"

openssl enc -d -aes-256-cbc -md sha512 -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  < backup/snell-2026-09-04_020000.archive.gz.enc \
  > /tmp/dump.archive.gz

# puis, avec les outils MongoDB :
mongorestore --uri="mongodb://localhost:27017" --archive=/tmp/dump.archive.gz --gzip
```
