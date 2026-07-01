# 🌍 GeoGuessr Clone — Multijoueur

Un clone web **multijoueur** de GeoGuessr, pensé pour un petit groupe d'amis et
**100 % gratuit** à héberger (aucune base de données, aucun coût d'infra).

- **Carte des suppositions :** [Leaflet](https://leafletjs.com/) + tuiles
  OpenStreetMap (gratuit, sans clé).
- **Vue 360° :** Google Street View (crédit gratuit de 200 $/mois) ou
  [Mapillary](https://www.mapillary.com/) en alternative 100 % gratuite.
- **Temps réel :** Node.js + [Socket.io](https://socket.io/).
- **Stockage de partie :** en mémoire (rooms volatiles) — rien à payer.
- **Comptes joueurs (optionnel) :** connexion Google + stats persos via
  [Firebase](https://firebase.google.com/) (plan Spark, gratuit).

---

## ✨ Fonctionnalités

- 🏠 **Lobby** : un joueur crée une salle (code unique à 4 caractères), les
  autres la rejoignent.
- 🎮 **Parties en 5 manches** (configurable de 1 à 10).
- 📍 **Même lieu pour tous, tiré vraiment au hasard** : à chaque manche, un
  point aléatoire est généré (pas une liste figée de villes) dans un pays
  choisi lui aussi au hasard, puis vérifié comme tombant bien sur ses terres
  — jamais deux fois exactement le même point, contrairement à une liste
  fixe. Voir « Génération des lieux » plus bas pour le détail.
- ⏱️ **Chronomètre** par manche (2 min par défaut, configurable), géré par le
  serveur (source de vérité).
- 🗺️ **Minimap interactive** pour placer son marqueur (clic + glisser).
- 🧮 **Scores** calculés via la **formule de Haversine** + décroissance
  exponentielle (0 à 5000 points).
- 🏆 **Classement final** avec mise en avant du gagnant.
- 🔁 **Rejouer** sans recréer de salle.
- 🎛️ **4 réglages de mode combinables** (l'hôte les choisit dans le lobby) :
  - **Supposition précise / Pays uniquement** : en mode Pays, on clique le
    pays sur la carte au lieu de placer un point (score 5000/0, plus rapide).
  - **Déplacement libre / NMPZ** : verrouille le déplacement dans la vue 360°
    pour une difficulté façon "No Move, Pan, Zoom".
  - **Zone géographique** : Monde entier, Europe, ou France uniquement.
  - **🔥 Battle Royale** : le joueur le moins précis est éliminé à chaque
    manche, jusqu'à ce qu'il n'en reste qu'un.
- 👤 **Comptes joueurs (optionnel)** : connexion avec Google, profil + stats
  persos (parties jouées, meilleur score, précision moyenne) sauvegardées
  entre les sessions. Le jeu reste 100 % jouable sans compte.

---

## 📁 Architecture du projet

```
.
├── package.json            # Scripts racine (lance le serveur)
├── render.yaml             # Déploiement Render en un clic (optionnel)
├── server/                 # BACKEND — Node.js + Socket.io
│   ├── package.json
│   ├── index.js            # Express + Socket.io ; sert aussi le client
│   ├── .env.example        # Variables d'environnement du serveur
│   └── src/
│       ├── handlers.js     # Câblage des événements Socket.io
│       ├── game.js         # Manches, minuteur, scores, élimination
│       ├── store.js        # Stockage en mémoire des salles + codes uniques
│       ├── scoring.js      # Haversine + calcul des points (0–5000)
│       └── randomLocation.js  # Génère un point aléatoire réel à chaque manche
├── shared/
│   └── countries-50m.json  # Frontières des pays, utilisées par le client
│                            # (mode Pays) ET le serveur (tirage aléatoire)
└── client/                 # FRONTEND — Vanilla JS (aucun build)
    ├── index.html
    ├── config.js           # ⚙️ URL serveur, clé Google Maps, Firebase, etc.
    ├── css/style.css
    └── js/
        ├── util.js         # Helpers (écrans, formats, couleurs)
        ├── net.js          # Surcouche Socket.io
        ├── auth.js         # Comptes joueurs (Google / Firebase), optionnel
        ├── panorama.js     # Vue 360° : Google Street View OU Mapillary
        ├── minimap.js      # Cartes Leaflet (supposition + résultats)
        └── app.js          # Contrôleur principal (UI + réseau + chrono)
```

### Pourquoi ce découpage ?

Le **serveur est autoritaire** : il choisit les lieux, lance/termine les
manches, et calcule les scores. Le client n'affiche que ce que le serveur lui
envoie. Cela évite la triche sur les scores et garantit que **tout le monde voit
le même endroit en même temps**.

> ⚠️ **Note anti-triche honnête :** pour afficher la vue 360°, le navigateur doit
> connaître les coordonnées du lieu (l'API Street View tourne côté client). Un
> joueur déterminé pourrait donc les lire dans les outils de développement. Pour
> une partie entre amis, c'est sans conséquence — on masque simplement le nom de
> rue et le lieu n'est révélé qu'à la fin de la manche.

### 🎲 Génération des lieux (`server/src/randomLocation.js`)

Chaque manche tire un **point réellement aléatoire**, pas une entrée dans une
liste figée :
1. Un pays est tiré au hasard parmi une liste d'environ 70 pays réputés bien
   couverts par Google Street View.
2. Un point est tiré au hasard dans le rectangle englobant ce pays, puis
   vérifié comme tombant bien **à l'intérieur de sa frontière réelle**
   (test point-dans-polygone sur les données de `shared/countries-50m.json`),
   en ne recommençant que si besoin.
3. Le nom du pays (en français) est renvoyé pour l'écran de résultats et pour
   le mode Pays — mais plus de nom de ville/monument précis, puisque le point
   n'est plus choisi dans une liste de lieux connus.

Deux choix assumés, pour rester honnête sur les limites :
- **La liste de pays est volontairement limitée** aux pays ayant une
  couverture Street View réelle (le mode « Monde entier » n'est donc pas
  *littéralement* n'importe quel point du globe — la Chine, l'Inde ou la
  majeure partie de l'Asie centrale n'y ont quasiment aucune image Street
  View — mais un tirage honnête parmi les pays où la partie a une vraie
  chance de fonctionner). Sans ce filtre, une bonne partie des manches
  tomberait sur un écran noir faute d'image disponible.
- **Zones de conflit actif volontairement exclues** (Ukraine, Russie, Israël/
  Palestine, Syrie, Yémen, Afghanistan...), par précaution.
- Pour les pays dont le territoire inclut des dépendances très éloignées
  (ex: la Guyane et La Réunion pour la France), seul le territoire principal
  (+ ses voisins proches, type Corse) est utilisé : sans ce filtre, le
  rectangle englobant devient énorme et l'échantillonnage tombe presque
  toujours à côté, voire dans le mauvais territoire pour le mode « France ».

Tu peux ajouter/retirer des pays dans `COUNTRY_NAMES_FR` (et `EUROPE_IDS` pour
le filtre Europe) en haut de ce fichier — les codes sont les identifiants ISO
3166-1 numériques utilisés par `shared/countries-50m.json`.

### Flux des événements Socket.io

| Client → Serveur | Effet |
|---|---|
| `room:create {name}` | Crée une salle, renvoie le code |
| `room:join {code,name}` | Rejoint une salle existante (lobby) |
| `room:settings {rounds, roundTime, guessType, movement, region, elimination}` | Hôte : règle la partie (lobby) |
| `game:start` | Hôte : tire les lieux (filtrés par zone) et lance la manche 1 |
| `guess {lat,lng}` (mode précis) ou `{countryId}` (mode Pays) | Valide la supposition du joueur |
| `round:next` | Hôte : manche suivante / classement final |
| `game:restart` | Hôte : rejoue (retour lobby, scores/éliminations remis à zéro) |

| Serveur → Client | Contenu |
|---|---|
| `room:state` | État complet de la salle (joueurs, réglages, état) |
| `round:start` | `{round, location:{lat,lng}, endsAt, guessType, movement}` |
| `round:progress` | `{submitted, total, submittedIds}` |
| `round:result` | Vrai lieu (nom + pays), distances ou pays correct, points, scores, `newlyEliminated` |
| `game:over` | Classement final trié (survivant en tête si Battle Royale) |

`guessType`, `movement`, `region` et `elimination` sont les 4 réglages
combinables du lobby (voir « Fonctionnalités » plus haut) : `guessType`
détermine la forme de la supposition (`{lat,lng}` ou `{countryId}`),
`movement` dit au client de verrouiller la vue 360° (`'nmpz'`), `region`
filtre les lieux tirés côté serveur, et `elimination` active le Battle
Royale (le serveur élimine le moins précis après chaque manche, sauf si ça
viderait la partie d'un coup).

---

## 🚀 Démarrage en local

Prérequis : **Node.js ≥ 18**.

```bash
# 1) Installer les dépendances du serveur
cd server
npm install

# 2) (optionnel) créer le fichier d'environnement
cp .env.example .env

# 3) Renseigner ta clé Google Maps côté client
#    -> ouvre client/config.js et remplace GOOGLE_MAPS_API_KEY

# 4) Lancer le serveur (il sert aussi le front)
npm start          # ou: npm run dev  (rechargement auto)
```

Puis ouvre **http://localhost:3000**. Ouvre plusieurs onglets pour simuler
plusieurs joueurs. 🎉

> Le serveur sert directement le dossier `client/`, donc **un seul service
> suffit** — c'est le plus simple et le plus économique.

---

## 🔑 Configurer & **sécuriser** la clé Google Maps

L'API Street View s'exécute dans le navigateur : la clé est donc forcément
visible dans le code client. **On ne la garde pas secrète, on la verrouille**
pour qu'elle soit inutilisable ailleurs que sur ton site et qu'elle ne dépasse
jamais le quota gratuit. Suis ces 5 étapes :

### 1) Créer la clé
1. Va sur [Google Cloud Console](https://console.cloud.google.com/) → crée un
   projet.
2. **APIs & Services → Library** : active **uniquement**
   **« Maps JavaScript API »** (elle inclut Street View). N'active rien d'autre.
3. **APIs & Services → Credentials → Create credentials → API key**.

### 2) Restreindre par site web (le plus important 🔒)
Dans la clé → **Application restrictions → Websites**, ajoute **tes domaines
exacts**, par exemple :
```
http://localhost:3000/*
https://mon-geoguessr.vercel.app/*
https://mon-back.onrender.com/*
```
➡️ La clé ne fonctionnera **que** depuis ces adresses. Si quelqu'un la copie,
elle est inutilisable sur son site.

### 3) Restreindre par API
Dans la clé → **API restrictions → Restrict key** → coche **seulement**
**« Maps JavaScript API »**. Ainsi la clé ne peut pas servir à appeler des API
payantes (Geocoding, Directions, etc.).

### 4) Plafonner l'usage (rester dans les 200 $/mois)
1. **APIs & Services → Maps JavaScript API → Quotas** : abaisse le quota de
   requêtes par jour (ex. quelques milliers/jour, largement suffisant entre
   amis). Une fois le quota atteint, l'API **s'arrête** au lieu de facturer.
2. **Billing → Budgets & alerts** : crée un budget (ex. 1 $) avec des alertes
   par e-mail à 50 % / 90 % / 100 %. Tu seras prévenu bien avant tout coût.

### 5) Vérifier
- Ne mets **jamais** de clé de facturation côté serveur dans ce projet : ici la
  seule clé est côté client et restreinte.
- Le fichier `.env` n'est **pas** committé (voir `.gitignore`).

> 💡 **Tu ne veux aucune carte bancaire ?** Passe à Mapillary (section suivante) :
> 100 % gratuit, sans facturation.

---

## 🆓 Alternative gratuite : Mapillary

1. Crée un compte sur [mapillary.com](https://www.mapillary.com/) →
   **Developers → Register an application** → récupère un **Client Token**.
2. Dans `client/config.js` :
   ```js
   PANORAMA_PROVIDER: 'mapillary',
   MAPILLARY_TOKEN: 'MLY|xxxx...'
   ```
3. C'est tout : le code va chercher l'image Mapillary la plus proche du lieu et
   l'affiche.

> ⚠️ La couverture Mapillary est plus variable que Street View. Si tu remarques
> qu'un pays de la liste tombe trop souvent sur un écran noir avec Mapillary,
> retire-le de `COUNTRY_NAMES_FR` dans `server/src/randomLocation.js`.

> ℹ️ Le mode NMPZ (verrouillage du déplacement) n'est géré que pour Google
> Street View ; avec Mapillary, la vue reste navigable quel que soit ce réglage.

---

## 👤 Comptes joueurs (connexion Google + stats persos)

Entièrement **optionnel** : tant que tu ne configures rien, `ENABLE_ACCOUNTS`
reste à `false` dans `client/config.js` et le jeu fonctionne normalement en
« invité » (pseudo libre, pas de stats sauvegardées). Si tu veux l'activer :

### 1) Créer un projet Firebase
1. Va sur la [Console Firebase](https://console.firebase.google.com/) →
   **Ajouter un projet**. Tu peux réutiliser le même projet Google Cloud que
   ta clé Maps (`gen-lang-client-...`) si tu en as déjà un, ou en créer un
   nouveau — peu importe.
2. Désactive Google Analytics si proposé (inutile ici, ça évite une étape).

### 2) Activer la connexion Google (zéro configuration OAuth manuelle)
1. Dans la console → **Authentication → Sign-in method**.
2. Active le fournisseur **Google**, choisis un e-mail de support, enregistre.
   ➡️ Contrairement à une intégration Google OAuth « à la main », Firebase
   configure tout seul le client OAuth : il n'y a **rien d'autre** à faire
   dans Google Cloud Console.
3. Toujours dans **Authentication → Settings → Authorized domains** :
   `localhost` y est déjà. Ajoute aussi le domaine de ton déploiement (ex.
   `mon-geoguessr.onrender.com`) une fois en ligne, sinon la connexion
   échouera silencieusement sur ce domaine.

### 3) Créer la base Firestore (stockage des stats)
1. Dans la console → **Firestore Database → Créer une base de données**.
2. Choisis une région proche de toi, démarre en **mode production**.
3. Onglet **Règles**, remplace tout par ceci puis publie :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   ➡️ Chaque joueur ne peut écrire **que** son propre document de stats ; tout
   le monde peut les lire (utile pour un futur classement entre amis).

### 4) Récupérer la config et l'activer côté client
1. Console → ⚙️ **Paramètres du projet → General** → fais défiler jusqu'à
   « Vos applications » → icône **`</>`** (Web) → enregistre une app.
2. Copie l'objet `firebaseConfig` affiché, et colle ses valeurs dans
   `client/config.js` :
   ```js
   ENABLE_ACCOUNTS: true,
   FIREBASE_CONFIG: {
     apiKey: 'AIza...',
     authDomain: 'ton-projet.firebaseapp.com',
     projectId: 'ton-projet',
     storageBucket: 'ton-projet.appspot.com',
     messagingSenderId: '...',
     appId: '1:...:web:...',
   },
   ```
3. Recharge la page : un bouton **« Se connecter avec Google »** apparaît sur
   l'écran d'accueil.

> 🔒 **Pas de secret à protéger ici non plus** : comme pour la clé Maps, la
> config Firebase ci-dessus est forcément publique (elle tourne dans le
> navigateur). La sécurité vient des **règles Firestore** de l'étape 3 — c'est
> elles qui empêchent un joueur d'écrire dans les stats d'un autre, pas le
> secret de la config.

> ⚠️ **Honnêteté sur la portée** : les stats sont écrites directement par le
> navigateur de chaque joueur (pas vérifiées par le serveur de jeu). Pour un
> groupe d'amis, c'est très bien — un joueur déterminé pourrait théoriquement
> gonfler ses propres stats, mais il ne peut pas toucher à celles des autres.
> Si tu veux un classement infalsifiable, il faudrait faire calculer/écrire
> les stats par le serveur (hors scope de ce clone).

---

## ☁️ Déploiement gratuit

### Option A — Tout-en-un sur Render (recommandé, le plus simple)

Le serveur sert aussi le front : **un seul service web gratuit** suffit.

1. Pousse ce dépôt sur GitHub.
2. Sur [Render](https://render.com/) → **New → Web Service** → connecte le repo.
3. Réglages :
   - **Build Command :** `cd server && npm install`
   - **Start Command :** `node server/index.js`
   - **Environment :** Node ; variable `CLIENT_ORIGIN=*` (par défaut).
4. Déploie. Récupère l'URL `https://...onrender.com`, et **ajoute-la dans les
   restrictions de ta clé Google** (étape 2 ci-dessus).

> Un fichier `render.yaml` est fourni pour automatiser ces réglages
> (*Blueprint* Render).

> ℹ️ Le plan gratuit de Render met le service en veille après inactivité : le
> premier chargement peut prendre ~30 s, c'est normal.

### Option B — Front (Vercel/Netlify) + Back (Render) séparés

1. **Backend** sur Render comme ci-dessus, mais mets
   `CLIENT_ORIGIN=https://ton-front.vercel.app`.
2. **Frontend** : déploie le dossier `client/` sur Vercel ou Netlify (site
   statique, aucun build). Dans `client/config.js`, mets
   `SERVER_URL: 'https://ton-back.onrender.com'`.
3. Ajoute les **deux** URLs (front et back) dans les restrictions de la clé
   Google.

---

## ⚙️ Personnalisation

- **Pays tirés au sort :** édite `COUNTRY_NAMES_FR` (et `EUROPE_IDS` pour le
  filtre Europe) dans `server/src/randomLocation.js` pour ajouter/retirer des
  pays de la rotation.
- **Difficulté du score :** ajuste `SCALE_KM` dans `server/src/scoring.js`
  (plus petit = plus difficile).
- **Déplacement libre / NMPZ :** `ALLOW_MOVE` dans `client/config.js` est un
  plafond global (mets `false` pour forcer NMPZ partout, même si l'hôte
  choisit « libre » dans le lobby) ; sinon, c'est un réglage par partie.
- **Nombre de manches / durée / mode / zone / Battle Royale :** tout est
  réglable dans le lobby par l'hôte, sans toucher au code.

---

## 🧰 Stack & dépendances

- Backend : `express`, `socket.io`, `cors`, `dotenv`, `compression` (gzip,
  utile pour `shared/countries-50m.json`), `topojson-client` (génération des
  lieux aléatoires).
- Frontend : Leaflet, Socket.io client, `topojson-client` (mode Pays),
  Google Maps JS API **ou** Mapillary JS, Firebase Auth + Firestore
  (comptes, optionnel) — tout chargé via CDN, aucun bundler.

Bon jeu ! 🌍🎯
