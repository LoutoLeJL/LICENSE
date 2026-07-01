'use strict';

/**
 * Tunnel Cloudflare gratuit ("quick tunnel") : expose un port local sur
 * internet avec une URL https publique, sans compte ni configuration de
 * routeur/box. Utilisé par server/host.js pour le lancement "hôte" en
 * .exe (voir README, section « Lancer en tant qu'hôte »).
 *
 * L'URL change à chaque lancement (ex: https://mots-aleatoires.trycloudflare.com) :
 * c'est le compromis pour rester 100% gratuit et sans compte. L'hôte la
 * partage à ses amis à chaque soirée, comme un code de salle un peu plus long.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const CLOUDFLARED_DOWNLOAD_URL =
  'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

/**
 * Chemin où chercher/stocker cloudflared.exe : à côté de l'exécutable
 * packagé (pkg définit `process.pkg`), ou à côté du dossier server/ en dev.
 */
function cloudflaredPath() {
  const baseDir = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
  return path.join(baseDir, 'cloudflared.exe');
}

function download(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, { headers: { 'User-Agent': 'geoguessr-clone-host' } }, (res) => {
        // GitHub Releases redirige (souvent deux fois) vers l'asset réel.
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          download(res.headers.location, destPath, onProgress).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Téléchargement de cloudflared échoué (HTTP ${res.statusCode})`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress && total) onProgress(received / total);
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/** Télécharge cloudflared.exe s'il n'est pas déjà présent (idempotent). */
async function ensureCloudflared(onProgress) {
  const dest = cloudflaredPath();
  if (fs.existsSync(dest)) return dest;
  await download(CLOUDFLARED_DOWNLOAD_URL, dest, onProgress);
  return dest;
}

/**
 * Écoute la sortie d'un processus déjà lancé et résout dès qu'une URL de
 * tunnel apparaît (cloudflared l'écrit sur stderr, encadrée d'ASCII art).
 * Séparé de startTunnel() pour rester testable sans le vrai binaire.
 */
function waitForTunnelUrl(child, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("cloudflared n'a pas renvoyé de lien après le délai imparti"));
    }, timeoutMs);

    const onData = (data) => {
      if (settled) return;
      const match = data.toString().match(TUNNEL_URL_RE);
      if (match) {
        settled = true;
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`cloudflared s'est arrêté prématurément (code ${code})`));
    });
  });
}

/**
 * Lance un tunnel Cloudflare vers un port local et résout avec l'URL
 * publique générée.
 * @returns {Promise<{ url: string, process: import('child_process').ChildProcess }>}
 */
function startTunnel(localPort, cloudflaredExePath) {
  const child = spawn(cloudflaredExePath, [
    'tunnel',
    '--url',
    `http://localhost:${localPort}`,
    '--no-autoupdate',
  ]);
  return waitForTunnelUrl(child).then((url) => ({ url, process: child }));
}

module.exports = { ensureCloudflared, startTunnel, waitForTunnelUrl, cloudflaredPath, TUNNEL_URL_RE };
