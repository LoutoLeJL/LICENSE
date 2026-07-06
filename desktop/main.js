'use strict';

/**
 * Application de bureau (Electron) : le jeu complet dans une fenêtre, avec
 * le serveur de jeu EMBARQUÉ — chaque personne qui installe l'app peut donc
 * héberger ses propres parties, pas seulement les rejoindre.
 *
 * Au lancement :
 *   1. Démarre le serveur de jeu local sur un port libre.
 *   2. Ouvre la fenêtre sur ce serveur (même client web que la version
 *      navigateur — une seule base de code).
 *   3. Vérifie les mises à jour sur GitHub Releases (electron-updater).
 *
 * Quand l'utilisateur clique « Créer une salle », le client demande (via
 * IPC 'ensure-tunnel') l'ouverture du tunnel Cloudflare : l'URL publique
 * obtenue sert à inscrire le lobby dans l'annuaire, pour que les autres
 * puissent le voir/rejoindre depuis leur propre app.
 */

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

// En app installée, client/ et shared/ sont livrés dans resources/ ;
// cloudflared.exe est téléchargé dans le dossier userData (accessible en
// écriture). Ces variables doivent être posées AVANT de charger le serveur.
if (app.isPackaged) {
  process.env.GEO_RESOURCES_DIR = process.resourcesPath;
}

let win = null;
let serverPort = null;
let tunnel = null; // { url, process }

async function startEmbeddedServer() {
  const { createServer } = require('../server/src/createServer');
  const server = await createServer({ port: 0 }); // 0 = port libre choisi par l'OS
  serverPort = server.address().port;
  console.log(`Serveur de jeu embarqué sur le port ${serverPort}`);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: 'GeoGuessr Clone',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://localhost:${serverPort}`);
}

/** Démarre le tunnel Cloudflare (une fois par session) et renvoie son URL. */
async function ensureTunnel() {
  if (tunnel) return tunnel.url;
  const { ensureCloudflared, startTunnel } = require('../server/src/cloudflared');
  const directory = require('../server/src/lobbyDirectory');

  const exePath = await ensureCloudflared();
  tunnel = await startTunnel(serverPort, exePath);
  directory.setPublicUrl(tunnel.url);
  console.log(`Tunnel public : ${tunnel.url}`);
  return tunnel.url;
}

function setupAutoUpdate() {
  if (!app.isPackaged) return; // pas de mise à jour en mode dev
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('Vérification des mises à jour impossible :', err.message);
    });
  } catch (err) {
    console.warn('electron-updater indisponible :', err.message);
  }
}

app.whenReady().then(async () => {
  process.env.GEO_CLOUDFLARED_DIR = app.getPath('userData');

  ipcMain.handle('ensure-tunnel', async () => {
    const url = await ensureTunnel();
    return { url };
  });
  ipcMain.handle('app-version', () => app.getVersion());

  await startEmbeddedServer();
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (tunnel) tunnel.process.kill();
  app.quit();
});
