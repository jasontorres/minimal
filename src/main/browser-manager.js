/**
 * Manages BrowserViews for each tab, positioned with pixel-based bounds.
 */

const { BrowserView, BrowserWindow, Menu, shell, session } = require('electron');

const TITLE_BAR_HEIGHT = 32;
const PANE_HEADER_HEIGHT = 26;
const PANE_GAP = 2;

const TAB_TOP_SIZES = { small: 28, medium: 36, large: 44 };
const TAB_LEFT_SIZES = { small: 120, medium: 160, large: 200 };
const TAB_LEFT_ICON_ONLY_SIZES = { small: 36, medium: 44, large: 52 };

/**
 * Layout templates — Windows 11 snap-style fixed slot definitions.
 * Each slot is { x, y, w, h } as fractions of the content area (0..1).
 */
const LAYOUT_TEMPLATES = [
  // 1 pane
  { id: 'single', label: 'Single', slots: [
    { x: 0, y: 0, w: 1, h: 1 }
  ]},
  // 2 panes
  { id: 'half-v', label: '1/2 + 1/2', slots: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ]},
  { id: 'half-h', label: 'Top + Bottom', slots: [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ]},
  { id: 'left-wide', label: '2/3 + 1/3', slots: [
    { x: 0, y: 0, w: 2/3, h: 1 },
    { x: 2/3, y: 0, w: 1/3, h: 1 },
  ]},
  { id: 'right-wide', label: '1/3 + 2/3', slots: [
    { x: 0, y: 0, w: 1/3, h: 1 },
    { x: 1/3, y: 0, w: 2/3, h: 1 },
  ]},
  // 3 panes
  { id: 'thirds-v', label: '3 Columns', slots: [
    { x: 0, y: 0, w: 1/3, h: 1 },
    { x: 1/3, y: 0, w: 1/3, h: 1 },
    { x: 2/3, y: 0, w: 1/3, h: 1 },
  ]},
  { id: 'left-right-split', label: 'Left + Right Split', slots: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ]},
  { id: 'right-left-split', label: 'Left Split + Right', slots: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ]},
  // 4 panes
  { id: 'grid-2x2', label: '2x2 Grid', slots: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ]},
];

// Default template to use when auto-relayouting after pane close
const AUTO_LAYOUT_DEFAULTS = {
  1: 'single',
  2: 'half-v',
  3: 'thirds-v',
  4: 'grid-2x2',
};

// Map legacy split modes to template IDs
const LEGACY_MODE_MAP = {
  'single': 'single',
  'split-v': 'half-v',
  'split-h': 'half-h',
  'grid': 'grid-2x2',
};

