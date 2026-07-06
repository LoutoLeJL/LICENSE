'use strict';

require('dotenv').config();

const { createServer } = require('./src/createServer');
const directory = require('./src/lobbyDirectory');

const PORT = process.env.PORT || 3000;

// Origines autorisées : '*' par défaut, ou liste séparée par des virgules.
// En production (déploiement séparé front/back), mets l'URL de ton frontend.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// URL publique de CE serveur (ex: https://mon-app.onrender.com), utilisée
// pour inscrire les salles dans l'annuaire des lobbys. Optionnel : sans ça,
// les salles de ce serveur n'apparaissent simplement pas dans l'annuaire.
if (process.env.PUBLIC_URL) directory.setPublicUrl(process.env.PUBLIC_URL);

createServer({ port: PORT, clientOrigin: CLIENT_ORIGIN }).then(() => {
  console.log(`🌍 Serveur GeoGuessr-clone démarré sur le port ${PORT}`);
  if (directory.isEnabled()) {
    console.log(`📒 Annuaire des lobbys actif (URL publique : ${directory.getPublicUrl()})`);
  }
});
