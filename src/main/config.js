/**
 * Simple configuration store using JSON files
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigStore {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    console.log('Config file location:', this.configPath);

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load or create config
    if (fs.existsSync(this.configPath)) {
      try {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        console.log('Config file exists, reading...');
        console.log('Raw config data:', data);
        this.config = JSON.parse(data);
        console.log('Parsed config:', JSON.stringify(this.config, null, 2));
      } catch (e) {
        console.error('Failed to load config, using defaults', e);
        this.config = this.createDefaultConfig();
      }
    } else {
      console.log('Config file does not exist, creating default');
      this.config = this.createDefaultConfig();
      this.save();
    }
  }

  createDefaultConfig() {
    return {
      activeProfileId: 'default',
      darkMode: false,
      profiles: [
        {
          id: 'default',
          name: 'Default',
          tabBarPosition: 'top',  // 'top' or 'left'
          tabDisplayMode: 'full', // 'full', 'icon-only'
          tabSize: 'medium',      // 'small', 'medium', 'large'
          tabs: [
            {
              id: 'example-1',
              title: 'Example',
              url: 'https://example.com',
              allowedOrigins: ['https://example.com'],
              icon: '🌐'
              // appIcon: '/path/to/icon.png'  — optional custom icon image
            }
          ]
        }
      ]
    };
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getConfig() {
    return this.config;
  }

  getActiveProfile() {
    return (
      this.config.profiles.find((p) => p.id === this.config.activeProfileId) ||
      this.config.profiles[0]
    );
  }

  getTabConfig(tabId) {
    const profile = this.getActiveProfile();
    return profile.tabs.find((t) => t.id === tabId);
  }

  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  replaceConfig(newConfig) {
    // Preserve windowState from current config
    newConfig.windowState = this.config.windowState;
    this.config = newConfig;
    this.save();
  }

  updateTabUrl(tabId, url) {
    const profile = this.config.profiles.find(
      (p) => p.id === this.config.activeProfileId
    );
    if (profile) {
      const tab = profile.tabs.find((t) => t.id === tabId);
      if (tab) {
        tab.url = url;
        this.save();
      }
    }
  }

  saveWindowState(bounds) {
    this.config.windowState = bounds;
    this.save();
  }

  getWindowState() {
    return this.config.windowState;
  }
}

module.exports = { configStore: new ConfigStore() };
