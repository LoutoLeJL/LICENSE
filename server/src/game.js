'use strict';

/**
 * Logique de déroulement d'une partie : démarrage des manches, minuteur
 * côté serveur (autoritaire), calcul des scores et fin de partie.
 *
 * Le serveur est la source de vérité : il décide quand une manche se termine
 * (tout le monde a validé OU le temps est écoulé) et calcule les points.
 *
 * Réglages combinables (room.settings) :
 *   guessType   'precise' (Haversine, 0-5000 pts) | 'country' (binaire, 5000/0)
 *   movement    'free' | 'nmpz' (transmis au client, qui verrouille la vue)
 *   region      'world' | 'europe' | 'france' (filtre les lieux tirés)
 *   elimination Battle Royale : élimine le(s) moins précis à chaque manche.
 */

const { pickRandomLocations } = require('./randomLocation');
const { haversineKm, scoreFromDistance, MAX_SCORE } = require('./scoring');
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

/** Démarre une partie : tire les lieux (filtrés par zone), remet scores/éliminations à zéro. */
function startGame(io, room) {
  room.locations = pickRandomLocations(room.settings.rounds, room.settings.region);
  room.currentRound = 0;
  for (const p of Object.values(room.players)) {
    p.score = 0;
    p.eliminated = false;
  }
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
  // mais PAS le nom du lieu ni son pays : révélés seulement aux résultats.
  io.to(room.code).emit('round:start', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    location: { lat: loc.lat, lng: loc.lng },
    endsAt: room.roundEndsAt,
    roundTime: room.settings.roundTime,
    guessType: room.settings.guessType,
    movement: room.settings.movement,
  });

  broadcastState(io, room);
}

/** Valide et normalise une supposition selon le type de jeu en cours. */
function parseGuess(guessType, guess) {
  if (guessType === 'country') {
    if (typeof guess?.countryId !== 'string' || !/^\d{1,3}$/.test(guess.countryId)) {
      return null;
    }
    return { countryId: guess.countryId };
  }
  if (
    typeof guess?.lat !== 'number' ||
    typeof guess?.lng !== 'number' ||
    guess.lat < -90 || guess.lat > 90 ||
    guess.lng < -180 || guess.lng > 180
  ) {
    return null;
  }
  return { lat: guess.lat, lng: guess.lng };
}

/** Enregistre la supposition d'un joueur. Renvoie true si elle est acceptée. */
function recordGuess(io, room, socketId, guess) {
  if (room.state !== 'playing') return false;
  const player = room.players[socketId];
  if (!player) return false;
  if (player.eliminated) return false; // spectateur en mode Battle Royale
  if (room.roundGuesses[socketId]) return false; // déjà validé

  const parsed = parseGuess(room.settings.guessType, guess);
  if (!parsed) return false;

  room.roundGuesses[socketId] = parsed;

  // Informe la salle de la progression (qui a validé, X / Y joueurs actifs).
  io.to(room.code).emit('round:progress', {
    submittedIds: Object.keys(room.roundGuesses),
    submitted: Object.keys(room.roundGuesses).length,
    total: Object.values(room.players).filter((p) => !p.eliminated).length,
  });

  // Tout le monde (encore en jeu) a validé -> on termine la manche immédiatement.
  if (allSubmitted(room)) {
    endRound(io, room);
  }
  return true;
}

/** Vrai si tous les joueurs encore actifs (non éliminés) ont validé. */
function allSubmitted(room) {
  const active = Object.values(room.players).filter((p) => !p.eliminated);
  return active.length > 0 && active.every((p) => room.roundGuesses[p.id]);
}

/**
 * Applique l'élimination Battle Royale après une manche : élimine le(s)
 * joueur(s) actif(s) ayant marqué le moins de points, sauf si ça éliminerait
 * tout le monde d'un coup (dans ce cas, personne n'est éliminé ce tour-ci).
 * Renvoie la liste des ids nouvellement éliminés.
 */
function applyElimination(room, results) {
  const activeResults = results.filter((r) => !r.wasEliminated);
  if (activeResults.length <= 1) return [];

  const minPoints = Math.min(...activeResults.map((r) => r.points));
  const worst = activeResults.filter((r) => r.points === minPoints);
  if (worst.length >= activeResults.length) return []; // tout le monde ex aequo

  for (const r of worst) room.players[r.id].eliminated = true;
  return worst.map((r) => r.id);
}

/** Termine la manche en cours : calcule les points, applique l'élimination, diffuse. */
function endRound(io, room) {
  if (room.state !== 'playing') return; // garde-fou contre un double appel
  clearRoomTimer(room);
  room.state = 'roundResult';
  room.roundEndsAt = null;

  const loc = room.currentLocation;
  const isCountryMode = room.settings.guessType === 'country';

  const results = Object.values(room.players)
    .map((p) => {
      const wasEliminated = p.eliminated;
      const g = wasEliminated ? null : room.roundGuesses[p.id] || null;
      let distanceKm = null;
      let correct = null;
      let points = 0;

      if (g && isCountryMode) {
        correct = g.countryId === loc.countryId;
        points = correct ? MAX_SCORE : 0;
      } else if (g) {
        distanceKm = haversineKm(loc, g);
        points = scoreFromDistance(distanceKm);
      }

      if (!wasEliminated) p.score += points;

      return {
        id: p.id,
        name: p.name,
        guess: g,
        distanceKm,
        correct,
        points,
        totalScore: p.score,
        wasEliminated,
      };
    })
    .sort((a, b) => b.points - a.points);

  const newlyEliminated = room.settings.elimination ? applyElimination(room, results) : [];
  const activeCount = Object.values(room.players).filter((p) => !p.eliminated).length;
  const eliminationOver = room.settings.elimination && activeCount <= 1;

  io.to(room.code).emit('round:result', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    location: loc, // inclut le nom du lieu et son pays (révélés)
    results,
    newlyEliminated,
    isLastRound: room.currentRound >= room.settings.rounds || eliminationOver,
  });

  broadcastState(io, room);
}

/** Passe à la manche suivante, ou termine la partie (dernière manche ou un seul survivant). */
function nextRound(io, room) {
  if (room.state !== 'roundResult') return;
  const activeCount = Object.values(room.players).filter((p) => !p.eliminated).length;
  const eliminationOver = room.settings.elimination && activeCount <= 1;
  if (room.currentRound >= room.settings.rounds || eliminationOver) {
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

  // En Battle Royale, le(s) survivant(s) priment sur le score brut.
  const leaderboard = Object.values(room.players)
    .map((p) => ({ id: p.id, name: p.name, score: p.score, eliminated: p.eliminated }))
    .sort((a, b) =>
      a.eliminated === b.eliminated ? b.score - a.score : a.eliminated ? 1 : -1
    );

  io.to(room.code).emit('game:over', { leaderboard, elimination: room.settings.elimination });
  broadcastState(io, room);
}

/** Réinitialise la salle pour rejouer (retour au lobby, scores/éliminations à zéro). */
function resetToLobby(io, room) {
  clearRoomTimer(room);
  room.state = 'lobby';
  room.currentRound = 0;
  room.currentLocation = null;
  room.roundGuesses = {};
  room.roundEndsAt = null;
  room.locations = [];
  for (const p of Object.values(room.players)) {
    p.score = 0;
    p.eliminated = false;
  }
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
