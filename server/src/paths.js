'use strict';

const path = require('path');

/**
 * Résout un dossier "externe" (client/, shared/) qui n'est pas embarqué
 * dans l'exécutable packagé (pkg) mais livré à côté de lui — pkg gère mal
 * les assets situés hors du dossier du paquet (server/), donc client/ et
 * shared/ sont copiés à côté de l'exe par `npm run build:exe` plutôt que
 * scellés dedans. En dev (node normal), résout relativement à la racine
 * du dépôt.
 */
function resolveExternalDir(name) {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), name);
  }
  return path.join(__dirname, '..', '..', name);
}

module.exports = { resolveExternalDir };
