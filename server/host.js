'use strict';

/**
 * Point d'entrée "hôte" : à lancer directement (ou via l'exécutable packagé,
 * voir README section « Lancer en tant qu'hôte ») sur le PC de la personne
 * qui organise la partie. Démarre le serveur de jeu en local, puis ouvre un
 * tunnel Cloudflare gratuit pour que les amis puissent s'y connecter par
 * internet sans que l'hôte ait à configurer sa box/routeur ni payer un
 * hébergement.
 *
 * Le système de code de salle (4 lettres) ne change pas : seule l'adresse à
 * laquelle on rejoint le jeu diffère d'une soirée à l'autre (le lien du
 * tunnel), au lieu d'une URL fixe type Render.
 */

const { createServer } = require('./src/createServer');
const { ensureCloudflared, startTunnel } = require('./src/cloudflared');
const directory = require('./src/lobbyDirectory');

const LOCAL_PORT = Number(process.env.PORT) || 3000;

function banner(lines) {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const bar = '═'.repeat(width);
  console.log('╔' + bar + '╗');
  for (const line of lines) {
    console.log('║  ' + line.padEnd(width - 2) + '║');
  }
  console.log('╚' + bar + '╝');
}

async function main() {
  console.log('🌍 GeoGuessr Clone — lancement du serveur hôte...\n');

  await createServer({ port: LOCAL_PORT });
  console.log(`✅ Serveur de jeu démarré (port local ${LOCAL_PORT}).`);
  console.log('🔌 Préparation du tunnel internet (Cloudflare, gratuit, sans compte)...');

  let cloudflaredExePath;
  try {
    cloudflaredExePath = await ensureCloudflared((frac) => {
      process.stdout.write(`\r   Téléchargement de cloudflared... ${Math.round(frac * 100)}%   `);
    });
    process.stdout.write('\n');
  } catch (err) {
    console.error('\n❌ Impossible de récupérer cloudflared :', err.message);
    console.error('   Vérifie ta connexion internet, ou télécharge-le manuellement depuis');
    console.error('   https://github.com/cloudflare/cloudflared/releases');
    console.error('   et place "cloudflared.exe" à côté de ce programme.');
    process.exitCode = 1;
    return;
  }

  let tunnel;
  try {
    tunnel = await startTunnel(LOCAL_PORT, cloudflaredExePath);
  } catch (err) {
    console.error('❌ Le tunnel Cloudflare a échoué :', err.message);
    process.exitCode = 1;
    return;
  }

  // Les salles créées ici s'inscriront dans l'annuaire des lobbys avec
  // cette URL publique (si Firebase est configuré dans client/config.js).
  directory.setPublicUrl(tunnel.url);

  banner([
    "🌍 GeoGuessr Clone — tu es l'hôte !",
    '',
    'Partage CE lien à tes amis (il change à chaque lancement) :',
    tunnel.url,
    '',
    '1. Ouvre ce lien toi-même dans ton navigateur',
    '2. Clique "Créer une salle" → tu obtiens un code à 4 lettres',
    "3. Partage CE CODE à tes amis : ils ouvrent le même lien ci-dessus,",
    '   puis cliquent "Rejoindre" avec le code',
    '',
    'Laisse cette fenêtre ouverte tant que vous jouez.',
    'Ferme-la (ou Ctrl+C) pour arrêter le serveur et le tunnel.',
  ]);

  const shutdown = () => {
    console.log('\n👋 Arrêt du serveur et du tunnel...');
    tunnel.process.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Erreur inattendue :', err);
  process.exitCode = 1;
});
