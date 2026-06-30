/* Fine surcouche autour de Socket.io. */
window.Net = (function () {
  let socket = null;

  function connect() {
    const url = window.APP_CONFIG.SERVER_URL;
    // '' => même origine (le serveur sert aussi le front).
    socket = url ? io(url, { transports: ["websocket", "polling"] }) : io();
    return socket;
  }

  function on(event, cb) {
    socket.on(event, cb);
  }

  function emit(event, payload) {
    socket.emit(event, payload);
  }

  function id() {
    return socket ? socket.id : null;
  }

  return { connect, on, emit, id };
})();
