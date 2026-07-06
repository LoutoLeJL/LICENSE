/**
 * Fine surcouche autour de Socket.io, avec RECONNEXION vers un autre
 * serveur : quand chaque joueur peut héberger sa propre partie, rejoindre un
 * lobby distant = se reconnecter au serveur de CET hôte (résolu via
 * l'annuaire). Les handlers enregistrés via Net.on() sont conservés et
 * ré-attachés automatiquement à chaque reconnexion.
 */
window.Net = (function () {
  let socket = null;
  let currentTarget = null; // URL actuelle ('' = même origine)
  const handlers = {}; // event -> [callbacks], ré-appliqués à chaque connect

  /**
   * Connecte (ou reconnecte) le socket.
   * @param {string} [url] URL du serveur à joindre. Omis/'' => serveur par
   *   défaut (SERVER_URL de config.js, ou même origine que la page).
   */
  function connect(url) {
    const target = url || window.APP_CONFIG.SERVER_URL || "";
    if (socket && currentTarget === target && socket.connected) return socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    currentTarget = target;
    socket = target ? io(target, { transports: ["websocket", "polling"] }) : io();
    for (const [event, cbs] of Object.entries(handlers)) {
      for (const cb of cbs) socket.on(event, cb);
    }
    return socket;
  }

  function on(event, cb) {
    (handlers[event] = handlers[event] || []).push(cb);
    if (socket) socket.on(event, cb);
  }

  function emit(event, payload) {
    socket.emit(event, payload); // socket.io met en file si pas encore connecté
  }

  function id() {
    return socket ? socket.id : null;
  }

  /** URL du serveur actuellement visé ('' = même origine). */
  function target() {
    return currentTarget;
  }

  return { connect, on, emit, id, target };
})();
