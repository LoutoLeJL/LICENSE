# 🌍 GeoGuessr Clone — Multijoueur

Un clone web **multijoueur** de GeoGuessr, pensé pour un petit groupe d'amis et
**100 % gratuit** à héberger (aucune base de données, aucun coût d'infra).

- **Carte des suppositions :** [Leaflet](https://leafletjs.com/) + tuiles
  OpenStreetMap (gratuit, sans clé).
- **Vue 360° :** Google Street View (crédit gratuit de 200 $/mois) ou
  [Mapillary](https://www.mapillary.com/) en alternative 100 % gratuite.
- **Temps réel :** Node.js + [Socket.io](https://socket.io/).
- **Stockage :** en mémoire (rooms volatiles) — rien à payer, rien à gérer.

---

## ✨ Fonctionnalités

- 🏠 **Lobby** : un joueur crée une salle (code unique à 4 caractères), les
  autres la rejoignent.
- 🎮 **Parties en 5 manches** (configurable de 1 à 10).
- 📍 **Même lieu pour tous** : à chaque manche, tous les joueurs apparaissent
  exactement aux mêmes coordonnées.
- ⏱️ **Chronomètre** par manche (2 min par défaut, configurable), géré par le
  serveur (source de vérité).
- 🗺️ **Minimap interactive** pour placer son marqueur (clic + glisser).
- 🧮 **Scores** calculés via la **formule de Haversine** + décroissance
  exponentielle (0 à 5000 points).
- 🏆 **Classement final** avec mise en avant du gagnant.
- 🔁 **Rejouer** sans recréer de salle.

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
│       ├── game.js         # Déroulement des manches, minuteur, fin de partie
│       ├── store.js        # Stockage en mémoire des salles + codes uniques
│       ├── scoring.js      # Haversine + calcul des points (0–5000)
│       └── locations.js    # Liste de coordonnées (couverture Street View)
└── client/                 # FRONTEND — Vanilla JS (aucun build)
    ├── index.html
    ├── config.js           # ⚙️ URL serveur, clé Google Maps, fournisseur 360°
    ├── css/style.css
    └── js/
        ├── util.js         # Helpers (écrans, formats, couleurs)
        ├── net.js          # Surcouche Socket.io
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

### Flux des événements Socket.io

| Client → Serveur | Effet |
|---|---|
| `room:create {name}` | Crée une salle, renvoie le code |
| `room:join {code,name}` | Rejoint une salle existante (lobby) |
| `room:settings {rounds,roundTime}` | Hôte : règle la partie (lobby) |
| `game:start` | Hôte : tire 5 lieux et lance la manche 1 |
| `guess {lat,lng}` | Valide la supposition du joueur |
| `round:next` | Hôte : manche suivante / classement final |
| `game:restart` | Hôte : rejoue (retour lobby, scores remis à 0) |

| Serveur → Client | Contenu |
|---|---|
| `room:state` | État complet de la salle (joueurs, réglages, état) |
| `round:start` | `{round, location:{lat,lng}, endsAt}` |
| `round:progress` | `{submitted, total}` |
| `round:result` | Vrai lieu (avec nom), distances, points, scores |
| `game:over` | Classement final trié |

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

> ⚠️ La couverture Mapillary est plus variable que Street View. Si un lieu n'a
> pas d'image proche, ajoute/ajuste des coordonnées dans
> `server/src/locations.js` (privilégie des grandes villes bien couvertes).

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

- **Lieux :** édite `server/src/locations.js` (ajoute tes coins préférés !).
- **Difficulté du score :** ajuste `SCALE_KM` dans `server/src/scoring.js`
  (plus petit = plus difficile).
- **Déplacement libre / mode immobile :** `ALLOW_MOVE` dans `client/config.js`.
- **Nombre de manches / durée :** réglable dans le lobby par l'hôte.

---

## 🧰 Stack & dépendances

- Backend : `express`, `socket.io`, `cors`, `dotenv`.
- Frontend : Leaflet, Socket.io client, Google Maps JS API **ou** Mapillary JS
  (chargés via CDN, aucun bundler).

Bon jeu ! 🌍🎯
