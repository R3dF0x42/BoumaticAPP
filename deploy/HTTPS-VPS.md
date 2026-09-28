# HTTPS sur le VPS OVH avec techplanner.fr

## Etat et perimetre

Configuration preparee, pas encore activee sur le VPS. Aucun certificat public
n'a ete demande pendant la preparation locale. L'application Android reste une
etape suivante, apres verification de HTTPS sur un telephone.

Adresse prevue : `https://techplanner.fr` (domaine achete chez OVH).

React, Express, PostgreSQL, les ecrans et les donnees sont conserves. Un service
Caddy termine HTTPS devant les trois services Docker existants. Il renouvelle
automatiquement le certificat public Let's Encrypt du domaine.

`docker-compose.https.yml` est un fichier **complet**, a utiliser seul, depuis
le meme dossier et avec le meme nom de projet Compose que l'installation actuelle.
Ne pas le fusionner avec `docker-compose.yml` : cela risquerait de conserver les
anciens ports HTTP publics. Le fichier historique n'est pas modifie.

Apres activation :

- le site, `/api` et `/uploads` utilisent la meme adresse `https://DOMAINE` ;
- seul Caddy publie les ports TCP 80 et 443 ; PostgreSQL et le port 4000 de l'API
  restent internes a Docker ;
- les cookies de session sont HttpOnly et Secure ; une reconnexion sera necessaire ;
- les dossiers `data/postgres` et `backend/uploads` restent les memes ;
- les certificats et cles restent dans `data/caddy` : ne pas supprimer ce dossier,
  ne pas le publier dans Git et inclure ce dossier dans les sauvegardes privees.

## 1. Verifications avant toute modification

Depuis PowerShell, se connecter en SSH comme d'habitude. Les commandes suivantes
s'executent ensuite **sur le VPS Linux**, et non dans le PowerShell local :

```sh
cat /etc/os-release
docker compose version
pwd
docker compose ls
```

Se placer dans le dossier de l'application et verifier :

```sh
docker compose ps
```

Confirmer l'IPv4 publique dans l'espace OVH. L'ancienne configuration du depot
contient `135.125.199.51` ; cette adresse doit etre confirmee avant utilisation.

Dans l'espace client OVH, ouvrir la **Zone DNS** de `techplanner.fr` et ajouter
ou modifier l'enregistrement **A** du domaine principal : laisser le champ
**Sous-domaine vide**, conserver le TTL par defaut et renseigner l'IPv4 du VPS
comme **Cible**. S'il existe deja une ancienne adresse pour ce meme nom,
la remplacer plutot qu'ajouter une deuxieme cible contradictoire.
Ne pas modifier les enregistrements des mails (MX/TXT) ou ceux d'autres services.
Si ce nom possede aussi un enregistrement AAAA, verifier qu'il pointe vers une
IPv6 de ce VPS ou le corriger : une IPv6 erronee peut bloquer la validation HTTPS.

Attendre que le nom resolve bien vers le VPS. Verification depuis le PowerShell
local :

```powershell
Resolve-DnsName techplanner.fr -Type A
Resolve-DnsName techplanner.fr -Type AAAA
```

L'absence d'AAAA est normale si seule l'IPv4 est configuree. Si le domaine vient
d'etre achete et qu'aucun enregistrement n'est encore visible, verifier que la
commande OVH est terminee et attendre la disponibilite de sa zone DNS. Ne pas
lancer l'emission du certificat tant que le nom ne pointe pas vers le VPS.

Seul `techplanner.fr` est configure ici, pas `www.techplanner.fr`.

Verifier que l'installation actuelle utilise bien Docker Compose, les services
`db`, `backend`, `frontend` et les deux dossiers de donnees ci-dessus. Si elle
utilise un autre fichier, un autre nom de projet, un proxy, des volumes nommes ou
des variables Google Calendar supplementaires, adapter cette procedure avant
de continuer. Ne pas demarrer une seconde base sur le meme dossier.

Autoriser les connexions entrantes TCP 80 et 443 dans les pare-feu du VPS et OVH,
ainsi que les connexions sortantes HTTPS necessaires a Let's Encrypt.
**Ne pas desactiver le pare-feu et ne pas fermer le port SSH actuel.** Les ports
80 et 443 doivent rester joignables pour les renouvellements futurs.

## 2. Sauvegarde et configuration privee

Faire une sauvegarde verifiee de PostgreSQL et des photos avant de basculer,
pendant un creneau sans modifications par les techniciens. Par exemple, depuis
le dossier actuel de l'application, avec la configuration HTTP encore active :

```sh
umask 077
backup_dir="backups/avant-https-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
docker compose exec -T db pg_dump -U boumatic -d boumatic -Fc > "$backup_dir/boumatic.dump"
docker compose exec -T db pg_restore --list < "$backup_dir/boumatic.dump" > /dev/null
tar -czf "$backup_dir/uploads.tar.gz" backend/uploads
tar -tzf "$backup_dir/uploads.tar.gz" > /dev/null
```

Arreter la procedure si une commande echoue. La liste `pg_restore` verifie la
lisibilite de l'archive ; une restauration d'essai dans une base isolee reste
necessaire pour valider completement la sauvegarde. Conserver aussi une copie
privee hors du VPS, le fichier Compose actuel, le `.env` et les images actuelles
pour pouvoir revenir en arriere. Ne pas effacer les donnees pour tester un retour.

Reporter les trois variables de `.env.https.example` dans le `.env` a la racine
du projet, **sans ecraser les variables deja presentes** :

