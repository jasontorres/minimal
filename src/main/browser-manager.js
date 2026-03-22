/**
 * Manages BrowserViews for each tab, positioned with pixel-based bounds.
 */

const { BrowserView, BrowserWindow, Menu, shell, session } = require('electron');

const TITLE_BAR_HEIGHT = 32;

const TAB_TOP_SIZES = { small: 28, medium: 36, large: 44 };
const TAB_LEFT_SIZES = { small: 120, medium: 160, large: 200 };
const TAB_LEFT_ICON_ONLY_SIZES = { small: 36, medium: 44, large: 52 };

const AUTH_DOMAINS = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'github.com',
  'auth0.com',
  'clerk.dev',
  'clerk.com',
];

class BrowserManager {
  constructor() {
    this.views = new Map();
    this.mainWindow = null;
    this.activeTabId = null;
    this.tabBarPosition = 'top';
    this.tabDisplayMode = 'full';
    this.tabSize = 'medium';
    this.authWindows = new Set();
    this.persistentSession = null;
    this.splitMode = 'single'; // 'single' | 'split-h' | 'split-v' | 'grid'
    this.tabOrder = []; // ordered list of tab IDs for layout
  }

  getSession() {
    if (!this.persistentSession) {
      this.persistentSession = session.fromPartition('persist:tabs');
    }
    return this.persistentSession;
  }

  setMainWindow(window) {
    this.mainWindow = window;
    window.on('resize', () => this.layoutViews());
    window.on('maximize', () => this.layoutViews());
    window.on('unmaximize', () => this.layoutViews());
  }

  setSplitMode(mode) {
    this.splitMode = mode;
    this.layoutViews();
  }

  getSplitMode() {
    return this.splitMode;
  }

  setTabBarPosition(position) {
    this.tabBarPosition = position;
    this.layoutViews();
  }

  setTabDisplayMode(mode) {
    this.tabDisplayMode = mode;
    this.layoutViews();
  }

  setTabSize(size) {
    this.tabSize = size;
    this.layoutViews();
  }

  getContentBounds() {
    const { width, height } = this.mainWindow.getContentBounds();
    const size = this.tabSize || 'medium';

    if (this.tabBarPosition === 'left') {
      const leftWidth = this.tabDisplayMode === 'icon-only'
        ? (TAB_LEFT_ICON_ONLY_SIZES[size] || 44)
        : (TAB_LEFT_SIZES[size] || 160);
      return {
        x: leftWidth,
        y: TITLE_BAR_HEIGHT,
        width: Math.max(0, width - leftWidth),
        height: Math.max(0, height - TITLE_BAR_HEIGHT)
      };
    }

    const topHeight = TAB_TOP_SIZES[size] || 36;
    const topOffset = TITLE_BAR_HEIGHT + topHeight;
    return {
      x: 0,
      y: topOffset,
      width,
      height: Math.max(0, height - topOffset)
    };
  }

  isAuthDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return AUTH_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch { return false; }
  }

  /**
   * Build a native right-click context menu for a BrowserView
   */
  setupContextMenu(view) {
    view.webContents.on('context-menu', (_event, params) => {
      const menuItems = [];

      // Navigation
      if (view.webContents.canGoBack()) {
        menuItems.push({
          label: 'Back',
          click: () => view.webContents.goBack()
        });
      }
      if (view.webContents.canGoForward()) {
        menuItems.push({
          label: 'Forward',
          click: () => view.webContents.goForward()
        });
      }
      menuItems.push({
        label: 'Reload',
        click: () => view.webContents.reload()
      });
      menuItems.push({ type: 'separator' });

      // Link-specific
      if (params.linkURL) {
        menuItems.push({
          label: 'Open Link in Browser',
          click: () => shell.openExternal(params.linkURL)
        });
        menuItems.push({
          label: 'Copy Link Address',
          click: () => {
            const { clipboard } = require('electron');
            clipboard.writeText(params.linkURL);
          }
        });
        menuItems.push({ type: 'separator' });
      }

      // Text editing
      if (params.isEditable) {
        menuItems.push({ label: 'Undo', role: 'undo' });
        menuItems.push({ label: 'Redo', role: 'redo' });
        menuItems.push({ type: 'separator' });
        menuItems.push({ label: 'Cut', role: 'cut' });
        menuItems.push({ label: 'Paste', role: 'paste' });
        menuItems.push({ type: 'separator' });
      }

      // Selection
      if (params.selectionText) {
        menuItems.push({
          label: 'Copy',
          role: 'copy'
        });
      }

      menuItems.push({ label: 'Select All', role: 'selectAll' });

      // Image
      if (params.mediaType === 'image') {
        menuItems.push({ type: 'separator' });
        menuItems.push({
          label: 'Copy Image',
          click: () => view.webContents.copyImageAt(params.x, params.y)
        });
        menuItems.push({
          label: 'Save Image As...',
          click: () => {
            const { dialog } = require('electron');
            const url = params.srcURL;
            dialog.showSaveDialog(this.mainWindow, {
              defaultPath: url.split('/').pop().split('?')[0] || 'image'
            }).then(result => {
              if (!result.canceled && result.filePath) {
                view.webContents.downloadURL(url);
              }
            });
          }
        });
      }

      // Inspect element
      menuItems.push({ type: 'separator' });
      menuItems.push({
        label: 'Inspect Element',
        click: () => view.webContents.inspectElement(params.x, params.y)
      });

      const menu = Menu.buildFromTemplate(menuItems);
      menu.popup({ window: this.mainWindow });
    });
  }

  createView(tabConfig) {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Use persistent session for cookies/auth
        session: this.getSession()
      }
    });

    this.views.set(tabConfig.id, { view, config: tabConfig });

    // Set up right-click context menu
    this.setupContextMenu(view);

    // Allow all in-page navigation
    view.webContents.on('will-navigate', (_event, _url) => {
      // No blocking
    });

    // Handle new windows (popups, target="_blank", OAuth flows)
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (this.isUrlAllowed(url, tabConfig.allowedOrigins)) {
        view.webContents.loadURL(url);
        return { action: 'deny' };
      }

      this.openAuthWindow(url, tabConfig);
      return { action: 'deny' };
    });

    view.webContents.on('did-start-loading', () => {
      this.sendToRenderer('tab-updated', { tabId: tabConfig.id, isLoading: true });
    });

    view.webContents.on('did-stop-loading', () => {
      this.sendToRenderer('tab-updated', { tabId: tabConfig.id, isLoading: false });
    });

    view.webContents.on('page-title-updated', (_event, title) => {
      this.sendToRenderer('tab-updated', { tabId: tabConfig.id, title });
    });

    view.webContents.on('page-favicon-updated', (_event, favicons) => {
      if (favicons && favicons.length > 0) {
        this.sendToRenderer('tab-updated', { tabId: tabConfig.id, favicon: favicons[0] });
      }
    });

    view.webContents.loadURL(tabConfig.url);
    return view;
  }

  openAuthWindow(url, tabConfig) {
    const parentBounds = this.mainWindow.getBounds();
    const authWin = new BrowserWindow({
      width: Math.min(500, parentBounds.width - 100),
      height: Math.min(700, parentBounds.height - 100),
      x: parentBounds.x + 50,
      y: parentBounds.y + 50,
      parent: this.mainWindow,
      modal: false,
      show: true,
      title: 'Sign In',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Share the same persistent session so auth cookies carry over
        session: this.getSession()
      }
    });

    this.authWindows.add(authWin);

    authWin.webContents.on('will-navigate', (_event, navUrl) => {
      if (this.isUrlAllowed(navUrl, tabConfig.allowedOrigins)) {
        const entry = this.views.get(tabConfig.id);
        if (entry) {
          entry.view.webContents.loadURL(navUrl);
        }
        authWin.close();
      }
    });

    authWin.webContents.on('did-navigate', (_event, navUrl) => {
      if (this.isUrlAllowed(navUrl, tabConfig.allowedOrigins)) {
        const entry = this.views.get(tabConfig.id);
        if (entry) {
          entry.view.webContents.loadURL(navUrl);
        }
        authWin.close();
      }
    });

    authWin.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      authWin.webContents.loadURL(popupUrl);
      return { action: 'deny' };
    });

    authWin.on('closed', () => {
      this.authWindows.delete(authWin);
    });

    authWin.loadURL(url);
  }

  loadTabs(tabs) {
    this.tabOrder = tabs.map(t => t.id);
    for (const tab of tabs) {
      const view = this.createView(tab);
      this.mainWindow.addBrowserView(view);
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }

    if (tabs.length > 0) {
      this.activeTabId = tabs[0].id;
      this.layoutViews();
    }
  }

  switchTo(tabId) {
    const entry = this.views.get(tabId);
    if (!entry) return;
    this.activeTabId = tabId;
    this.layoutViews();
  }

  /**
   * Compute split bounds for N views within a content area.
   */
  computeSplitBounds(content, count, mode) {
    const { x, y, width, height } = content;
    const gap = 1; // 1px gap between panes

    if (count <= 1 || mode === 'single') {
      return [{ x, y, width, height }];
    }

    if (mode === 'split-v') {
      // Side by side (vertical split = vertical divider)
      const paneW = Math.floor((width - gap * (count - 1)) / count);
      return Array.from({ length: count }, (_, i) => ({
        x: x + i * (paneW + gap),
        y,
        width: i === count - 1 ? width - i * (paneW + gap) : paneW,
        height,
      }));
    }

    if (mode === 'split-h') {
      // Stacked (horizontal split = horizontal divider)
      const paneH = Math.floor((height - gap * (count - 1)) / count);
      return Array.from({ length: count }, (_, i) => ({
        x,
        y: y + i * (paneH + gap),
        width,
        height: i === count - 1 ? height - i * (paneH + gap) : paneH,
      }));
    }

    if (mode === 'grid') {
      const cols = count <= 2 ? count : 2;
      const rows = Math.ceil(count / cols);
      const paneW = Math.floor((width - gap * (cols - 1)) / cols);
      const paneH = Math.floor((height - gap * (rows - 1)) / rows);
      return Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const isLastCol = col === cols - 1;
        const isLastRow = row === rows - 1;
        return {
          x: x + col * (paneW + gap),
          y: y + row * (paneH + gap),
          width: isLastCol ? width - col * (paneW + gap) : paneW,
          height: isLastRow ? height - row * (paneH + gap) : paneH,
        };
      });
    }

    // Fallback single
    return [{ x, y, width, height }];
  }

  /**
   * Master layout function — positions all views based on split mode.
   */
  layoutViews() {
    if (!this.mainWindow || this.views.size === 0) return;

    const content = this.getContentBounds();
    const hidden = { x: 0, y: 0, width: 0, height: 0 };

    if (this.splitMode === 'single') {
      // Single mode: only active view visible
      for (const [id, { view }] of this.views) {
        if (id === this.activeTabId) {
          this.mainWindow.setTopBrowserView(view);
          view.setBounds(content);
        } else {
          view.setBounds(hidden);
        }
      }
      return;
    }

    // Split mode: show all tabs
    const tabIds = this.tabOrder.filter(id => this.views.has(id));
    const bounds = this.computeSplitBounds(content, tabIds.length, this.splitMode);

    for (const [id, { view }] of this.views) {
      const idx = tabIds.indexOf(id);
      if (idx >= 0 && idx < bounds.length) {
        view.setBounds(bounds[idx]);
      } else {
        view.setBounds(hidden);
      }
    }
  }

  reloadActiveTab() {
    if (!this.activeTabId) return;
    const entry = this.views.get(this.activeTabId);
    if (entry) {
      entry.view.webContents.reload();
    }
  }

  reloadTab(tabId) {
    const entry = this.views.get(tabId);
    if (entry) {
      entry.view.webContents.reload();
    }
  }

  isUrlAllowed(url, allowedOrigins) {
    try {
      const urlObj = new URL(url);
      return allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          if (allowedUrl.origin === urlObj.origin) return true;
          if (allowedUrl.hostname.startsWith('*.')) {
            const domain = allowedUrl.hostname.slice(2);
            return urlObj.protocol === allowedUrl.protocol &&
                   urlObj.hostname.endsWith(domain);
          }
          return false;
        } catch { return false; }
      });
    } catch { return false; }
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  hideActive() {
    const hidden = { x: 0, y: 0, width: 0, height: 0 };
    for (const { view } of this.views.values()) {
      view.setBounds(hidden);
    }
  }

  showActive() {
    this.layoutViews();
  }

  destroy() {
    for (const win of this.authWindows) {
      if (!win.isDestroyed()) win.close();
    }
    this.authWindows.clear();

    for (const { view } of this.views.values()) {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.removeBrowserView(view);
      }
      view.webContents.close();
    }
    this.views.clear();
    this.activeTabId = null;
  }
}

module.exports = { browserManager: new BrowserManager() };
