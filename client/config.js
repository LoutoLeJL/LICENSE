/**
 * Configuration CLIENT (chargée avant le reste de l'app).
 *
 * ⚠️ Ce fichier est public (servi au navigateur). N'y mets jamais de secret
 * de backend. La clé Google Maps y figure forcément (l'API Street View tourne
 * dans le navigateur) : on la protège par des RESTRICTIONS et des QUOTAS, pas
 * par le secret. Voir le README, section « Sécuriser la clé Google Maps ».
 */
window.APP_CONFIG = {
  // URL du serveur Socket.io.
  // - '' (vide)  => même origine que la page (déploiement tout-en-un / local).
  // - sinon, l'URL de ton backend Render, ex: 'https://mon-back.onrender.com'.
  SERVER_URL: '',

  // Fournisseur de vue panoramique : 'google' (recommandé) ou 'mapillary'.
  PANORAMA_PROVIDER: 'google',

  // Clé Google Maps JavaScript API (avec Street View activé).
  GOOGLE_MAPS_API_KEY: 'VOTRE_CLE_GOOGLE_MAPS_ICI',

  // Jeton d'accès Mapillary (uniquement si PANORAMA_PROVIDER === 'mapillary').
  MAPILLARY_TOKEN: 'VOTRE_TOKEN_MAPILLARY_ICI',

  // Autoriser les joueurs à se déplacer dans la vue (mode "Moving" de GeoGuessr).
  // Mets `false` pour un mode "NMPZ" (immobile) plus difficile.
  ALLOW_MOVE: true,

  // Comptes joueurs (connexion Google + stats persos), 100% optionnel.
  // Laisse `false` tant que tu n'as pas configuré Firebase (voir le README,
  // section « Comptes joueurs »). Le jeu reste entièrement jouable sans ça,
  // juste sans bouton de connexion ni sauvegarde de stats.
  ENABLE_ACCOUNTS: false,

  // Config de ton projet Firebase (Project settings > General > Your apps).
  // Aucune de ces valeurs n'est un secret à protéger : elles identifient ton
  // projet, la sécurité réelle vient des règles Firestore (voir le README).
  FIREBASE_CONFIG: {
    apiKey: 'VOTRE_FIREBASE_API_KEY',
    authDomain: 'votre-projet.firebaseapp.com',
    projectId: 'votre-projet',
    storageBucket: 'votre-projet.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
};
