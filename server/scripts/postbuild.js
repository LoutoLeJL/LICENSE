'use strict';

/**
 * Après `pkg` (voir "build:exe" dans package.json), copie client/ et
 * shared/ à côté de l'exécutable généré. pkg gère mal les assets situés
 * hors du dossier du paquet (server/), donc ces dossiers ne sont pas
 * scellés dans l'exe : ils sont simplement livrés juste à côté (voir
 * server/src/paths.js pour la résolution de chemin correspondante).
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const distDir = path.join(__dirname, '..', 'dist');

for (const name of ['client', 'shared']) {
  const src = path.join(repoRoot, name);
  const dest = path.join(distDir, name);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`✅ Copié ${name}/ → dist/${name}/`);
}

console.log('\n📦 dist/ est prêt. Partage tout le dossier dist/ (exe + client/ + shared/) à');
console.log('   la personne qui va héberger la partie — cloudflared.exe se télécharge');
console.log('   automatiquement tout seul au premier lancement.');
