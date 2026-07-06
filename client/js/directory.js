/**
 * Annuaire des lobbys, côté client : lecture directe de Firestore en REST
 * (aucun SDK nécessaire, la config Firebase de config.js suffit).
 *
 * Permet :
 *   - de lister les lobbys PUBLICS (nom, hôte, joueurs) et de les rechercher,
 *   - de résoudre un code de salle en URL d'hôte, pour rejoindre une partie
 *     hébergée sur le PC d'un autre joueur.
 *
 * Les écritures (inscription des lobbys) sont faites par le SERVEUR de
 * l'hôte, pas par ce module (voir server/src/lobbyDirectory.js).
 */
window.Directory = (function () {
  const LOBBY_FRESH_MS = 90 * 1000;

  function config() {
    const fb = window.APP_CONFIG.FIREBASE_CONFIG;
    if (!fb || !fb.projectId || !fb.apiKey) return null;
    if (String(fb.apiKey).startsWith("VOTRE_") || String(fb.projectId).startsWith("votre-")) {
      return null;
    }
    return {
      base: `https://firestore.googleapis.com/v1/projects/${fb.projectId}/databases/(default)/documents`,
      key: fb.apiKey,
    };
  }

  function isEnabled() {
    return !!config();
  }

  function fromFields(fields = {}) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) {
      if ("stringValue" in v) obj[k] = v.stringValue;
      else if ("booleanValue" in v) obj[k] = v.booleanValue;
      else if ("integerValue" in v) obj[k] = Number(v.integerValue);
    }
    return obj;
  }

  function isFresh(lobby) {
    return lobby.updatedAtMs && Date.now() - lobby.updatedAtMs < LOBBY_FRESH_MS;
  }

  /** Liste les lobbys publics encore vivants (heartbeat récent). */
  async function listPublicLobbies() {
    const cfg = config();
    if (!cfg) return [];
    const res = await fetch(`${cfg.base}:runQuery?key=${cfg.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "lobbies" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "isPublic" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
          limit: 50,
        },
      }),
    });
    if (!res.ok) throw new Error(`Annuaire injoignable (HTTP ${res.status})`);
    const rows = await res.json();
    return rows
      .filter((r) => r.document)
      .map((r) => fromFields(r.document.fields))
      .filter(isFresh)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  /** Résout un code de salle en entrée d'annuaire ({url, ...}) ou null. */
  async function lookupCode(code) {
    const cfg = config();
    if (!cfg) return null;
    const res = await fetch(
      `${cfg.base}/lobbies/${encodeURIComponent(String(code).toUpperCase())}?key=${cfg.key}`
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Annuaire injoignable (HTTP ${res.status})`);
    const doc = await res.json();
    const lobby = fromFields(doc.fields);
    return isFresh(lobby) ? lobby : null;
  }

  return { isEnabled, listPublicLobbies, lookupCode };
})();
