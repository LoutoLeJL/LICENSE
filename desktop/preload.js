'use strict';

/**
 * Pont sécurisé entre la page du jeu et le processus Electron.
 * Le client détecte l'app de bureau via `window.desktop` :
 *   - desktop.ensureTunnel() : démarre le tunnel public avant d'héberger.
 *   - desktop.version()      : version de l'app (affichage/debug).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  ensureTunnel: () => ipcRenderer.invoke('ensure-tunnel'),
  version: () => ipcRenderer.invoke('app-version'),
});
