'use strict';

/**
 * Logique de déroulement d'une partie : démarrage des manches, minuteur
 * côté serveur (autoritaire), calcul des scores et fin de partie.
 *
 * Le serveur est la source de vérité : il décide quand une manche se termine
 * (tout le monde a validé OU le temps est écoulé) et calcule les points.
 */

const { pickLocations } = require('./locations');
const { haversineKm, scoreFromDistance } = require('./scoring');
const { clearRoomTimer, publicPlayers } = require('./store');

/** Envoie l'état complet de la room à tous ses membres (resync UI). */
function broadcastState(io, room) {
  io.to(room.code).emit('room:state', {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    settings: room.settings,
    players: publicPlayers(room),
    currentRound: room.currentRound,
    totalRounds: room.settings.rounds,
    roundEndsAt: room.roundEndsAt,
  });
}

/** Démarre une partie : tire les lieux, remet les scores à zéro. */
function startGame(io, room) {
  room.locations = pickLocations(room.settings.rounds);
  room.currentRound = 0;
  for (const p of Object.values(room.players)) p.score = 0;
  startRound(io, room);
}

/** Démarre la manche suivante. */
function startRound(io, room) {
  room.currentRound += 1;
  room.state = 'playing';
  room.roundGuesses = {};

  const loc = room.locations[room.currentRound - 1];
  room.currentLocation = loc;
  room.roundEndsAt = Date.now() + room.settings.roundTime * 1000;

  clearRoomTimer(room);
  room.timer = setTimeout(() => endRound(io, room), room.settings.roundTime * 1000);

  // On envoie les coordonnées (nécessaires pour afficher la vue panoramique),
  // mais PAS le nom du lieu : il n'est révélé qu'aux résultats.
  io.to(room.code).emit('round:start', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    location: { lat: loc.lat, lng: loc.lng },
    endsAt: room.roundEndsAt,
    roundTime: room.settings.roundTime,
  });

  broadcastState(io, room);
}

/** Enregistre la supposition d'un joueur. Renvoie true si elle est acceptée. */
function recordGuess(io, room, socketId, guess) {
  if (room.state !== 'playing') return false;
  if (!room.players[socketId]) return false;
  if (room.roundGuesses[socketId]) return false; // déjà validé
  if (
    typeof guess?.lat !== 'number' ||
    typeof guess?.lng !== 'number' ||
    guess.lat < -90 || guess.lat > 90 ||
    guess.lng < -180 || guess.lng > 180
  ) {
    return false;
  }

  room.roundGuesses[socketId] = { lat: guess.lat, lng: guess.lng };

  // Informe la salle de la progression (X / Y joueurs ont validé).
  io.to(room.code).emit('round:progress', {
    submitted: Object.keys(room.roundGuesses).length,
    total: Object.keys(room.players).length,
  });

  // Tout le monde a validé -> on termine la manche immédiatement.
  if (allSubmitted(room)) {
    endRound(io, room);
  }
  return true;
}

function allSubmitted(room) {
  const playerIds = Object.keys(room.players);
  return playerIds.length > 0 && playerIds.every((id) => room.roundGuesses[id]);
}

/** Termine la manche en cours : calcule distances + points, diffuse les résultats. */
function endRound(io, room) {
  if (room.state !== 'playing') return; // garde-fou contre un double appel
  clearRoomTimer(room);
  room.state = 'roundResult';
  room.roundEndsAt = null;

  const loc = room.currentLocation;
  const results = Object.values(room.players)
    .map((p) => {
      const g = room.roundGuesses[p.id] || null;
      let distanceKm = null;
      let points = 0;
      if (g) {
        distanceKm = haversineKm(loc, g);
        points = scoreFromDistance(distanceKm);
      }
      p.score += points;
      return {
        id: p.id,
        name: p.name,
        guess: g,
        distanceKm,
        points,
        totalScore: p.score,
      };
    })
    .sort((a, b) => b.points - a.points);

  io.to(room.code).emit('round:result', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    location: loc, // inclut le nom du lieu (révélé)
    results,
    isLastRound: room.currentRound >= room.settings.rounds,
  });

  broadcastState(io, room);
}

/** Passe à la manche suivante, ou termine la partie si c'était la dernière. */
function nextRound(io, room) {
  if (room.state !== 'roundResult') return;
  if (room.currentRound >= room.settings.rounds) {
    endGame(io, room);
  } else {
    startRound(io, room);
  }
}

/** Termine la partie et diffuse le classement final. */
function endGame(io, room) {
  clearRoomTimer(room);
  room.state = 'gameover';
  room.roundEndsAt = null;

  const leaderboard = Object.values(room.players)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.to(room.code).emit('game:over', { leaderboard });
  broadcastState(io, room);
}

/** Réinitialise la salle pour rejouer (retour au lobby, scores à zéro). */
function resetToLobby(io, room) {
  clearRoomTimer(room);
  room.state = 'lobby';
  room.currentRound = 0;
  room.currentLocation = null;
  room.roundGuesses = {};
  room.roundEndsAt = null;
  room.locations = [];
  for (const p of Object.values(room.players)) p.score = 0;
  broadcastState(io, room);
}

module.exports = {
  broadcastState,
  startGame,
  startRound,
  recordGuess,
  endRound,
  nextRound,
  endGame,
  resetToLobby,
  allSubmitted,
};
