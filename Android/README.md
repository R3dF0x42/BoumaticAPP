# TechPlanner pour Android

## Choix et etat

Ce projet ajoute une application Android legere qui ouvre `https://techplanner.fr`
dans une **Trusted Web Activity (TWA)**. React, Express, PostgreSQL, les ecrans et
les droits admin/technicien restent inchanges. Les cookies securises et les photos
continuent d'utiliser le meme domaine, sans nouvelle API ni assouplissement CORS.

C'est une alternative a l'emballage Capacitor initialement envisage, mieux adaptee
ici au site deja heberge : pas de copie du frontend a maintenir dans l'APK ni de
connexion entre deux origines. Les mises a jour du site sont retrouvees dans l'app.
Le navigateur compatible du telephone assure le rendu et la connexion.
[Fonctionnement officiel des TWA](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).

Sur ce PC, Android Studio, le JDK 21 et le SDK Android sont installes. La
compilation et le controle lint des variantes debug et release ont reussi le
28 septembre 2026. Un APK **de test** est disponible dans
`Android/app/build/outputs/apk/debug/app-debug.apk`. L'APK a distribuer a ete
signe et verifie dans `Android/app/release/app-release.apk`. La compilation
release produit aussi `Android/app/build/outputs/apk/release/app-release-unsigned.apk` :
ne pas distribuer ce fichier non signe. Aucun APK n'a encore ete teste sur
telephone. Aucun changement du VPS n'est effectue par ces fichiers.

- Nom : **TechPlanner** ; identifiant release : `fr.techplanner.app`.
- La variante debug s'appelle **TechPlanner Test**, identifiant distinct
  `fr.techplanner.app.debug`. Ne pas distribuer cette variante aux techniciens.
- Internet reste necessaire pour le planning et les photos. Ce n'est pas un
  ajout de synchronisation hors ligne, de notifications ou une publication Play Store.
- Un navigateur compatible TWA a jour est necessaire, par exemple Chrome Android.
  Sans verification du domaine ou sans support TWA, une barre de navigateur peut apparaitre.
- La session peut etre partagee avec ce navigateur. Se deconnecter dans l'app avant
  de preter le telephone ; desinstaller l'APK ne supprime pas les cookies du navigateur.

## 1. Installer les outils sur le PC Windows, pas sur le VPS

