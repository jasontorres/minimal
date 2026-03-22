/**
 * Simple Tab Manager for Minimal Browser
 */

const api = window.electronAPI;

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this.webviews = new Map();
    this.faviconCache = new Map();

    this.init();
  }

  /**
   * Get favicon URL for a URL
   * Uses multiple strategies to find the best favicon
   */
  async getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Check cache first
      if (this.faviconCache.has(domain)) {
        return this.faviconCache.get(domain);
      }

      // Try to fetch actual favicon from the page
      const faviconUrl = await this.fetchPageFavicon(url);
      if (faviconUrl) {
        this.faviconCache.set(domain, faviconUrl);
        return faviconUrl;
      }

      // Fall back to Google's favicon service
      const fallbackUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      this.faviconCache.set(domain, fallbackUrl);
      return fallbackUrl;
    } catch (e) {
      console.error('Error getting favicon:', e);
      return null;
    }
  }

  /**
   * Try to fetch the actual favicon from the page
   */
  async fetchPageFavicon(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Common favicon paths to try
      const faviconPaths = [
        '/favicon.ico',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png',
        '/favicon.png',
        '/icon.png',
        '/android-chrome-192x192.png',
        '/icon-192.png',
      ];

      // Try each path
      for (const path of faviconPaths) {
        try {
          const faviconUrl = `${urlObj.origin}${path}`;
          const response = await fetch(faviconUrl, { method: 'HEAD' });
          if (response.ok) {
            return faviconUrl;
          }
        } catch (e) {
          // Continue to next path
        }
      }

      return null;
    } catch (e) {
      console.error('Error fetching page favicon:', e);
      return null;
    }
  }

  init() {
    console.log('TabManager initializing...');

    // Setup UI elements
    this.tabsContainer = document.getElementById('tabsContainer');
    this.browserContainer = document.getElementById('browserContainer');
    this.placeholder = document.getElementById('placeholder');
    this.notification = document.getElementById('notification');

    // Setup controls
    this.setupWindowControls();
    this.setupSettingsButton();

    // Listen for config
    this.setupConfigListener();

    // Request config if needed
    this.requestConfig();

    console.log('TabManager initialized');
  }

  setupWindowControls() {
    document.getElementById('minimizeButton').addEventListener('click', () => {
      api.minimizeWindow();
    });

    document.getElementById('maximizeButton').addEventListener('click', () => {
      api.maximizeWindow();
    });

    document.getElementById('closeButton').addEventListener('click', () => {
      api.closeWindow();
    });
  }

  setupSettingsButton() {
    document.getElementById('settingsButton').addEventListener('click', () => {
      api.openConfig();
    });
  }

  setupConfigListener() {
    api.onConfigLoaded((data) => {
      console.log('Config loaded:', data);
      this.handleConfig(data);
    });
  }

  async requestConfig() {
    try {
      const config = await api.getConfig();
      console.log('Got config:', config);
      if (config && config.profiles) {
        const profile = config.profiles.find(p => p.id === config.activeProfileId) || config.profiles[0];
        if (profile && profile.tabs) {
          this.handleConfig({
            tabs: profile.tabs,
            activeTabId: profile.tabs[0]?.id
          });
        }
      }
    } catch (err) {
      console.error('Failed to get config:', err);
      this.placeholder.textContent = 'Error loading configuration';
    }
  }

  async handleConfig(data) {
    if (!data.tabs || data.tabs.length === 0) {
      this.placeholder.textContent = 'No tabs configured';
      return;
    }

    // Clear existing
    this.tabsContainer.innerHTML = '';
    this.tabs.clear();
    this.webviews.clear();

    // Remove existing webviews
    const existingWebviews = this.browserContainer.querySelectorAll('webview');
    existingWebviews.forEach(wv => wv.remove());

    // Create tabs (await since createTab is now async)
    for (const tab of data.tabs) {
      await this.createTab(tab);
    }

    // Activate first tab
    const activeId = data.activeTabId || data.tabs[0].id;
    this.activateTab(activeId);
  }

  async createTab(tabConfig) {
    // Create tab button
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.tabId = tabConfig.id;

    // Get favicon URL
    const faviconUrl = await this.getFaviconUrl(tabConfig.url);

    // Create icon element
    const iconEl = document.createElement('span');
    iconEl.className = 'tab-icon';

    if (faviconUrl) {
      const img = document.createElement('img');
      img.src = faviconUrl;
      img.className = 'tab-favicon';
      img.onerror = () => {
        // Fall back to emoji if image fails
        img.style.display = 'none';
        iconEl.textContent = tabConfig.icon || '🌐';
      };
      iconEl.appendChild(img);
    } else {
      iconEl.textContent = tabConfig.icon || '🌐';
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tabConfig.title;

    tabEl.appendChild(iconEl);
    tabEl.appendChild(titleEl);

    tabEl.addEventListener('click', () => {
      this.activateTab(tabConfig.id);
    });

    this.tabsContainer.appendChild(tabEl);
    this.tabs.set(tabConfig.id, tabConfig);

    // Create webview
    const webview = document.createElement('webview');
    webview.className = 'webview';
    webview.id = `webview-${tabConfig.id}`;
    webview.src = tabConfig.url;
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('disablewebsecurity', '');  // Allow script injection

    // Listen for navigation events
    webview.addEventListener('did-start-loading', () => {
      console.log('Started loading:', tabConfig.id);
      const tab = this.tabsContainer.querySelector(`[data-tab-id="${tabConfig.id}"]`);
      if (tab) {
        tab.classList.add('loading');
        console.log('Added loading class to tab');
      }
    });

    webview.addEventListener('did-stop-loading', () => {
      console.log('Stopped loading:', tabConfig.id);
      const tab = this.tabsContainer.querySelector(`[data-tab-id="${tabConfig.id}"]`);
      if (tab) {
        tab.classList.remove('loading');
        console.log('Removed loading class from tab');
      }

      // Fix iframe height after page loads
      this.fixIframeHeight(webview);
    });

    webview.addEventListener('dom-ready', () => {
      console.log('DOM ready for webview:', tabConfig.id);
      // Fix iframe height when DOM is ready
      this.fixIframeHeight(webview);
    });

    webview.addEventListener('will-navigate', (e) => {
      this.checkNavigation(tabConfig, e.url);
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      this.checkNavigation(tabConfig, e.url);
    });

    webview.addEventListener('did-fail-load', (e) => {
      console.error('Failed to load:', e);
    });

    this.browserContainer.appendChild(webview);
    this.webviews.set(tabConfig.id, webview);
  }

  fixIframeHeight(webview) {
    try {
      // Execute script inside the webview to fix iframe height
      webview.executeJavaScript(`
        (function() {
          // Find and fix the iframe
          const iframes = document.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            iframe.style.height = '100%';
            iframe.style.flex = 'unset';
            iframe.style.minHeight = '100vh';
          });

          // Also fix html and body
          document.documentElement.style.height = '100%';
          document.body.style.height = '100%';
          document.body.style.margin = '0';
          document.body.style.overflow = 'hidden';

          return true;
        })();
      `).catch(err => console.log('Script execution failed:', err));
    } catch (e) {
      console.log('Failed to fix iframe height:', e);
    }
  }

  activateTab(tabId) {
    // Deactivate current
    if (this.activeTabId) {
      const currentTab = this.tabsContainer.querySelector(`[data-tab-id="${this.activeTabId}"]`);
      const currentWebview = this.webviews.get(this.activeTabId);
      if (currentTab) currentTab.classList.remove('active');
      if (currentWebview) currentWebview.classList.remove('active');
    }

    // Activate new
    const tab = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    const webview = this.webviews.get(tabId);

    if (tab && webview) {
      tab.classList.add('active');
      webview.classList.add('active');
      this.activeTabId = tabId;
      this.placeholder.style.display = 'none';
    }
  }

  checkNavigation(tabConfig, url) {
    const urlObj = new URL(url);
    const allowedOrigins = tabConfig.allowedOrigins || [];

    const isAllowed = allowedOrigins.some(origin => {
      const originObj = new URL(origin);
      return urlObj.origin === originObj.origin;
    });

    if (!isAllowed) {
      this.showNotification(`Navigation to ${url} is not allowed`);
      // Navigate back to the original URL
      const webview = this.webviews.get(tabConfig.id);
      if (webview) {
        webview.src = tabConfig.url;
      }
    }
  }

  showNotification(message) {
    this.notification.textContent = message;
    this.notification.classList.add('show');

    setTimeout(() => {
      this.notification.classList.remove('show');
    }, 3000);
  }
}

// Initialize when DOM is ready
let tabManager = null;

function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tabManager = new TabManager();
    });
  } else {
    tabManager = new TabManager();
  }
}

init();
