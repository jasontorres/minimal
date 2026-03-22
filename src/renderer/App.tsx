import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import TabBar from './components/TabBar';
import Settings from './components/Settings';
import type { TabConfig, ProfileConfig, AppConfig, TabUpdateData } from './types';

const api = window.electronAPI;

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [tabs, setTabs] = useState<TabConfig[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'appearance' | 'tabs' | 'advanced' | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);
  const [tabStates, setTabStates] = useState<Map<string, { isLoading?: boolean; title?: string; favicon?: string }>>(new Map());

  // Load dark mode
  useEffect(() => {
    api.getDarkMode().then(setIsDark);
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Load config
  useEffect(() => {
    api.getConfig().then((config: AppConfig) => {
      const p = config.profiles.find(pr => pr.id === config.activeProfileId) || config.profiles[0];
      setProfile(p);
      setTabs(p.tabs);
      if (p.tabs.length > 0 && !activeTabId) {
        setActiveTabId(p.tabs[0].id);
      }
      api.setTabBarPosition(p.tabBarPosition || 'top');
      api.setTabDisplayMode(p.tabDisplayMode || 'full');
      api.setTabSize(p.tabSize || 'medium');
    });
  }, []);

  // Listen for config-loaded from main process
  useEffect(() => {
    api.onConfigLoaded((data) => {
      if (data.config) {
        const p = data.config.profiles.find(pr => pr.id === data.config!.activeProfileId) || data.config.profiles[0];
        setProfile(p);
        setIsDark(data.config.darkMode || false);
      }
      setTabs(data.tabs);
      if (data.activeTabId) {
        setActiveTabId(data.activeTabId);
      }
    });

    api.onTabUpdated((data: TabUpdateData) => {
      setTabStates(prev => {
        const next = new Map(prev);
        const existing = next.get(data.tabId) || {};
        next.set(data.tabId, { ...existing, ...data });
        return next;
      });
    });

    api.onNavigationBlocked((data) => {
      const truncated = data.url.length > 50 ? data.url.slice(0, 47) + '...' : data.url;
      showNotification(`Navigation blocked: ${truncated}`);
    });

    // Main process switched tab via keyboard shortcut
    api.onTabSwitched((data) => {
      setActiveTabId(data.tabId);
    });
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  function switchTab(id: string) {
    setActiveTabId(id);
    api.switchTab(id);
  }

  async function toggleDarkMode() {
    const dark = await api.toggleDarkMode();
    setIsDark(dark);
  }

  function openSettings(tab?: 'appearance' | 'tabs' | 'advanced') {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
    api.hideViews();
  }

  function closeSettings() {
    setSettingsOpen(false);
    setSettingsInitialTab(undefined);
    api.showViews();
  }

  function handleAddTab() {
    openSettings('tabs');
  }

  const position = profile?.tabBarPosition || 'top';
  const displayMode = profile?.tabDisplayMode || 'full';
  const size = profile?.tabSize || 'medium';

  return (
    <div className="app">
      <TitleBar
        isDark={isDark}
        tabCount={tabs.length}
        onToggleDarkMode={toggleDarkMode}
        onOpenSettings={openSettings}
      />

      <div className={`main-content ${position === 'left' ? 'tabs-left' : ''}`}>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          position={position}
          displayMode={displayMode}
          size={size}
          tabStates={tabStates}
          onSwitchTab={switchTab}
          onAddTab={handleAddTab}
        />

        <div className="browser-container">
          {tabs.length === 0 && (
            <div className="placeholder">No tabs configured. Click + to add one.</div>
          )}

          {settingsOpen && <Settings onClose={closeSettings} initialTab={settingsInitialTab} />}
        </div>
      </div>

      {notification && <div className="notification">{notification}</div>}
    </div>
  );
}
