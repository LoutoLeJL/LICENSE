'use strict';

/**
 * Câblage des événements Socket.io <-> logique de jeu.
 *
 * Événements reçus du client :
 *   room:create   { name }
 *   room:join     { code, name }
 *   room:settings { rounds, roundTime, guessType, movement, region, elimination }
 *                                          (hôte uniquement, dans le lobby)
 *   game:start                            (hôte uniquement, dans le lobby)
 *   guess         { lat, lng } (mode précis) | { countryId } (mode pays)
 *   round:next                            (hôte uniquement, sur l'écran résultats)
 *   game:restart                          (hôte uniquement, après la partie)
 *   room:leave
 *
 * Événements émis vers le client :
 *   room:state, room:joined, round:start, round:progress,
 *   round:result, game:over, error:msg
 */

const store = require('./store');
const game = require('./game');

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 10;
const MIN_TIME = 30;
const MAX_TIME = 600;
const GUESS_TYPES = new Set(['precise', 'country']);
const MOVEMENTS = new Set(['free', 'nmpz']);
const REGIONS = new Set(['world', 'europe', 'france']);

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // La room courante du socket (au plus une à la fois).
    socket.data.roomCode = null;

    socket.on('room:create', ({ name } = {}) => {
      leaveCurrentRoom(io, socket); // au cas où

      const room = store.createRoom(socket.id, name);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      socket.emit('room:joined', { code: room.code, youId: socket.id });
      game.broadcastState(io, room);
    });

    socket.on('room:join', ({ code, name } = {}) => {
      const room = store.getRoom(code);
      if (!room) {
        return socket.emit('error:msg', { message: "Cette salle n'existe pas." });
      }
      if (room.state !== 'lobby') {
        return socket.emit('error:msg', {
          message: 'Une partie est déjà en cours dans cette salle.',
        });
      }

      leaveCurrentRoom(io, socket);

      room.players[socket.id] = store.makePlayer(socket.id, name);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      socket.emit('room:joined', { code: room.code, youId: socket.id });
      game.broadcastState(io, room);
    });

    socket.on('room:settings', ({ rounds, roundTime, guessType, movement, region, elimination } = {}) => {
      const room = currentRoom(socket);
      if (!room || !isHost(room, socket) || room.state !== 'lobby') return;

      if (Number.isFinite(rounds)) {
        room.settings.rounds = clamp(Math.round(rounds), MIN_ROUNDS, MAX_ROUNDS);
      }
      if (Number.isFinite(roundTime)) {
        room.settings.roundTime = clamp(Math.round(roundTime), MIN_TIME, MAX_TIME);
      }
      if (GUESS_TYPES.has(guessType)) room.settings.guessType = guessType;
      if (MOVEMENTS.has(movement)) room.settings.movement = movement;
      if (REGIONS.has(region)) room.settings.region = region;
      if (typeof elimination === 'boolean') room.settings.elimination = elimination;

      game.broadcastState(io, room);
    });

    socket.on('game:start', () => {
      const room = currentRoom(socket);
      if (!room || !isHost(room, socket) || room.state !== 'lobby') return;
      if (Object.keys(room.players).length < 1) return;
      game.startGame(io, room);
    });

    socket.on('guess', (payload = {}) => {
      const room = currentRoom(socket);
      if (!room) return;
      game.recordGuess(io, room, socket.id, payload);
    });

    socket.on('round:next', () => {
      const room = currentRoom(socket);
      if (!room || !isHost(room, socket)) return;
      game.nextRound(io, room);
    });

    socket.on('game:restart', () => {
      const room = currentRoom(socket);
      if (!room || !isHost(room, socket)) return;
      if (room.state !== 'gameover') return;
      game.resetToLobby(io, room);
    });

    socket.on('room:leave', () => {
      leaveCurrentRoom(io, socket);
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom(io, socket);
    });
  });
}

/* ----------------------------- helpers ----------------------------- */

function currentRoom(socket) {
  return socket.data.roomCode ? store.getRoom(socket.data.roomCode) : null;
}

function isHost(room, socket) {
  return room.hostId === socket.id;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Retire le socket de sa room : supprime le joueur, migre l'hôte si besoin,
 * supprime la room si vide, et re-vérifie la fin de manche.
 */
function leaveCurrentRoom(io, socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = store.getRoom(code);
  socket.data.roomCode = null;
  socket.leave(code);
  if (!room) return;

  const wasHost = room.hostId === socket.id;
  delete room.players[socket.id];
  delete room.roundGuesses[socket.id];

  const remaining = Object.keys(room.players);
  if (remaining.length === 0) {
    store.deleteRoom(code);
    return;
  }

  // Migration de l'hôte vers le premier joueur restant.
  if (wasHost) room.hostId = remaining[0];

  // Si on attendait ce joueur pour terminer la manche, re-vérifier.
  if (room.state === 'playing' && game.allSubmitted(room)) {
    game.endRound(io, room);
  } else {
    game.broadcastState(io, room);
  }
}

module.exports = { registerSocketHandlers };
