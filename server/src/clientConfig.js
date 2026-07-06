'use strict';

/**
 * Lit client/config.js côté serveur, pour que l'utilisateur n'ait qu'UN seul
 * endroit où remplir sa configuration (clé Maps, Firebase...). Le fichier
 * client est un script qui assigne `window.APP_CONFIG` : on l'évalue dans un
 * bac à sable avec un faux `window` et on récupère l'objet.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { resolveExternalDir } = require('./paths');

let cached = null;

function loadClientConfig() {
  if (cached) return cached;
  const file = path.join(resolveExternalDir('client'), 'config.js');
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 1000 });
  } catch (e) {
    console.warn('⚠️ Impossible de lire client/config.js :', e.message);
    return {};
  }
  cached = sandbox.window.APP_CONFIG || {};
  return cached;
}

/** Config Firebase si elle est réellement remplie (pas les placeholders). */
function firebaseConfig() {
  const cfg = loadClientConfig().FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId || !cfg.apiKey) return null;
  if (String(cfg.apiKey).startsWith('VOTRE_') || String(cfg.projectId).startsWith('votre-')) {
    return null;
  }
  return cfg;
}

module.exports = { loadClientConfig, firebaseConfig };
