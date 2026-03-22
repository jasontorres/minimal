/**
 * Renderer process - Tab bar UI with webview support
 */

interface Tab {
  id: string;
  title: string;
  url: string;
  icon?: string;
  allowedOrigins: string[];
}

interface TabState {
  tabId: string;
  url?: string;
  title?: string;
  isLoading?: boolean;
}

class TabBar {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabsContainer: HTMLElement;
  private tabBar: HTMLElement;
  private browserContainer: HTMLElement;
  private webView: HTMLElement | null = null;
  private placeholder: HTMLElement;
  private notification: HTMLElement;
  private notificationTimeout: number | null = null;
  private initialized = false;
  private config: any = null;
  private webviewCache: Map<string, HTMLElement> = new Map();

  constructor() {
    this.tabsContainer = document.getElementById('tabsContainer')!;
    this.tabBar = document.querySelector('.tab-bar')!;
    this.browserContainer = document.getElementById('browserContainer')!;
    this.placeholder = document.getElementById('placeholder')!;
    this.notification = document.getElementById('notification')!;

    if (!this.initialized) {
      this.setupEventListeners();
      this.setupSettingsButton();
      this.setupTitleBarButtons();
      this.initialized = true;
    }
  }

  /**
   * Set up electron API event listeners
   */
  private setupEventListeners(): void {
    const api = (window as any).electronAPI;

    // Initial config load - only register once
    api.onConfigLoaded((data: { tabs: Tab[]; activeTabId: string; config?: any }) => {
      if (data.config) {
        this.config = data.config;
        this.applyTabBarPosition();
      }
      if (this.tabs.size === 0) {
        this.setTabs(data.tabs, data.activeTabId);
      }
    });

    // Tab updates (URL changes, loading state, etc.)
    api.onTabUpdated((data: TabState) => {
      requestAnimationFrame(() => {
        this.updateTabState(data);
      });
    });

    // Navigation blocked notification
    api.onNavigationBlocked((data: { tabId: string; url: string; reason: string }) => {
      this.showNotification(
        `Navigation blocked: ${this.getTruncatedUrl(data.url)}`
      );
    });

    // Request initial config (if needed)
    if (this.tabs.size === 0) {
      api.getConfig().then((config: any) => {
        this.config = config;
        const profile = config.profiles.find(
          (p: any) => p.id === config.activeProfileId
        ) || config.profiles[0];
        this.applyTabBarPosition();
        if (profile && this.tabs.size === 0) {
          this.setTabs(profile.tabs, profile.tabs[0]?.id || null);
        }
      });
    }

    // Keyboard shortcut for opening config (Ctrl+,)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        api.openConfig().then(() => {
          // Config opened successfully
        }).catch(() => {
          this.showNotification('Failed to open config file');
        });
      }
    });
  }

  /**
   * Apply tab bar position based on config
   */
  private applyTabBarPosition(): void {
    if (!this.config) return;

    const profile = this.config.profiles.find(
      (p: any) => p.id === this.config.activeProfileId
    ) || this.config.profiles[0];

    const position = profile?.tabBarPosition || 'top';

    // Remove existing position classes
    this.tabBar.classList.remove('position-left', 'position-right');

    // Add position class if not top (top is default)
    if (position === 'left') {
      this.tabBar.classList.add('position-left');
    } else if (position === 'right') {
      this.tabBar.classList.add('position-right');
    }
  }

  /**
   * Set up settings button click handler
   */
  private setupSettingsButton(): void {
    const settingsButton = document.getElementById('settingsButton');
    if (!settingsButton) return;

    settingsButton.addEventListener('click', async () => {
      const api = (window as any).electronAPI;
      try {
        const result = await api.openConfig();
        if (result && !result.success) {
          this.showNotification('Failed to open config file');
        }
      } catch (err) {
        console.error('Failed to open config:', err);
        this.showNotification('Failed to open config file');
      }
    });
  }

  /**
   * Set up title bar button click handlers
   */
  private setupTitleBarButtons(): void {
    const api = (window as any).electronAPI;

    const minimizeButton = document.getElementById('minimizeButton');
    const maximizeButton = document.getElementById('maximizeButton');
    const closeButton = document.getElementById('closeButton');

    if (minimizeButton) {
      minimizeButton.addEventListener('click', () => api.minimizeWindow());
    }

    if (maximizeButton) {
      maximizeButton.addEventListener('click', () => {
        api.maximizeWindow();
        this.updateMaximizeButton();
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', () => api.closeWindow());
    }
  }

  /**
   * Update maximize button icon based on window state
   */
  private updateMaximizeButton(): void {
    const maximizeButton = document.getElementById('maximizeButton');
    if (!maximizeButton) return;

    // Toggle between maximize and restore icons
    const isMaximized = maximizeButton.getAttribute('data-maximized') === 'true';
    if (isMaximized) {
      maximizeButton.setAttribute('data-maximized', 'false');
      maximizeButton.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
      `;
    } else {
      maximizeButton.setAttribute('data-maximized', 'true');
      maximizeButton.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
      `;
    }
  }

  /**
   * Set tabs from config
   */
  private setTabs(tabs: Tab[], activeTabId: string | null): void {
    this.tabs.clear();
    this.webviewCache.clear();
    this.tabsContainer.innerHTML = '';

    for (const tab of tabs) {
      this.tabs.set(tab.id, tab);
      this.renderTab(tab);
      // Create a cached webview for this tab
      this.createWebView(tab);
    }

    this.setActiveTab(activeTabId);
  }

  /**
   * Create a webview element for a tab
   */
  private createWebView(tab: Tab): HTMLElement {
    // Check if we already have a webview for this tab
    if (this.webviewCache.has(tab.id)) {
      return this.webviewCache.get(tab.id)!;
    }

    const webview = document.createElement('webview');
    webview.className = 'webview';
    webview.id = `webview-${tab.id}`;
    webview.src = tab.url;
    webview.style.display = 'none';

    // Set webview attributes for security
    webview.setAttribute('disablewebsecurity', '');
    webview.setAttribute('nodeintegration', 'false');
    webview.setAttribute('contextisolation', 'true');

    // Listen for navigation events to enforce allow-list
    webview.addEventListener('will-navigate', (e: any) => {
      const url = e.url;
      if (!this.isUrlAllowed(url, tab.allowedOrigins)) {
        e.preventDefault();
        this.showNotification(`Navigation blocked: ${this.getTruncatedUrl(url)}`);
        // Ask main process to open in external browser
        const api = (window as any).electronAPI;
        api.openExternal(url);
      }
    });

    webview.addEventListener('new-window', (e: any) => {
      const url = e.url;
      if (!this.isUrlAllowed(url, tab.allowedOrigins)) {
        e.preventDefault();
        this.showNotification(`Opening in external browser: ${this.getTruncatedUrl(url)}`);
        const api = (window as any).electronAPI;
        api.openExternal(url);
      }
    });

    webview.addEventListener('did-start-loading', () => {
      const tabEl = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
      if (tabEl) {
        tabEl.classList.add('loading');
      }
    });

    webview.addEventListener('did-stop-loading', () => {
      const tabEl = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
      if (tabEl) {
        tabEl.classList.remove('loading');
      }
    });

    webview.addEventListener('page-title-updated', (e: any) => {
      const titleEl = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"] .tab-title`);
      if (titleEl) {
        titleEl.textContent = e.title;
        titleEl.title = e.title;
      }
    });

    webview.addEventListener('did-fail-load', (e: any) => {
      console.error('Failed to load:', e.errorDescription);
    });

    this.browserContainer.appendChild(webview);
    this.webviewCache.set(tab.id, webview);

    return webview;
  }

  /**
   * Check if a URL is in the allow-list
   */
  private isUrlAllowed(url: string, allowedOrigins: string[]): boolean {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;

      return allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          if (allowedUrl.origin === origin) return true;
          if (allowedUrl.hostname.startsWith('*.')) {
            const domain = allowedUrl.hostname.slice(2);
            return (
              urlObj.protocol === allowedUrl.protocol &&
              urlObj.hostname.endsWith(domain)
            );
          }
          return false;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Render a single tab
   */
  private renderTab(tab: Tab): void {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.tabId = tab.id;
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-selected', 'false');

    // Icon or favicon
    if (tab.icon) {
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = tab.icon;
      tabEl.appendChild(icon);
    } else {
      const favicon = document.createElement('img');
      favicon.className = 'tab-favicon';
      favicon.alt = '';
      favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white"><circle cx="8" cy="8" r="6"/></svg>';
      tabEl.appendChild(favicon);
    }

    // Title
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    title.title = tab.title;
    tabEl.appendChild(title);

    // Click handler
    tabEl.addEventListener('click', () => {
      this.switchTab(tab.id);
    });

    this.tabsContainer.appendChild(tabEl);
  }

  /**
   * Update tab state (URL, loading, title)
   */
  private updateTabState(state: TabState): void {
    const tabEl = this.tabsContainer.querySelector(
      `[data-tab-id="${state.tabId}"]`
    ) as HTMLElement;

    if (!tabEl) return;

    // Update loading state
    if (state.isLoading !== undefined) {
      tabEl.classList.toggle('loading', state.isLoading);
    }

    // Update title if changed
    if (state.title !== undefined) {
      const titleEl = tabEl.querySelector('.tab-title');
      if (titleEl) {
        titleEl.textContent = state.title;
        titleEl.title = state.title;
      }
    }

    // Update favicon if URL changed
    if (state.url !== undefined) {
      const tab = this.tabs.get(state.tabId);
      if (tab && !tab.icon) {
        const favicon = tabEl.querySelector('.tab-favicon') as HTMLImageElement;
        if (favicon && !state.url.startsWith('about:blank')) {
          try {
            const url = new URL(state.url);
            favicon.src = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
          } catch {
            // Invalid URL
          }
        }
      }
    }
  }

  /**
   * Set the active tab
   */
  private setActiveTab(tabId: string | null): void {
    if (this.activeTabId === tabId) return;
    this.activeTabId = tabId;

    // Update all tab elements
    const tabs = this.tabsContainer.querySelectorAll('.tab');
    tabs.forEach((tab) => {
      if (tab.dataset.tabId === tabId) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    // Show/hide webviews
    this.showWebView(tabId);
  }

  /**
   * Show the webview for the active tab
   */
  private showWebView(tabId: string | null): void {
    // Hide all webviews
    this.webviewCache.forEach((webview) => {
      webview.style.display = 'none';
    });

    if (!tabId || !this.webviewCache.has(tabId)) {
      this.placeholder.style.display = 'flex';
      return;
    }

    const webview = this.webviewCache.get(tabId);
    if (webview) {
      webview.style.display = 'block';
      this.placeholder.style.display = 'none';
    }
  }

  /**
   * Switch to a tab
   */
  private switchTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;

    // Notify main process about tab switch
    const api = (window as any).electronAPI;
    api.switchTab(tabId);

    this.setActiveTab(tabId);
  }

  /**
   * Show a temporary notification
   */
  private showNotification(message: string): void {
    this.notification.textContent = message;
    this.notification.classList.remove('hidden');

    if (this.notificationTimeout) {
      window.clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = window.setTimeout(() => {
      this.notification.classList.add('hidden');
    }, 3000);
  }

  /**
   * Get truncated URL for display
   */
  private getTruncatedUrl(url: string): string {
    if (url.length <= 50) return url;
    return url.slice(0, 47) + '...';
  }
}

// Initialize only once
let tabBarInstance: TabBar | null = null;

function initTabBar() {
  if (!tabBarInstance) {
    tabBarInstance = new TabBar();
  }
  return tabBarInstance;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabBar);
} else {
  initTabBar();
}
