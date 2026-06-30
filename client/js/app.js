/**
 * Contrôleur principal de l'application côté client.
 * Orchestre : navigation entre écrans, événements réseau, chrono, et UI.
 */
(function () {
  const { $, showScreen, formatDistance, formatTime, colorFor, escapeHtml } =
    window.Util;

  // ----------------------------- État local ----------------------------
  const state = {
    youId: null,
    roomCode: null,
    isHost: false,
    players: [],
    settings: null,
    round: 0,
    totalRounds: 5,
    submitted: false,
    submittedIds: new Set(),
    panoReady: false,
    timerInterval: null,
    // Couleur attribuée à chaque joueur (ordre d'arrivée) pour les cartes.
    colorIndex: {},
    // Distances (km) de mes suppositions "précises" sur la partie en cours,
    // utilisées pour la stat de précision moyenne (compte joueur).
    myDistances: [],
  };

  // ------------------------------ Connexion ----------------------------
  Net.connect();
  registerNetEvents();
  registerUiEvents();
  registerAuth();

  /* ====================================================================
   *  ÉVÉNEMENTS RÉSEAU
   * ==================================================================== */
  function registerNetEvents() {
    Net.on("connect", () => {
      state.youId = Net.id();
    });

    Net.on("error:msg", ({ message }) => {
      $("home-error").textContent = message || "Une erreur est survenue.";
    });

    Net.on("room:joined", ({ code, youId }) => {
      state.roomCode = code;
      state.youId = youId;
      $("home-error").textContent = "";
      $("lobby-code").textContent = code;
      showScreen("screen-lobby");
    });

    Net.on("room:state", (room) => {
      applyRoomState(room);
    });

    Net.on("round:start", (data) => {
      startRoundUI(data);
    });

    Net.on("round:progress", ({ submitted, total, submittedIds }) => {
      $("waiting-text").textContent = `En attente des autres joueurs… (${submitted}/${total})`;
      state.submittedIds = new Set(submittedIds || []);
      renderPlayersHud();
    });

    Net.on("round:result", (data) => {
      showRoundResult(data);
    });

    Net.on("game:over", (data) => {
      showGameOver(data);
    });
  }

  /* ====================================================================
   *  ÉVÉNEMENTS UI
   * ==================================================================== */
  function registerUiEvents() {
    $("btn-create").addEventListener("click", () => {
      const name = $("input-name").value.trim();
      if (!name) return ($("home-error").textContent = "Choisis un pseudo.");
      Net.emit("room:create", { name });
    });

    $("btn-join").addEventListener("click", () => {
      const name = $("input-name").value.trim();
      const code = $("input-code").value.trim().toUpperCase();
      if (!name) return ($("home-error").textContent = "Choisis un pseudo.");
      if (!code) return ($("home-error").textContent = "Entre un code de salle.");
      Net.emit("room:join", { code, name });
    });

    $("input-code").addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });

    $("btn-copy").addEventListener("click", () => {
      navigator.clipboard?.writeText(state.roomCode || "");
      $("btn-copy").textContent = "✅";
      setTimeout(() => ($("btn-copy").textContent = "📋"), 1200);
    });

    $("set-rounds").addEventListener("change", emitSettings);
    $("set-time").addEventListener("change", emitSettings);
    $("set-guess-type").addEventListener("change", emitSettings);
    $("set-movement").addEventListener("change", emitSettings);
    $("set-region").addEventListener("change", emitSettings);
    $("set-elimination").addEventListener("change", emitSettings);

    $("btn-start").addEventListener("click", () => Net.emit("game:start"));
    $("btn-leave-lobby").addEventListener("click", leaveRoom);
    $("btn-leave-over").addEventListener("click", leaveRoom);

    $("btn-guess").addEventListener("click", submitGuess);
    $("btn-toggle-map").addEventListener("click", () => {
      $("guess-box").classList.toggle("expanded");
      Maps.GuessMap.refresh();
    });

    $("btn-next").addEventListener("click", () => Net.emit("round:next"));
    $("btn-again").addEventListener("click", () => Net.emit("game:restart"));
  }

  function emitSettings() {
    Net.emit("room:settings", {
      rounds: parseInt($("set-rounds").value, 10),
      roundTime: parseInt($("set-time").value, 10),
      guessType: $("set-guess-type").value,
      movement: $("set-movement").value,
      region: $("set-region").value,
      elimination: $("set-elimination").checked,
    });
  }

  /* ====================================================================
   *  COMPTES JOUEURS (Google / Firebase, optionnel)
   * ==================================================================== */
  function registerAuth() {
    Auth.init();
    if (!Auth.isConfigured()) return; // garde tout caché, rien à faire

    $("account-bar").classList.remove("hidden");

    Auth.onChange((user) => {
      $("btn-google-signin").classList.toggle("hidden", !!user);
      $("account-profile").classList.toggle("hidden", !user);
      if (user) {
        $("account-avatar").src = user.photoURL || "";
        $("account-name").textContent = user.displayName || "Joueur";
        if (!$("input-name").value.trim()) {
          $("input-name").value = (user.displayName || "").split(" ")[0];
        }
      } else {
        $("stats-panel").classList.add("hidden");
      }
    });

    $("btn-google-signin").addEventListener("click", () => {
      Auth.signIn().catch((e) => console.error("Connexion Google :", e));
    });
    $("btn-signout").addEventListener("click", () => {
      Auth.signOut().catch((e) => console.error("Déconnexion :", e));
    });
    $("btn-stats-toggle").addEventListener("click", async () => {
      const panel = $("stats-panel");
      if (!panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
        return;
      }
      $("stats-list").innerHTML = "<li>Chargement…</li>";
      panel.classList.remove("hidden");
      try {
        const stats = await Auth.getStats();
        renderStats(stats);
      } catch (e) {
        console.error("Lecture des stats :", e);
        $("stats-list").innerHTML = "<li>Impossible de charger les stats.</li>";
      }
    });
  }

  function renderStats(stats) {
    if (!stats || !stats.gamesPlayed) {
      $("stats-list").innerHTML = "<li>Aucune partie enregistrée pour l'instant.</li>";
      return;
    }
    const avgPrecision =
      stats.distanceSamples > 0
        ? formatDistance(stats.totalDistanceKm / stats.distanceSamples)
        : "—";
    const rows = [
      ["Parties jouées", stats.gamesPlayed],
      ["Meilleur score", `${(stats.bestScore || 0).toLocaleString("fr-FR")} pts`],
      ["Score moyen", `${Math.round((stats.totalScore || 0) / stats.gamesPlayed).toLocaleString("fr-FR")} pts`],
      ["Précision moyenne", avgPrecision],
    ];
    $("stats-list").innerHTML = rows
      .map(([label, value]) => `<li>${escapeHtml(label)} <b>${escapeHtml(String(value))}</b></li>`)
      .join("");
  }

  function leaveRoom() {
    Net.emit("room:leave");
    stopTimer();
    state.roomCode = null;
    showScreen("screen-home");
  }

  /* ====================================================================
   *  LOBBY / ÉTAT DE SALLE
   * ==================================================================== */
  function applyRoomState(room) {
    state.players = room.players;
    state.isHost = room.hostId === state.youId;
    state.totalRounds = room.totalRounds;
    state.settings = room.settings;

    // Attribue une couleur stable à chaque joueur (par ordre).
    room.players.forEach((p, i) => {
      if (!(p.id in state.colorIndex)) state.colorIndex[p.id] = i;
    });

    renderPlayerList(room.players);

    // Affiche/masque les contrôles d'hôte dans le lobby.
    if (room.state === "lobby") {
      $("host-settings").classList.toggle("hidden", !state.isHost);
      $("btn-start").classList.toggle("hidden", !state.isHost);
      $("waiting-host").classList.toggle("hidden", state.isHost);
      $("mode-summary").classList.toggle("hidden", state.isHost);
      $("set-rounds").value = room.settings.rounds;
      $("set-time").value = room.settings.roundTime;
      $("set-guess-type").value = room.settings.guessType;
      $("set-movement").value = room.settings.movement;
      $("set-region").value = room.settings.region;
      $("set-elimination").checked = room.settings.elimination;
      if (!state.isHost) renderModeSummary(room.settings);
    }

    // Contrôles d'hôte sur les autres écrans.
    $("btn-next").classList.toggle("hidden", !state.isHost);
    $("waiting-next").classList.toggle("hidden", state.isHost);
    $("btn-again").classList.toggle("hidden", !state.isHost);
    $("waiting-again").classList.toggle("hidden", state.isHost);

    // Si on revient au lobby (rejouer), réafficher l'écran lobby.
    if (room.state === "lobby" && !isOnScreen("screen-home")) {
      showScreen("screen-lobby");
    }
  }

  function renderPlayerList(players) {
    $("player-list").innerHTML = players
      .map((p) => {
        const color = colorFor(state.colorIndex[p.id] ?? 0);
        return (
          `<li class="${p.connected ? "" : "offline"}">` +
          `<span class="swatch" style="background:${color}"></span>` +
          `<span>${escapeHtml(p.name)}</span>` +
          (p.isHost ? '<span class="host-tag">Hôte</span>' : "") +
          `</li>`
        );
      })
      .join("");
  }

  /** Résumé en chips des réglages de partie, affiché aux non-hôtes dans le lobby. */
  function renderModeSummary(settings) {
    const chips = [
      `${settings.rounds} manches`,
      `${settings.roundTime}s/manche`,
      settings.guessType === "country" ? "Mode Pays" : "Supposition précise",
      settings.movement === "nmpz" ? "Sans déplacement" : "Déplacement libre",
      settings.region === "europe"
        ? "Zone : Europe"
        : settings.region === "france"
        ? "Zone : France"
        : "Zone : Monde entier",
    ];
    if (settings.elimination) chips.push("🔥 Battle Royale");
    $("mode-summary").innerHTML = chips
      .map((c) => `<span class="chip${settings.elimination && c.includes("Royale") ? " on" : ""}">${escapeHtml(c)}</span>`)
      .join("");
  }

  /** Encart "profils" affiché pendant la manche : toi + les autres joueurs,
   *  avec une coche dès qu'un joueur a validé sa supposition. */
  function renderPlayersHud() {
    $("players-hud").innerHTML = state.players
      .map((p) => {
        const color = colorFor(state.colorIndex[p.id] ?? 0);
        const initial = (p.name || "?").trim().charAt(0).toUpperCase();
        const isYou = p.id === state.youId;
        const done = state.submittedIds.has(p.id);
        let status = "";
        if (p.eliminated) status = '<span class="check elim">💀</span>';
        else if (done) status = '<span class="check">✓</span>';
        return (
          `<div class="player-row${isYou ? " you" : ""}${p.eliminated ? " eliminated" : ""}">` +
          `<span class="avatar" style="background:${color}">${escapeHtml(initial)}</span>` +
          `<span class="pname">${escapeHtml(p.name)}${isYou ? " (toi)" : ""}</span>` +
          status +
          `</div>`
        );
      })
      .join("");
  }

  /* ====================================================================
   *  DÉROULEMENT D'UNE MANCHE
   * ==================================================================== */
  async function startRoundUI(data) {
    state.round = data.round;
    state.totalRounds = data.totalRounds;
    state.submitted = false;
    state.submittedIds = new Set();
    if (data.round === 1) state.myDistances = [];

    $("round-indicator").textContent = `Manche ${data.round}/${data.totalRounds}`;
    $("waiting-overlay").classList.add("hidden");
    $("pano-error").classList.add("hidden");
    $("guess-box").classList.remove("expanded");
    renderPlayersHud();

    const me = state.players.find((p) => p.id === state.youId);
    const amEliminated = !!(me && me.eliminated);
    const isCountryMode = data.guessType === "country";

    const guessBtn = $("btn-guess");
    guessBtn.disabled = true;
    guessBtn.textContent = amEliminated
      ? "💀 Éliminé — spectateur"
      : isCountryMode
      ? "Choisissez un pays"
      : "Placez un marqueur";

    showScreen("screen-game");

    // Initialise la vue panoramique (une seule fois).
    if (!state.panoReady) {
      try {
        await Panorama.init($("pano"));
        state.panoReady = true;
      } catch (e) {
        console.error(e);
        alert(
          "Impossible de charger la vue panoramique.\n" +
            "Vérifie ta clé API dans client/config.js (voir le README)."
        );
      }
    }

    // Mode NMPZ : verrouille le déplacement/téléport dans la vue 360°.
    if (state.panoReady) Panorama.setMovement(data.movement !== "nmpz");

    // Réinitialise la minimap de supposition (mode précis ou mode pays).
    Maps.GuessMap.reset("guess-map", data.guessType, () => {
      if (state.submitted || amEliminated) return;
      guessBtn.disabled = false;
      guessBtn.textContent = isCountryMode ? "Valider mon pays" : "Valider ma supposition";
    });

    // Affiche la vue du lieu de cette manche.
    if (state.panoReady) {
      const ok = await Panorama.show({ lat: data.location.lat, lng: data.location.lng });
      $("pano-error").classList.toggle("hidden", ok);
    }

    startTimer(data.endsAt);
  }

  function submitGuess() {
    if (state.submitted) return;
    const guess = Maps.GuessMap.getGuess();
    if (!guess) return;
    state.submitted = true;
    Net.emit("guess", guess);

    $("btn-guess").disabled = true;
    $("btn-guess").textContent = "Validé ✅";
    $("waiting-text").textContent = "En attente des autres joueurs…";
    $("waiting-overlay").classList.remove("hidden");
    stopTimer();
  }

  /* ------------------------------ Chrono ------------------------------ */
  function startTimer(endsAt) {
    stopTimer();
    const tick = () => {
      const remaining = Math.max(0, (endsAt - Date.now()) / 1000);
      const el = $("timer");
      el.textContent = formatTime(remaining);
      el.classList.toggle("urgent", remaining <= 15);
      if (remaining <= 0) stopTimer();
    };
    tick();
    state.timerInterval = setInterval(tick, 250);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  /* ====================================================================
   *  RÉSULTATS DE MANCHE
   * ==================================================================== */
  function showRoundResult(data) {
    stopTimer();
    $("waiting-overlay").classList.add("hidden");
    showScreen("screen-result");

    $("result-title").textContent = `Résultats — Manche ${data.round}/${data.totalRounds}`;
    $("result-location").textContent = data.location.name
      ? `📍 ${data.location.name}`
      : "";

    // Mode auto-détecté depuis les résultats eux-mêmes (correct = null en mode précis).
    const isCountryMode = data.results.some((r) => r.correct !== null);

    // Pour la stat de précision moyenne (compte joueur) : ma distance ce tour-ci.
    if (!isCountryMode) {
      const mine = data.results.find((r) => r.id === state.youId);
      if (mine && mine.distanceKm != null) state.myDistances.push(mine.distanceKm);
    }

    // Carte : vrai lieu/pays + suppositions reliées.
    const entries = data.results.map((r) => ({
      name: r.name,
      guess: r.guess,
      color: colorFor(state.colorIndex[r.id] ?? 0),
    }));
    if (isCountryMode) {
      Maps.ResultMap.renderCountry("result-map", data.location, entries);
    } else {
      Maps.ResultMap.render("result-map", data.location, entries);
    }

    const newlyEliminated = new Set(data.newlyEliminated || []);

    // Tableau des points de la manche.
    $("result-list").innerHTML = data.results
      .map((r) => {
        const color = colorFor(state.colorIndex[r.id] ?? 0);
        let statusText;
        if (r.wasEliminated) statusText = "💀 Spectateur";
        else if (!r.guess) statusText = "Pas de réponse";
        else if (isCountryMode) statusText = r.correct ? "✅ Bon pays" : "❌ Mauvais pays";
        else statusText = formatDistance(r.distanceKm);
        const eliminatedBadge = newlyEliminated.has(r.id) ? ' <span class="elim-badge">💀 Éliminé !</span>' : "";

        return (
          `<li>` +
          `<span class="swatch" style="background:${color}"></span>` +
          `<span>${escapeHtml(r.name)}${eliminatedBadge}</span>` +
          `<span class="dist">${statusText}</span>` +
          `<span class="pts">${r.points} pts</span>` +
          `</li>`
        );
      })
      .join("");

    // Le bouton de l'hôte change de libellé sur la dernière manche.
    $("btn-next").textContent = data.isLastRound
      ? "Voir le classement final"
      : "Manche suivante";
  }

  /* ====================================================================
   *  FIN DE PARTIE
   * ==================================================================== */
  function showGameOver(data) {
    stopTimer();
    showScreen("screen-over");
    $("final-list").innerHTML = data.leaderboard
      .map((p, i) => {
        const color = colorFor(state.colorIndex[p.id] ?? 0);
        let medal;
        if (data.elimination) {
          medal = p.eliminated ? "💀" : "🏆";
        } else {
          medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
        }
        return (
          `<li class="${i === 0 ? "winner" : ""}">` +
          `<span class="rank">${medal}</span>` +
          `<span class="swatch" style="background:${color}"></span>` +
          `<span>${escapeHtml(p.name)}${data.elimination && !p.eliminated ? " (survivant)" : ""}</span>` +
          `<span class="score">${p.score.toLocaleString("fr-FR")}</span>` +
          `</li>`
        );
      })
      .join("");

    // Sauvegarde des stats persos si le joueur est connecté (Firebase).
    if (Auth.isConfigured() && Auth.getUser()) {
      const mine = data.leaderboard.find((p) => p.id === state.youId);
      const score = mine ? mine.score : 0;
      Auth.recordGameResult({ score, distances: state.myDistances }).catch((e) =>
        console.error("Sauvegarde des stats :", e)
      );
    }
    state.myDistances = [];
  }

  /* ------------------------------ Helpers ----------------------------- */
  function isOnScreen(id) {
    return $(id).classList.contains("active");
  }
})();
