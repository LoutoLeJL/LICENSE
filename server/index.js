'use strict';

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Server } = require('socket.io');

const { registerSocketHandlers } = require('./src/handlers');

const PORT = process.env.PORT || 3000;

// Origines autorisées : '*' par défaut, ou liste séparée par des virgules.
// En production (déploiement séparé front/back), mets l'URL de ton frontend.
const RAW_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const ORIGIN =
  RAW_ORIGIN === '*' ? '*' : RAW_ORIGIN.split(',').map((s) => s.trim());

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(compression()); // gzip (utile pour shared/countries-50m.json)

// Sert le client statique : permet un déploiement « tout-en-un » sur UN seul
// service gratuit (ex: Render). Pour un déploiement séparé, ignore simplement
// cette partie et héberge /client sur Vercel/Netlify.
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// Données géographiques partagées entre client (mode Pays) et serveur
// (génération de lieux aléatoires) : servies sous /data pour le client.
app.use('/data', express.static(path.join(__dirname, '..', 'shared')));

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

server.listen(PORT, () => {
  console.log(`🌍 Serveur GeoGuessr-clone démarré sur le port ${PORT}`);
});