- `PUBLIC_DOMAIN` : `techplanner.fr`, sans `https://`, port, chemin ou espace.
  Ne pas utiliser l'IP dans cette configuration.
- `ADMIN_PASSWORD` : conserver le mot de passe administrateur configure.
- `POSTGRES_PASSWORD` : reprendre exactement le mot de passe actuel de la base.
  Changer cette variable ne change pas le mot de passe d'une base deja initialisee.
  Une rotation de ce mot de passe doit etre faite separement, pas pendant la bascule.

Utiliser des valeurs entre apostrophes dans `.env` si les mots de passe contiennent
des caracteres comme `$` ou `#`. Le backend utilise les variables `PG*` pour eviter
les erreurs d'encodage des mots de passe dans une URL PostgreSQL.

```sh
chmod 600 .env
docker compose -f docker-compose.https.yml config --quiet
```

Ne pas partager `.env`, les cles privees, les sauvegardes ou la sortie de
`docker compose config` sans `--quiet`, qui peut contenir les secrets.
Les `.dockerignore` empechent aussi de copier `.env`, les dependances locales
et les photos dans les images lors du build.

## 3. Preparer puis activer pendant un creneau prevu

Transferer les changements du projet sur le VPS par le mecanisme habituel,
sans remplacer `.env`, `data/` ou `backend/uploads/`. Conserver le meme nom de
projet Compose ; si l'installation utilise `-p NOM`, le reprendre dans toutes
les commandes ci-dessous. Conserver egalement les variables et montages Google
Calendar personnalises de l'installation actuelle, le cas echeant.

Avant la bascule, construire les images et valider Caddy :

```sh
docker compose -f docker-compose.https.yml pull proxy
docker compose -f docker-compose.https.yml build backend frontend
docker compose -f docker-compose.https.yml run --rm --no-deps proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

La validation ne demarre pas le proxy et ne demande pas de certificat.
Ne pas poursuivre si elle echoue. L'emission reelle ne peut etre verifiee que
sur le VPS, une fois le domaine correctement configure et les ports accessibles.

Pendant le creneau de maintenance, arreter seulement l'ancien frontend pour
liberer le port 80, puis activer la configuration complete :

```sh
docker compose stop frontend
docker compose -f docker-compose.https.yml up -d
docker compose -f docker-compose.https.yml ps
docker compose -f docker-compose.https.yml logs --tail=100 proxy backend
```

Caddy demande un certificat public Let's Encrypt pour le domaine indique. Son
demarrage implique l'utilisation de ce service et l'acceptation des conditions
de l'autorite de certification. Une breve indisponibilite est possible pendant
la recreation des conteneurs et l'emission initiale.

Ne pas ouvrir les ports 4000 ou 5432 pour contourner un probleme. Si le port 4000
est encore publie par un ancien conteneur ou un autre processus, corriger ce
point avant de considerer HTTPS comme termine.

## 4. Verification sur telephone

Ouvrir `https://techplanner.fr`, sans `:4000`, dans le navigateur du telephone,
d'abord en Wi-Fi puis en 4G/5G :

- aucune alerte de certificat ; ne jamais accepter une exception de securite ;
- `http://DOMAINE` redirige vers `https://DOMAINE` ;
- connexion administrateur et technicien, actualisation de page, deconnexion ;
- affichage du planning, consultation des interventions et des photos ;
- envoi d'une photo de test sur une intervention de test autorisee ;
- absence de requetes HTTP ou de requetes vers le port 4000 dans le navigateur.

Sans session, `/api/auth/session` et les photos protegees doivent repondre 401,
pas renvoyer la page React. Le service worker n'ajoute pas de mode hors connexion
pour les donnees metier.

L'ancien acces direct par IP n'est pas une adresse prise en charge par cette
configuration : communiquer la nouvelle adresse aux techniciens. Les raccourcis
installes depuis l'ancienne origine doivent etre recrees depuis HTTPS. Verifier
la connexion et les photos avant de distribuer une version Android aux techniciens.

## 5. Maintenance et retour en arriere

Pour les prochains deploiements, toujours utiliser :

```sh
docker compose -f docker-compose.https.yml up -d --build
```

Ne pas revenir par inadvertance a `docker compose up -d` sans `-f` : cela
reactiverait le fichier HTTP historique. Garder Caddy en fonctionnement et
surveiller ses erreurs de renouvellement. Une surveillance externe de la validite
du certificat est recommandee ; ne pas compter sur un renouvellement manuel.

En cas d'echec de la bascule, arreter Caddy avant de relancer les services avec
la configuration et les images sauvegardees : il occupe les ports 80 et 443.
Le retour HTTP est une solution temporaire moins sure ; il ne doit pas devenir
le fonctionnement normal ni servir a distribuer l'application Android.
Ne pas utiliser `down -v`, `prune` ou supprimer `data/` pour resoudre un probleme.

## References

- [TLS et autorite ACME Caddy](https://caddyserver.com/docs/caddyfile/directives/tls)
- [HTTPS automatique Caddy](https://caddyserver.com/docs/automatic-https)
- [Enregistrement A dans la zone DNS OVH](https://docs.ovhcloud.com/fr/guides/web-cloud/domains/dns-zone-a-record-creation)

L'autorite ACME est explicite dans le Caddyfile. Il ne faut pas remplacer cette
configuration par `tls internal` : les telephones ne reconnaitraient pas
automatiquement les certificats de l'autorite locale de Caddy.
