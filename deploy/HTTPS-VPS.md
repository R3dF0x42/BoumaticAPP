# HTTPS pour techplanner.fr avec le Nginx existant

## Etat et installation identifiee

Preparation locale uniquement : aucun changement du VPS, aucun certificat
demande et aucune application Android generee a ce stade.

- Projet : `/home/ubuntu/BoumaticAPP`, nom Compose `boumaticapp`, Compose 5.0.2.
- Nginx sur le port 80, site `/etc/nginx/sites-enabled/boumatic`.
- Nginx sert directement `/home/ubuntu/BoumaticAPP/Frontend/dist` et transmet
  `/api/` au backend local. Le conteneur frontend existe mais ce n'est pas lui
  qui sert les pages publiques : reconstruire son image ne suffit pas.
- Backend actuellement public sur 4000 ; frontend Docker sur `127.0.0.1:8080`.
- Certbot deja present dans `/usr/bin/certbot` : ne pas installer une autre
  version Snap en parallele. Verifier la disponibilite du plugin Nginx.
- Modifications locales sur le VPS : `docker-compose.yml` et
  `Frontend/package-lock.json`. Ne pas les ecraser lors de la mise a jour.

**Cette procedure remplace celle avec Caddy.** On conserve Nginx, son dossier
statique, React, Express et PostgreSQL. Ne pas installer Caddy ni arreter Nginx.

`docker-compose.https.yml` est maintenant une **surcharge**, jamais un fichier
autonome. Toujours charger d'abord `docker-compose.yml`, puis cette surcharge.
Elle ne change que les ports, l'URL de l'API et deux reglages de session : la base,
les volumes, les identifiants et Google Calendar restent ceux du fichier actuel.
`!override` remplace les ports au lieu de les cumuler (Compose >= 2.24.4,
compatible avec la version 5.0.2 du VPS).

## 1. Sauvegarder avant de recuperer le code

Les commandes Linux de ce document s'executent dans la session SSH du VPS,
une par une. Arreter la procedure si une commande echoue.

```sh
cd /home/ubuntu/BoumaticAPP
umask 077
backup_dir="$HOME/boumatic-avant-https-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir/Frontend"
cp -p docker-compose.yml "$backup_dir/docker-compose.yml"
cp -p Frontend/package-lock.json "$backup_dir/Frontend/package-lock.json"
if [ -f .env ]; then cp -p .env "$backup_dir/.env"; fi
git diff --binary > "$backup_dir/modifications-locales.patch"
git rev-parse HEAD > "$backup_dir/revision.txt"
sudo tar -czf "$backup_dir/nginx.tar.gz" -C /etc nginx
tar -czf "$backup_dir/frontend-dist.tar.gz" Frontend/dist
```

Conserver le chemin de sauvegarde. Ces copies sont privees : ne pas publier le
patch, Compose, `.env` ou les fichiers Nginx, qui peuvent contenir des secrets.
Conserver aussi les images actuelles pour le retour en arriere, sans `prune`.

Confirmer les montages des donnees avant leur sauvegarde :

```sh
docker inspect boumaticapp-db-1 boumaticapp-backend-1 --format '{{.Name}}{{range .Mounts}}{{println}}{{.Source}} -> {{.Destination}}{{end}}'
```

Avec les montages standards du depot (`data/postgres`, `backend/uploads`), dans
un creneau sans ecritures par les utilisateurs :

```sh
docker compose exec -T db pg_dump -U boumatic -d boumatic -Fc > "$backup_dir/boumatic.dump"
docker compose exec -T db pg_restore --list < "$backup_dir/boumatic.dump" > /dev/null
tar -czf "$backup_dir/uploads.tar.gz" backend/uploads
tar -tzf "$backup_dir/uploads.tar.gz" > /dev/null
```

La liste de l'archive verifie sa lisibilite, pas une restauration complete.
Prevoir une restauration d'essai dans une base isolee et une copie privee hors VPS.

## 2. Recuperer les changements sans perdre ceux du VPS

