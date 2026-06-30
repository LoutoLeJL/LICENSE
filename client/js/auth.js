/**
 * Comptes joueurs : connexion Google (Firebase Authentication) + stats
 * persos (Firestore). Entièrement optionnel — tant que `ENABLE_ACCOUNTS`
 * est à false ou que la config Firebase n'est pas renseignée, ce module
 * reste inactif et le jeu fonctionne normalement en « invité ».
 *
 * Le serveur de jeu (Socket.io) n'a aucune connaissance de Firebase : les
 * comptes ne servent qu'à pré-remplir le pseudo et à sauvegarder des stats
 * personnelles depuis le navigateur. Voir le README pour le détail des
 * règles de sécurité Firestore (chacun ne peut écrire que son propre doc).
 */
window.Auth = (function () {
  const cfg = window.APP_CONFIG;
  let ready = false;
  let currentUser = null;
  const changeListeners = [];

  function isConfigured() {
    return !!(
      cfg.ENABLE_ACCOUNTS &&
      cfg.FIREBASE_CONFIG &&
      cfg.FIREBASE_CONFIG.apiKey &&
      !cfg.FIREBASE_CONFIG.apiKey.startsWith('VOTRE_')
    );
  }

  function init() {
    if (!isConfigured() || ready) return;
    firebase.initializeApp(cfg.FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user;
      changeListeners.forEach((cb) => cb(user));
    });
    ready = true;
  }

  /** Appelle `cb(user|null)` à chaque changement, et immédiatement si déjà prêt. */
  function onChange(cb) {
    changeListeners.push(cb);
    if (ready) cb(currentUser);
  }

  function getUser() {
    return currentUser;
  }

  async function signIn() {
    if (!ready) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  }

  async function signOut() {
    if (!ready) return;
    await firebase.auth().signOut();
  }

  function statsRef() {
    if (!currentUser) return null;
    return firebase.firestore().collection('users').doc(currentUser.uid);
  }

  /** Lit les stats du joueur connecté (ou null si non connecté / jamais joué). */
  async function getStats() {
    const ref = statsRef();
    if (!ref) return null;
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  }

  /**
   * Enregistre le résultat d'une partie terminée pour le joueur connecté.
   * @param {{score:number, distances:number[]}} result
   *   score      score total obtenu sur cette partie
   *   distances  distances (km) de chaque supposition "précise" répondue
   *              (le mode Pays et les manches sans réponse ne comptent pas)
   */
  async function recordGameResult(result) {
    const ref = statsRef();
    if (!ref) return;
    const distSum = result.distances.reduce((a, b) => a + b, 0);

    await firebase.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? snap.data() : {};
      tx.set(
        ref,
        {
          displayName: currentUser.displayName || 'Joueur',
          photoURL: currentUser.photoURL || null,
          gamesPlayed: (prev.gamesPlayed || 0) + 1,
          totalScore: (prev.totalScore || 0) + result.score,
          bestScore: Math.max(prev.bestScore || 0, result.score),
          totalDistanceKm: (prev.totalDistanceKm || 0) + distSum,
          distanceSamples: (prev.distanceSamples || 0) + result.distances.length,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  return { init, onChange, getUser, signIn, signOut, getStats, recordGameResult, isConfigured };
})();
