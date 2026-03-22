/**
 * Main process entry point for Minimal Browser
 */

const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  globalShortcut,
  nativeTheme
} = require('electron');
const path = require('path');
const { configStore } = require('./config');
const { browserManager } = require('./browser-manager');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';

function createWindow() {
  const windowState = configStore.getWindowState();

  const windowOpts = {
    x: windowState?.x,
    y: windowState?.y,
    width: windowState?.width || 1200,
    height: windowState?.height || 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Minimal',
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      backgroundThrottling: false
    }
  };

  if (isMac) {
    // macOS: keep native traffic lights, hide the rest of the title bar
    windowOpts.titleBarStyle = 'hiddenInset';
    windowOpts.trafficLightPosition = { x: 12, y: 10 };
  } else {
    // Windows/Linux: fully custom title bar
    windowOpts.frame = false;
    windowOpts.titleBarStyle = 'hidden';
  }

  mainWindow = new BrowserWindow(windowOpts);

  if (windowState?.isMaximized) {
    mainWindow.maximize();
  }

  browserManager.setMainWindow(mainWindow);

  // Apply saved profile layout settings
  const profile = configStore.getActiveProfile();
  browserManager.setTabBarPosition(profile?.tabBarPosition || 'top');
  browserManager.setTabDisplayMode(profile?.tabDisplayMode || 'full');
  browserManager.setTabSize(profile?.tabSize || 'medium');

  mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Config',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const { shell } = require('electron');
            shell.openPath(configStore.configPath).catch(console.error);
          }
        },
        { type: 'separator' },
        { role: 'quit', accelerator: 'CmdOrCtrl+Q' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  let saveStateTimeout = null;
  const scheduleStateSave = () => {
    if (saveStateTimeout) clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => {
      if (mainWindow) {
        const bounds = mainWindow.getBounds();
        configStore.saveWindowState({
          ...bounds,
          isMaximized: mainWindow.isMaximized()
        });
      }
    }, 500);
  };

  mainWindow.on('resized', scheduleStateSave);
  mainWindow.on('moved', scheduleStateSave);
  mainWindow.on('maximize', scheduleStateSave);
  mainWindow.on('unmaximize', scheduleStateSave);

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.once('show', () => {
    setTimeout(initializeTabs, 100);
  });

  mainWindow.on('closed', () => {
    browserManager.destroy();
    mainWindow = null;
  });
}

function initializeTabs() {
  if (!mainWindow) return;

  const profile = configStore.getActiveProfile();
  const tabs = profile.tabs;

  if (tabs.length === 0) return;

  mainWindow.webContents.send('config-loaded', {
    tabs,
    activeTabId: tabs[0].id,
    config: configStore.getConfig()
  });

  browserManager.loadTabs(tabs);
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+R', () => {
    browserManager.reloadActiveTab();
  });

  globalShortcut.register('CommandOrControl+W', () => {
    if (mainWindow) mainWindow.close();
  });

  // Ctrl/Cmd+1-9 to switch tabs
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      const profile = configStore.getActiveProfile();
      const tabs = profile?.tabs || [];
      const idx = i === 9 ? tabs.length - 1 : i - 1;
      if (tabs[idx]) {
        browserManager.switchTo(tabs[idx].id);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tab-switched', { tabId: tabs[idx].id });
        }
      }
    });
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

function setupIpc() {
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  // Tab switching
  ipcMain.on('switch-tab', (_event, { tabId }) => {
    browserManager.switchTo(tabId);
  });

  ipcMain.on('reload-tab', (_event, { tabId }) => {
    browserManager.reloadTab(tabId);
  });

  // Hide/show BrowserViews (for dropdown overlay)
  ipcMain.on('hide-views', () => {
    browserManager.hideActive();
  });

  ipcMain.on('show-views', () => {
    browserManager.showActive();
  });

  // Tab bar position
  ipcMain.on('set-tab-bar-position', (_event, position) => {
    browserManager.setTabBarPosition(position);
    // Save to config
    const profile = configStore.getActiveProfile();
    if (profile) {
      profile.tabBarPosition = position;
      configStore.save();
    }
  });

  // Tab display mode
  ipcMain.on('set-tab-display-mode', (_event, mode) => {
    browserManager.setTabDisplayMode(mode);
    const profile = configStore.getActiveProfile();
    if (profile) {
      profile.tabDisplayMode = mode;
      configStore.save();
    }
  });

  // Tab size
  ipcMain.on('set-tab-size', (_event, size) => {
    browserManager.setTabSize(size);
    const profile = configStore.getActiveProfile();
    if (profile) {
      profile.tabSize = size;
      configStore.save();
    }
  });

  // Dark mode
  ipcMain.handle('toggle-dark-mode', () => {
    const config = configStore.getConfig();
    const isDark = !(config.darkMode || false);
    configStore.updateConfig({ darkMode: isDark });
    return isDark;
  });

  ipcMain.handle('get-dark-mode', () => {
    const config = configStore.getConfig();
    return config.darkMode || false;
  });

  ipcMain.handle('get-config', () => {
    return configStore.getConfig();
  });

  // Save config from the in-app editor
  ipcMain.handle('save-config', (_event, newConfig) => {
    try {
      if (!newConfig || !newConfig.profiles || !Array.isArray(newConfig.profiles)) {
        return { success: false, error: 'Invalid config: must have profiles array' };
      }
      configStore.replaceConfig(newConfig);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Full app reload — destroy BrowserViews and reinitialize with new config
  ipcMain.on('reload-app', () => {
    if (!mainWindow) return;
    browserManager.destroy();

    // Re-apply layout settings from fresh config
    const profile = configStore.getActiveProfile();
    browserManager.setTabBarPosition(profile?.tabBarPosition || 'top');
    browserManager.setTabDisplayMode(profile?.tabDisplayMode || 'full');
    browserManager.setTabSize(profile?.tabSize || 'medium');

    // Reload the renderer shell
    mainWindow.webContents.reload();

    // Reinitialize tabs after renderer is ready
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(initializeTabs, 100);
    });
  });

  // Switch profile — destroys views and reloads with new profile's tabs
  ipcMain.on('switch-profile', (_event, profileId) => {
    const config = configStore.getConfig();
    const profile = config.profiles.find(p => p.id === profileId);
    if (!profile) return;

    configStore.updateConfig({ activeProfileId: profileId });
    browserManager.destroy();

    browserManager.setTabBarPosition(profile.tabBarPosition || 'top');
    browserManager.setTabDisplayMode(profile.tabDisplayMode || 'full');
    browserManager.setTabSize(profile.tabSize || 'medium');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config-loaded', {
        tabs: profile.tabs,
        activeTabId: profile.tabs[0]?.id,
        config: configStore.getConfig()
      });
      browserManager.loadTabs(profile.tabs);
    }
  });

  // Split view
  ipcMain.on('set-split-mode', (_event, mode) => {
    browserManager.setSplitMode(mode);
  });

  ipcMain.handle('get-split-mode', () => {
    return browserManager.getSplitMode();
  });

  // Developer tools — open as detached popup window
  ipcMain.on('toggle-devtools', () => {
    if (!mainWindow) return;
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  ipcMain.on('open-external', (_event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url).catch(console.error);
  });

  ipcMain.handle('get-config-path', () => {
    return configStore.configPath;
  });
}

app.whenReady().then(() => {
  configStore.init();
  createWindow();
  setupIpc();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterShortcuts();
});
