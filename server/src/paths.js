'use strict';

const path = require('path');

/**
 * Résout un dossier "externe" (client/, shared/) qui n'est pas embarqué
 * dans l'exécutable packagé mais livré à côté de lui — pkg gère mal les
 * assets situés hors du dossier du paquet (server/), donc client/ et
 * shared/ sont copiés à côté de l'exe par `npm run build:exe` plutôt que
 * scellés dedans. Ordre de résolution :
 *   1. GEO_RESOURCES_DIR : défini par l'app Electron (dossier resources/).
 *   2. À côté de l'exécutable pkg (`process.pkg`).
 *   3. Racine du dépôt (dev, node normal).
 */
function resolveExternalDir(name) {
  if (process.env.GEO_RESOURCES_DIR) {
    return path.join(process.env.GEO_RESOURCES_DIR, name);
  }
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), name);
  }
  return path.join(__dirname, '..', '..', name);
}

module.exports = { resolveExternalDir };
