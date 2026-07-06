'use strict';

/**
 * Annuaire central des lobbys, stocké dans Firestore (gratuit) et accédé en
 * simple REST — aucune dépendance Firebase côté serveur.
 *
 * C'est ce qui permet, quand chaque joueur peut héberger sa propre partie sur
 * son PC, de quand même :
 *   - lister les lobbys PUBLICS (avec nom, joueurs, état) dans l'app,
 *   - rejoindre par code à 4 lettres même si la salle tourne sur le PC d'un
 *     autre (le code est résolu en URL d'hôte via l'annuaire).
 *
 * Chaque document `lobbies/{CODE}` contient :
 *   name, isPublic, url (adresse publique de l'hôte), code, hostName,
 *   players (nombre), state, updatedAtMs (heartbeat).
 * Les entrées dont le heartbeat date de plus de LOBBY_FRESH_MS sont
 * considérées mortes et ignorées à la lecture (l'hôte a fermé son app sans
 * désinscription propre, coupure réseau...).
 *
 * Toutes les écritures sont "fire-and-forget" : une panne de l'annuaire ne
 * doit JAMAIS casser une partie en cours.
 */

const { firebaseConfig } = require('./clientConfig');

const LOBBY_FRESH_MS = 90 * 1000;
const HEARTBEAT_MS = 30 * 1000;

// Injectable pour les tests (mock Firestore local) : par fonction ou via
// la variable d'environnement LOBBY_DIRECTORY_URL.
let baseUrlOverride = process.env.LOBBY_DIRECTORY_URL || null;
let publicUrl = process.env.PUBLIC_URL || null;
let warnedOnce = false;

function setBaseUrlOverride(url) {
  baseUrlOverride = url;
}

/** URL publique du serveur (tunnel ou URL Render), définie au démarrage. */
function setPublicUrl(url) {
  publicUrl = url ? String(url).replace(/\/+$/, '') : null;
}

function getPublicUrl() {
  return publicUrl;
}

function config() {
  if (baseUrlOverride) {
    return { base: baseUrlOverride, key: process.env.LOBBY_DIRECTORY_KEY || 'test' };
  }
  const fb = firebaseConfig();
  if (!fb) return null;
  return {
    base: `https://firestore.googleapis.com/v1/projects/${fb.projectId}/databases/(default)/documents`,
    key: fb.apiKey,
  };
}

/** L'annuaire est-il utilisable (Firebase configuré + URL publique connue) ? */
function isEnabled() {
  return !!(config() && publicUrl);
}

function warn(err) {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "⚠️ Annuaire des lobbys injoignable (la partie continue sans lui) :",
    err.message
  );
}

/* ---------------- Encodage <-> valeurs typées Firestore ---------------- */

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(Math.round(v)) };
  }
  return fields;
}

function fromFields(fields = {}) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) obj[k] = v.stringValue;
    else if ('booleanValue' in v) obj[k] = v.booleanValue;
    else if ('integerValue' in v) obj[k] = Number(v.integerValue);
  }
  return obj;
}

/* ------------------------------ Opérations ----------------------------- */

/**
 * Inscrit ou met à jour un lobby dans l'annuaire (upsert).
 * Écritures espacées d'au moins 10 s par salle (sauf `force`), pour ne pas
 * marteler Firestore à chaque événement de partie.
 */
async function upsertLobby(room, { force = false } = {}) {
  const cfg = config();
  if (!cfg || !publicUrl) return;
  const now = Date.now();
  if (!force && room._dirLastWriteMs && now - room._dirLastWriteMs < 10 * 1000) return;
  room._dirLastWriteMs = now;
  const body = {
    fields: toFields({
      code: room.code,
      name: room.lobbyName || `Salle de ${hostName(room)}`,
      isPublic: !!room.isPublic,
      url: publicUrl,
      hostName: hostName(room),
      players: Object.keys(room.players).length,
      state: room.state,
      updatedAtMs: Date.now(),
    }),
  };
  try {
    await fetch(`${cfg.base}/lobbies/${room.code}?key=${cfg.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    warn(err);
  }
}

/** Retire un lobby de l'annuaire (salle fermée). */
async function removeLobby(code) {
  const cfg = config();
  if (!cfg) return;
  try {
    await fetch(`${cfg.base}/lobbies/${code}?key=${cfg.key}`, { method: 'DELETE' });
  } catch (err) {
    warn(err);
  }
}

function hostName(room) {
  const host = room.players[room.hostId];
  return host ? host.name : 'Hôte';
}

module.exports = {
  upsertLobby,
  removeLobby,
  setPublicUrl,
  getPublicUrl,
  isEnabled,
  setBaseUrlOverride,
  LOBBY_FRESH_MS,
  HEARTBEAT_MS,
};
