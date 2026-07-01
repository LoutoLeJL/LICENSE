'use strict';

require('dotenv').config();

const { createServer } = require('./src/createServer');

const PORT = process.env.PORT || 3000;

// Origines autorisées : '*' par défaut, ou liste séparée par des virgules.
// En production (déploiement séparé front/back), mets l'URL de ton frontend.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

createServer({ port: PORT, clientOrigin: CLIENT_ORIGIN }).then(() => {
  console.log(`🌍 Serveur GeoGuessr-clone démarré sur le port ${PORT}`);
});
