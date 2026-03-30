import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import TabBar from './components/TabBar';
import PaneHeaders from './components/PaneHeaders';
import Settings from './components/Settings';
import type { TabConfig, ProfileConfig, AppConfig, TabUpdateData, PaneLayoutData } from './types';

const api = window.electronAPI;

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [tabs, setTabs] = useState<TabConfig[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'appearance' | 'tabs' | 'profiles' | 'advanced' | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);
  const [tabStates, setTabStates] = useState<Map<string, { isLoading?: boolean; title?: string; favicon?: string }>>(new Map());
  const [paneLayout, setPaneLayout] = useState<PaneLayoutData | null>(null);

  useEffect(() => { api.getDarkMode().then(setIsDark); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); }, [isDark]);

  // Load config
  useEffect(() => {
    api.getConfig().then((cfg: AppConfig) => {
      setConfig(cfg);
      const p = cfg.profiles.find(pr => pr.id === cfg.activeProfileId) || cfg.profiles[0];
      applyProfile(p);
    });
  }, []);

  function applyProfile(p: ProfileConfig) {
    setProfile(p);
    setTabs(p.tabs);
    setTabStates(new Map());
    if (p.tabs.length > 0) setActiveTabId(p.tabs[0].id);
    api.setTabBarPosition(p.tabBarPosition || 'top');
    api.setTabDisplayMode(p.tabDisplayMode || 'full');
    api.setTabSize(p.tabSize || 'medium');
  }

  // Listen for events from main process
  useEffect(() => {
    api.onConfigLoaded((data) => {
      if (data.config) {
        setConfig(data.config);
        const p = data.config.profiles.find(pr => pr.id === data.config!.activeProfileId) || data.config.profiles[0];
        applyProfile(p);
        setIsDark(data.config.darkMode || false);
      }
      setTabs(data.tabs);
      if (data.activeTabId) setActiveTabId(data.activeTabId);
    });

    api.onTabUpdated((data: TabUpdateData) => {
      setTabStates(prev => {
        const next = new Map(prev);
        next.set(data.tabId, { ...next.get(data.tabId), ...data });
        return next;
      });
    });

    api.onNavigationBlocked((data) => {
      showNotification(`Navigation blocked: ${data.url.length > 50 ? data.url.slice(0, 47) + '...' : data.url}`);
    });

    api.onTabSwitched((data) => setActiveTabId(data.tabId));

    api.onPaneLayout((data: PaneLayoutData) => setPaneLayout(data));
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  function switchTab(id: string) { setActiveTabId(id); api.switchTab(id); }
  async function toggleDarkMode() { setIsDark(await api.toggleDarkMode()); }

  function switchProfile(profileId: string) {
    if (profileId === config?.activeProfileId) return;
    api.switchProfile(profileId);
    // State will update via onConfigLoaded
  }

  function openSettings(tab?: 'appearance' | 'tabs' | 'profiles' | 'advanced') {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
    api.hideViews();
  }

  function closeSettings() {
    setSettingsOpen(false);
    setSettingsInitialTab(undefined);
    api.showViews();
  }

  const position = profile?.tabBarPosition || 'top';
  const displayMode = profile?.tabDisplayMode || 'full';
  const size = profile?.tabSize || 'medium';

  return (
    <div className="app">
      <TitleBar
        isDark={isDark}
        tabCount={tabs.length}
        profiles={config?.profiles || []}
        activeProfileId={config?.activeProfileId || ''}
        onToggleDarkMode={toggleDarkMode}
        onOpenSettings={openSettings}
        onSwitchProfile={switchProfile}
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
          onAddTab={() => openSettings('tabs')}
        />

        <div className="browser-container">
          {tabs.length === 0 && <div className="placeholder">No tabs configured. Click + to add one.</div>}
          {paneLayout && paneLayout.panes.length > 0 && (
            <PaneHeaders
              panes={paneLayout.panes}
              tabStates={tabStates}
            />
          )}
          {settingsOpen && <Settings onClose={closeSettings} initialTab={settingsInitialTab} />}
        </div>
      </div>

      {notification && <div className="notification">{notification}</div>}
    </div>
  );
}
