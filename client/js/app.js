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
    round: 0,
    totalRounds: 5,
    submitted: false,
    submittedIds: new Set(),
    panoReady: false,
    timerInterval: null,
    // Couleur attribuée à chaque joueur (ordre d'arrivée) pour les cartes.
    colorIndex: {},
  };

  // ------------------------------ Connexion ----------------------------
  Net.connect();
  registerNetEvents();
  registerUiEvents();

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
    });
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
      $("set-rounds").value = room.settings.rounds;
      $("set-time").value = room.settings.roundTime;
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

  /** Encart "profils" affiché pendant la manche : toi + les autres joueurs,
   *  avec une coche dès qu'un joueur a validé sa supposition. */
  function renderPlayersHud() {
    $("players-hud").innerHTML = state.players
      .map((p) => {
        const color = colorFor(state.colorIndex[p.id] ?? 0);
        const initial = (p.name || "?").trim().charAt(0).toUpperCase();
        const isYou = p.id === state.youId;
        const done = state.submittedIds.has(p.id);
        return (
          `<div class="player-row${isYou ? " you" : ""}">` +
          `<span class="avatar" style="background:${color}">${escapeHtml(initial)}</span>` +
          `<span class="pname">${escapeHtml(p.name)}${isYou ? " (toi)" : ""}</span>` +
          (done ? '<span class="check">✓</span>' : "") +
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

    $("round-indicator").textContent = `Manche ${data.round}/${data.totalRounds}`;
    $("waiting-overlay").classList.add("hidden");
    $("guess-box").classList.remove("expanded");
    renderPlayersHud();

    const guessBtn = $("btn-guess");
    guessBtn.disabled = true;
    guessBtn.textContent = "Placez un marqueur";

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

    // Réinitialise la minimap de supposition.
    Maps.GuessMap.reset("guess-map", () => {
      if (state.submitted) return;
      guessBtn.disabled = false;
      guessBtn.textContent = "Valider ma supposition";
    });

    // Affiche la vue du lieu de cette manche.
    if (state.panoReady) {
      const ok = await Panorama.show({ lat: data.location.lat, lng: data.location.lng });
      if (!ok) {
        console.warn("Aucune vue panoramique trouvée pour ce lieu.");
      }
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

    // Carte : vrai lieu + suppositions reliées.
    const entries = data.results.map((r) => ({
      name: r.name,
      guess: r.guess,
      color: colorFor(state.colorIndex[r.id] ?? 0),
    }));
    Maps.ResultMap.render("result-map", data.location, entries);

    // Tableau des points de la manche.
    $("result-list").innerHTML = data.results
      .map((r) => {
        const color = colorFor(state.colorIndex[r.id] ?? 0);
        return (
          `<li>` +
          `<span class="swatch" style="background:${color}"></span>` +
          `<span>${escapeHtml(r.name)}</span>` +
          `<span class="dist">${
            r.guess ? formatDistance(r.distanceKm) : "Pas de réponse"
          }</span>` +
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
        const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
        return (
          `<li class="${i === 0 ? "winner" : ""}">` +
          `<span class="rank">${medal}</span>` +
          `<span class="swatch" style="background:${color}"></span>` +
          `<span>${escapeHtml(p.name)}</span>` +
          `<span class="score">${p.score.toLocaleString("fr-FR")}</span>` +
          `</li>`
        );
      })
      .join("");
  }

  /* ------------------------------ Helpers ----------------------------- */
  function isOnScreen(id) {
    return $(id).classList.contains("active");
  }
})();
