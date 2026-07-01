'use strict';

/**
 * Construit l'app Express + Socket.io du jeu. Partagé par deux points
 * d'entrée :
 *   - index.js  : déploiement classique (Render, etc.), lit PORT/CLIENT_ORIGIN
 *                 dans l'environnement.
 *   - host.js   : lancement "hôte" en local (voir server/host.js), pensé
 *                 pour tourner sur le PC d'un joueur avec un tunnel Cloudflare.
 *
 * @param {{ port?: number, clientOrigin?: string }} options
 * @returns {Promise<import('http').Server>} le serveur HTTP, déjà en écoute.
 */

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Server } = require('socket.io');

const { registerSocketHandlers } = require('./handlers');
const { resolveExternalDir } = require('./paths');

function createServer({ port = 3000, clientOrigin = '*' } = {}) {
  const ORIGIN =
    clientOrigin === '*' ? '*' : clientOrigin.split(',').map((s) => s.trim());

  const app = express();
  app.use(cors({ origin: ORIGIN }));
  app.use(compression()); // gzip (utile pour shared/countries-50m.json)

  // Sert le client statique : permet un déploiement « tout-en-un » sur UN
  // seul service gratuit (ex: Render), ou un lancement local direct.
  const clientDir = resolveExternalDir('client');
  app.use(express.static(clientDir));

  // Données géographiques partagées entre client (mode Pays) et serveur
  // (génération de lieux aléatoires) : servies sous /data pour le client.
  app.use('/data', express.static(resolveExternalDir('shared')));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Toute autre route renvoie l'app (utile si on ajoute du routing plus tard).
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: ORIGIN, methods: ['GET', 'POST'] },
  });

  registerSocketHandlers(io);

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

module.exports = { createServer };