// Reverse map: template ID to legacy split mode (for backward compat)
const TEMPLATE_TO_LEGACY = {};
for (const [legacy, tmpl] of Object.entries(LEGACY_MODE_MAP)) {
  TEMPLATE_TO_LEGACY[tmpl] = legacy;
}

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
    this.layoutTemplateId = 'single';
    this.tabOrder = []; // ordered list of tab IDs for layout
    this.pinnedTabs = new Set();
    this.closedPanes = new Set();
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

  // Legacy compat: setSplitMode maps old mode names to templates
  setSplitMode(mode) {
    const templateId = LEGACY_MODE_MAP[mode] || mode;
    this.setLayoutTemplate(templateId);
  }

  // Legacy compat: getSplitMode returns old-style mode name
  getSplitMode() {
    return TEMPLATE_TO_LEGACY[this.layoutTemplateId] || this.layoutTemplateId;
  }

  setLayoutTemplate(templateId) {
    const tmpl = LAYOUT_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    this.layoutTemplateId = templateId;
    this.closedPanes.clear();
    this.layoutViews();
  }

  getLayoutTemplateId() {
    return this.layoutTemplateId;
  }

  getLayoutTemplates() {
    return LAYOUT_TEMPLATES;
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
        backgroundThrottling: false,
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
   * Compute bounds for views based on a layout template.
   * Each slot's fractional coords are converted to pixel bounds within the content area.
   * Returns array of { full, view } for each slot, where view leaves room for the header.
   */
  computeTemplateBounds(content, template, count) {
    const { x, y, width, height } = content;
    const isSingle = template.id === 'single' || count <= 1;
    const headerH = isSingle ? 0 : PANE_HEADER_HEIGHT;
    const gap = isSingle ? 0 : PANE_GAP;
    const slotCount = Math.min(template.slots.length, count);

    if (isSingle) {
      return [{ full: { x, y, width, height }, view: { x, y, width, height } }];
    }

    return template.slots.slice(0, slotCount).map(slot => {
      // Convert fractional to pixel, accounting for gaps between adjacent slots
      const px = Math.round(x + slot.x * width + (slot.x > 0 ? gap / 2 : 0));
      const py = Math.round(y + slot.y * height + (slot.y > 0 ? gap / 2 : 0));
      const pr = Math.round(x + (slot.x + slot.w) * width - (slot.x + slot.w < 1 ? gap / 2 : 0));
      const pb = Math.round(y + (slot.y + slot.h) * height - (slot.y + slot.h < 1 ? gap / 2 : 0));
      const pw = pr - px;
      const ph = pb - py;

      return {
        full: { x: px, y: py, width: pw, height: ph },
        view: { x: px, y: py + headerH, width: pw, height: ph - headerH },
      };
    });
  }

  /**
   * Close a pane from split view (hide it, don't delete the tab).
   * Auto-relayouts remaining panes with the best fitting template.
   */
  closePane(tabId) {
    this.closedPanes.add(tabId);
    this.pinnedTabs.delete(tabId);

    const visibleTabs = this.getVisibleTabIds();
    const count = visibleTabs.length;

    if (count <= 1) {
      // Switch to single if 0 or 1 remain
      this.layoutTemplateId = 'single';
      this.closedPanes.clear();
      if (count === 1) {
        this.activeTabId = visibleTabs[0];
        this.sendToRenderer('tab-switched', { tabId: visibleTabs[0] });
      }
    } else {
      // Auto-pick best template for remaining count
      const currentTemplate = LAYOUT_TEMPLATES.find(t => t.id === this.layoutTemplateId);
      if (!currentTemplate || currentTemplate.slots.length !== count) {
        // Find a template that fits the remaining count
        const defaultId = AUTO_LAYOUT_DEFAULTS[count];
        if (defaultId) {
          this.layoutTemplateId = defaultId;
        } else {
          // Fallback: find any template with the right slot count
          const match = LAYOUT_TEMPLATES.find(t => t.slots.length === count);
          if (match) this.layoutTemplateId = match.id;
        }
      }
    }

    this.layoutViews();
    // Notify renderer of the new template
    this.sendToRenderer('layout-template-changed', { templateId: this.layoutTemplateId });
  }

  /**
   * Toggle pin state for a pane
   */
  togglePinPane(tabId) {
    if (this.pinnedTabs.has(tabId)) {
      this.pinnedTabs.delete(tabId);
    } else {
      this.pinnedTabs.add(tabId);
    }
    this.layoutViews();
  }

  /**
   * Swap two panes' positions in the tab order
   */
  swapPanes(tabIdA, tabIdB) {
    const idxA = this.tabOrder.indexOf(tabIdA);
    const idxB = this.tabOrder.indexOf(tabIdB);
    if (idxA < 0 || idxB < 0) return;
    this.tabOrder[idxA] = tabIdB;
    this.tabOrder[idxB] = tabIdA;
    this.layoutViews();
  }

  /**
   * Get visible tab IDs for current split layout
   */
  getVisibleTabIds() {
    return this.tabOrder.filter(id => this.views.has(id) && !this.closedPanes.has(id));
  }

  /**
   * Master layout function — positions all views based on the active template.
   */
  layoutViews() {
    if (!this.mainWindow || this.views.size === 0) return;

    const content = this.getContentBounds();
    const hidden = { x: 0, y: 0, width: 0, height: 0 };
    const template = LAYOUT_TEMPLATES.find(t => t.id === this.layoutTemplateId) || LAYOUT_TEMPLATES[0];

    if (template.id === 'single') {
      // Single mode: only active view visible
      for (const [id, { view }] of this.views) {
        if (id === this.activeTabId) {
          this.mainWindow.setTopBrowserView(view);
          view.setBounds(content);
        } else {
          view.setBounds(hidden);
        }
      }
      this.sendToRenderer('pane-layout', { panes: [], splitMode: 'single', templateId: 'single' });
      return;
    }

    // Split mode: show visible tabs up to template slot count
    const tabIds = this.getVisibleTabIds();
    const slotCount = Math.min(template.slots.length, tabIds.length);
    const bounds = this.computeTemplateBounds(content, template, slotCount);

    const paneInfos = [];

    for (const [id, { view, config }] of this.views) {
      const idx = tabIds.indexOf(id);
      if (idx >= 0 && idx < slotCount) {
        view.setBounds(bounds[idx].view);
        paneInfos.push({
          tabId: id,
          title: config.title,
          isPinned: this.pinnedTabs.has(id),
          slotIndex: idx,
          headerBounds: {
            x: bounds[idx].full.x,
            y: bounds[idx].full.y,
            width: bounds[idx].full.width,
            height: PANE_HEADER_HEIGHT,
          },
        });
      } else {
        view.setBounds(hidden);
      }
    }

    const legacyMode = TEMPLATE_TO_LEGACY[this.layoutTemplateId] || this.layoutTemplateId;
    this.sendToRenderer('pane-layout', {
      panes: paneInfos,
      splitMode: legacyMode,
      templateId: this.layoutTemplateId,
    });
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