Les changements HTTPS/Nginx prepares sur le poste de travail doivent d'abord etre
commites et pousses dans le depot partage avec l'accord du proprietaire. Ne pas
deployer seulement l'ancien commit Caddy. Un pull ne recupere pas les fichiers
qui n'existent que localement.

Ne pas utiliser `git reset --hard`, `git clean` ou `git checkout --` pour effacer
les modifications du VPS. Apres sauvegarde, si le statut contient uniquement
les deux modifications identifiees :

```sh
git stash push -m "VPS avant HTTPS : conserver adaptations locales" -- docker-compose.yml Frontend/package-lock.json
git stash list -1
git pull --ff-only
git stash apply 'stash@{0}'
git status --short
```

Executer les commandes une par une. Si `stash` ou `pull` echoue, ne pas continuer.
Si `stash apply` produit un conflit, le resoudre avec les copies privees avant
de construire ou de demarrer quoi que ce soit. Ne pas supprimer le stash avant
validation et ne pas regenerer le lockfile au hasard pour contourner un conflit.

Verifier dans `.env` que `ADMIN_PASSWORD` est defini. **Ne pas ecraser `.env` avec
`.env.https.example`** : cet exemple contient une valeur vide. Le Compose de base
doit transmettre `ADMIN_PASSWORD` au backend, comme celui du depot. Conserver les
identifiants PostgreSQL et les variables Google Calendar actuels : aucun nouveau
`POSTGRES_PASSWORD` ou `PUBLIC_DOMAIN` n'est requis par la surcharge Nginx.

```sh
chmod 600 .env
docker compose -f docker-compose.yml -f docker-compose.https.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.https.yml build backend frontend
```

Construire les images avant la bascule. Ne pas partager la sortie de `config`
sans `--quiet`, qui peut contenir les secrets.

## 3. Adapter le site Nginx et obtenir le certificat

Verifier le DNS de `techplanner.fr` vers `135.125.199.51`, sans AAAA errone. Garder
les ports TCP 80 et 443 accessibles dans les pare-feu du VPS et OVH. Ne pas fermer
SSH ni desactiver le pare-feu. Seul `techplanner.fr`, sans `www`, est prevu ici.

Apres sauvegarde, adapter le site `boumatic` en s'appuyant sur
`deploy/nginx-techplanner.conf`. Identifier la cible de son lien symbolique avec
`readlink -f /etc/nginx/sites-enabled/boumatic` avant d'editer le fichier actif.
Ne pas ecraser `/etc/nginx/nginx.conf`, les autres sites ou leurs reglages.
Ne pas creer deux blocs actifs pour le meme nom ou pour l'ancienne IP.

Le modele est un **site HTTP initial**, pas un fichier HTTPS deja certifie :

- `server_name techplanner.fr`, meme `root` et meme repli SPA `try_files` ;
- API et photos vers `127.0.0.1:4000`, sans supprimer `/api` ou `/uploads` ;
- Host et X-Forwarded-Proto transmis au backend pour les sessions ;
- X-Forwarded-For remplace par l'adresse distante, sans accepter celui du client ;
- limite de requete de 10 Mo pour les photos limitees a 8 Mo cote backend ;
- ancien acces HTTP par IP redirige vers le domaine HTTPS.

Ne pas ajouter de slash apres `proxy_pass http://127.0.0.1:4000`, ni servir les
photos directement avec `alias` : leur controle d'acces doit passer par Express.
Lors de l'adaptation d'un bloc existant, verifier qu'aucun `proxy_set_header`
local ne neutralise l'heritage des quatre en-tetes definis au niveau `server`.

```sh
sudo nginx -t && sudo systemctl reload nginx
sudo certbot plugins
```

Ne pas continuer si le test Nginx echoue ou si le plugin `nginx` manque. Verifier
que le domaine atteint le site en HTTP, sans se connecter avec un compte.
Prevoir ensuite un creneau de maintenance : l'ancien acces par IP sera redirige
et l'ancien build peut encore appeler l'API en HTTP jusqu'a la fin de la bascule.

```sh
sudo certbot --nginx -d techplanner.fr --redirect
sudo nginx -t
```