Installer [Android Studio](https://developer.android.com/studio), puis terminer son
assistant et lire/accepter les licences proposees. Ouvrir le dossier `Android`
de ce depot comme projet. Ne pas creer un nouveau projet ni migrer l'application web.

Dans SDK Manager, installer Android SDK Platform **36**, Build-Tools **35.0.0**
et Platform-Tools. Dans les reglages Gradle du projet, utiliser un **JDK 17 ou 21**
(celui fourni avec Android Studio s'il correspond). Le projet fixe Gradle **8.13**,
Android Gradle Plugin **8.13.2** et Android Browser Helper **2.7.3**.
[Compatibilite AGP](https://developer.android.com/build/releases/agp-8-13-0-release-notes).

Laisser la synchronisation Gradle finir. Les dependances proviennent de Google
Maven, Maven Central et Gradle. Le wrapper et l'archive Gradle ont des empreintes
SHA-256 verifiees/fixees ; ne pas desactiver leur verification en cas d'erreur.

Pour compiler la variante de test depuis PowerShell, a la racine du depot :

```powershell
$env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\jbr-21.0.11'
cd Android
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

Adapter `JAVA_HOME` si le JDK 21 est installe ailleurs. La JVM 25 fournie avec
Android Studio sur ce PC ne convient pas a Gradle 8.13. Android Studio cree
`local.properties` avec
le chemin du SDK ; ce fichier reste local. L'APK de test est dans
`Android/app/build/outputs/apk/debug/app-debug.apk`. Sa barre de navigateur
est normale : ne pas publier de cle debug pour supprimer cette barre.

## 2. Creer l'APK signe a distribuer

Dans Android Studio, utiliser **Build > Generate Signed App Bundle / APK > APK** :

1. Choisir le module `app` et creer une cle de signature release (`.jks`).
2. Conserver cette cle **hors du depot**, avec ses mots de passe dans un gestionnaire
   de mots de passe. Faire une sauvegarde privee : la meme cle sera necessaire
   pour mettre a jour l'application sans la desinstaller.
3. Selectionner la variante `release`, choisir le dossier de sortie et generer l'APK.
4. Ne jamais envoyer la cle, ses mots de passe ou une capture les contenant dans
   le chat, Git ou le VPS. L'APK signe peut etre transmis aux utilisateurs prevus.

La release n'est volontairement pas signee avec la cle debug automatiquement.
Une compilation `assembleRelease` seule ne remplace pas cette etape de signature.

## 3. Associer l'APK au domaine

L'association sert a masquer la barre d'adresse pour **votre** domaine. Elle ne
remplace pas la connexion : les techniciens utilisent toujours leur mot de passe.

Recuperer l'empreinte du **certificat de signature de l'APK**, et non le SHA-256
du fichier APK, ni l'empreinte du certificat HTTPS. Dans PowerShell :

```powershell
$env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\jbr-21.0.11'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$sdk\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs 'C:\chemin\vers\app-release.apk'
```

Adapter les chemins si necessaire. Prendre la ligne
`Signer #1 certificate SHA-256 digest`. Seule cette empreinte publique est utile.
Depuis la racine du depot, remplacer la valeur ci-dessous par l'empreinte complete :

```powershell
node Android/scripts/assetlinks.mjs --sha256 "EMPREINTE_DU_CERTIFICAT_APK"
```

Le script cree `Frontend/public/.well-known/assetlinks.json`. Il refuse les
empreintes mal formees, dedoublonne et conserve les associations existantes.
Plusieurs `--sha256` sont possibles pour une rotation planifiee. Une ancienne
cle reste autorisee tant que son empreinte est presente : la retirer explicitement
du JSON en cas de revocation. Ne pas ajouter une cle debug a la liste de production.

Le fichier public contient maintenant l'empreinte du certificat de la release
signe du 28 septembre 2026 et peut etre versionne, contrairement aux cles privees.
Si une publication Play Store est decidee plus tard, ajouter l'empreinte de la
**cle de signature d'application Play**, pas seulement celle de la cle d'import.

## 4. Publier uniquement cette association sur le VPS

Il n'est pas necessaire de toucher a Nginx, de redemander le certificat HTTPS,
de redemarrer PostgreSQL ou de recompiler le backend.

Depuis PowerShell a la racine du depot, copier le fichier public genere :

```powershell
scp .\Frontend\public\.well-known\assetlinks.json ubuntu@135.125.199.51:techplanner-assetlinks.json
```

Puis, dans la session SSH Ubuntu :

```sh
cd /home/ubuntu/BoumaticAPP
install -d -m 755 Frontend/public/.well-known Frontend/dist/.well-known &&
install -m 644 "$HOME/techplanner-assetlinks.json" Frontend/public/.well-known/assetlinks.json &&
install -m 644 "$HOME/techplanner-assetlinks.json" Frontend/dist/.well-known/assetlinks.json
curl --max-time 20 -i https://techplanner.fr/.well-known/assetlinks.json
```

Arreter si une commande echoue. Si le VPS possede deja une association differente,
la recuperer et la fusionner localement avant de la remplacer. Le fichier doit
repondre **200**, sans redirection, avec `Content-Type: application/json`, le
package `fr.techplanner.app` et la bonne empreinte ; du HTML n'est pas une reponse
valide, meme avec un statut 200. Ne pas contourner une erreur de certificat TLS.

La copie dans `public` permet aux prochains builds de conserver l'association ;
la copie dans `dist` la rend disponible immediatement au Nginx existant. Versionner
ensuite le fichier public dans le depot pour les futurs deploiements. Aucun commit
ni push n'est fait automatiquement.

## 5. Installation et recette telephone

Distribuer l'APK **release signe**, puis autoriser ponctuellement son installation
depuis la source utilisee, selon les regles du telephone. Aucune obligation de
publier sur le Play Store pour cette distribution directe. Tester sur un telephone
avant de l'envoyer a toute l'equipe :

- Ouverture par l'icone TechPlanner, sans barre d'adresse une fois l'association validee.
- Connexion admin puis technicien, fermeture/reouverture, deconnexion effective.
- Planning, ouverture d'intervention et bouton Retour Android.
- Ajout d'une photo depuis l'appareil photo et depuis la galerie, puis affichage.
- Ouverture de Maps/Waze et retour au planning, clavier sans masquer les actions.
- En mode avion, aucune fausse confirmation d'enregistrement ; retour normal apres reconnexion.
- Mise a jour par un nouvel APK signe avec la meme cle et un `versionCode` superieur.

Si la barre d'adresse reste visible, verifier d'abord l'empreinte de l'APK installe
et le JSON public. Ne pas desactiver la verification Digital Asset Links dans Chrome.
Les evolutions des ecrans restent de simples deploiements web. Un changement du
conteneur Android exige une nouvelle release et l'incrementation de `versionCode`
dans `Android/app/build.gradle`.
