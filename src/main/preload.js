/**
 * Preload script for secure IPC communication
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform
  platform: process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  quitApp: () => ipcRenderer.send('quit-app'),

  // Tab control
  switchTab: (tabId) => ipcRenderer.send('switch-tab', { tabId }),
  reloadTab: (tabId) => ipcRenderer.send('reload-tab', { tabId }),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Dark mode
  toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode'),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),

  // Layout
  setTabBarPosition: (position) => ipcRenderer.send('set-tab-bar-position', position),
  setTabDisplayMode: (mode) => ipcRenderer.send('set-tab-display-mode', mode),
  setTabSize: (size) => ipcRenderer.send('set-tab-size', size),

  // BrowserView overlay control
  hideViews: () => ipcRenderer.send('hide-views'),
  showViews: () => ipcRenderer.send('show-views'),

  // Profiles
  switchProfile: (profileId) => ipcRenderer.send('switch-profile', profileId),

  // Split view
  setSplitMode: (mode) => ipcRenderer.send('set-split-mode', mode),
  getSplitMode: () => ipcRenderer.invoke('get-split-mode'),

  // Developer tools
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),

  // Full reload (destroys BrowserViews and reinitializes)
  reloadApp: () => ipcRenderer.send('reload-app'),

  // External links
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Event listeners
  onConfigLoaded: (callback) => {
    ipcRenderer.on('config-loaded', (_event, data) => callback(data));
  },
  onTabUpdated: (callback) => {
    ipcRenderer.on('tab-updated', (_event, data) => callback(data));
  },
  onNavigationBlocked: (callback) => {
    ipcRenderer.on('navigation-blocked', (_event, data) => callback(data));
  },
  onTabSwitched: (callback) => {
    ipcRenderer.on('tab-switched', (_event, data) => callback(data));
  },

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