Lire les conditions Let's Encrypt et renseigner les informations directement
sur le VPS. Cette commande demande un vrai certificat et modifie le site Nginx.
Verifier `https://techplanner.fr` sans ignorer les alertes TLS. En cas d'echec,
ne pas activer les cookies Secure dans Docker ; utiliser le plan de retour.

**Ne pas recopier ensuite le modele HTTP sur le fichier actif** : cela effacerait
les directives HTTPS ajoutees par Certbot. Sauvegarder le fichier final et
`/etc/letsencrypt` de facon privee.

## 4. Basculer les deux conteneurs et les fichiers statiques

Depuis `/home/ubuntu/BoumaticAPP`, avec le meme projet Compose `boumaticapp` :

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --no-deps backend frontend
docker compose -f docker-compose.yml -f docker-compose.https.yml ps
```

`--no-deps` evite de recreer PostgreSQL, qui doit deja fonctionner. Nginx reste
actif. Une breve interruption des requetes est possible pendant la bascule.
Verifier que 4000 et 8080 sont publies uniquement sur `127.0.0.1`, pas sur
`0.0.0.0` ou `[::]`.

**Etape indispensable avec le Nginx actuel : publier le nouveau build dans son
dossier statique.** Le build Docker fournit les fichiers sans installer Node ou
modifier les dependances sur le VPS. Apres sauvegarde de `Frontend/dist` et
verification du nom `boumaticapp-frontend-1` dans le resultat precedent :

```sh
docker cp boumaticapp-frontend-1:/app/dist/. /home/ubuntu/BoumaticAPP/Frontend/dist/
```

Verifier le succes de la copie et la lisibilite des fichiers par Nginx. Elle
ecrase les fichiers de meme nom mais ne supprime pas les anciens fichiers
hashes, afin de ne pas casser les onglets deja ouverts. Ne pas effacer `dist`
avant la copie. Sans cette etape, Nginx continuerait a servir l'ancienne API HTTP.

## 5. Verification mobile et renouvellement

Ouvrir `https://techplanner.fr` en Wi-Fi puis en 4G/5G. Verifier certificat,
connexion administrateur/technicien, planning, photos, envoi d'une photo de test
autorisee, rechargement et deconnexion. Les requetes ne doivent plus utiliser
HTTP ou le port 4000 public. Sans session, `/api/auth/session` et les photos
protegees doivent renvoyer 401, pas la page React.

Il faudra se reconnecter sur le nouveau domaine et recreer les anciens
raccourcis. La preparation Android vient apres ces controles ; HTTPS ne fournit
pas de mode hors connexion pour les donnees metier.

```sh
sudo certbot renew --dry-run
systemctl list-timers --all | grep -Ei 'certbot|letsencrypt'
```

Verifier le mecanisme de renouvellement installe (timer ou cron), le resultat du
test et le rechargement Nginx. Surveiller la validite du certificat.

## 6. Prochains deploiements et retour en arriere

Toujours utiliser les deux fichiers, puis republier le build statique :

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build --no-deps backend frontend
docker cp boumaticapp-frontend-1:/app/dist/. /home/ubuntu/BoumaticAPP/Frontend/dist/
```

Ne pas utiliser le fichier HTTPS seul. Utiliser seulement le fichier de base
remettrait notamment l'API sur un port public et le build frontend en HTTP.
En cas d'echec, reprendre les images, fichiers Compose, fichiers statiques et
configuration Nginx sauvegardes, sans reinitialiser la base. Tester Nginx avant
de le recharger. Un retour HTTP est temporaire et moins sur. Ne pas utiliser
`down -v`, `prune`, ni supprimer `data/`.

## References et maintenance du VPS

- [Fusion Compose et remplacement des ports](https://docs.docker.com/reference/compose-file/merge/)
- [Configuration du proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Certbot/Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap)
- [Fin de maintenance Ubuntu 25.04](https://lists.ubuntu.com/archives/ubuntu-announce/2026-January/000320.html)

Ubuntu 25.04 n'est plus maintenu. Prevoir une migration dans une intervention
separee, avec sauvegarde et retour en arriere. Ne pas improviser un changement
des depots APT, une nouvelle installation Certbot ou une mise a niveau du systeme
pour contourner un probleme pendant cette bascule.
