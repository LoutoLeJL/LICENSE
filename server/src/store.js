'use strict';

/**
 * Stockage en mémoire des salles (rooms). Suffisant pour un petit groupe
 * d'amis et 100 % gratuit (aucune base de données nécessaire).
 *
 * Structure d'une room :
 * {
 *   code: 'ABCD',
 *   hostId: <socketId>,
 *   state: 'lobby' | 'playing' | 'roundResult' | 'gameover',
 *   settings: {
 *     rounds, roundTime,
 *     guessType: 'precise' | 'country',   // type de supposition
 *     movement: 'free' | 'nmpz',          // déplacement dans la vue 360°
 *     region: 'world' | 'europe' | 'france', // zone des lieux tirés
 *     elimination: boolean,               // mode Battle Royale
 *   },
 *   players: { [socketId]: { id, name, score, connected, eliminated } },
 *   locations: [ {lat,lng,name,countryId,...}, ... ],
 *   currentRound: 0,
 *   currentLocation: {lat,lng,name} | null,
 *   roundGuesses: { [socketId]: {lat,lng} | {countryId} },
 *   roundEndsAt: <timestamp ms> | null,
 *   timer: <NodeJS.Timeout> | null,
 * }
 */

const rooms = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 (ambigus)
const CODE_LENGTH = 4;

const DEFAULT_SETTINGS = {
  rounds: 5,
  roundTime: 120,
  guessType: 'precise',
  movement: 'free',
  region: 'world',
  elimination: false,
};

function generateCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateCode();
  const room = {
    code,
    hostId,
    state: 'lobby',
    settings: { ...DEFAULT_SETTINGS },
    players: {},
    locations: [],
    currentRound: 0,
    currentLocation: null,
    roundGuesses: {},
    roundEndsAt: null,
    timer: null,
  };
  room.players[hostId] = makePlayer(hostId, hostName);
  rooms.set(code, room);
  return room;
}

function makePlayer(id, name) {
  return { id, name: sanitizeName(name), score: 0, connected: true, eliminated: false };
}

function sanitizeName(name) {
  const clean = String(name || '').trim().slice(0, 20);
  return clean.length ? clean : 'Joueur';
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase());
}

function deleteRoom(code) {
  const room = rooms.get(code);
  if (room && room.timer) clearTimeout(room.timer);
  rooms.delete(code);
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

/** Vue publique des joueurs (pour envoi au client). */
function publicPlayers(room) {
  return Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
    isHost: p.id === room.hostId,
    eliminated: p.eliminated,
  }));
}

module.exports = {
  rooms,
  createRoom,
  makePlayer,
  sanitizeName,
  getRoom,
  deleteRoom,
  clearRoomTimer,
  publicPlayers,
  DEFAULT_SETTINGS,
};
