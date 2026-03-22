export interface TabConfig {
  id: string;
  title: string;
  url: string;
  icon?: string;
  appIcon?: string;
  allowedOrigins: string[];
}

export interface ProfileConfig {
  id: string;
  name: string;
  tabBarPosition: 'top' | 'left';
  tabDisplayMode: 'full' | 'icon-only';
  tabSize: 'small' | 'medium' | 'large';
  tabs: TabConfig[];
}

export interface AppConfig {
  activeProfileId: string;
  darkMode: boolean;
  profiles: ProfileConfig[];
  windowState?: any;
}

export type SplitMode = 'single' | 'split-v' | 'split-h' | 'grid';

export interface TabUpdateData {
  tabId: string;
  isLoading?: boolean;
  title?: string;
  favicon?: string;
}

export interface ElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  quitApp: () => void;
  switchTab: (tabId: string) => void;
  reloadTab: (tabId: string) => void;
  getConfig: () => Promise<AppConfig>;
  getConfigPath: () => Promise<string>;
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
  toggleDarkMode: () => Promise<boolean>;
  getDarkMode: () => Promise<boolean>;
  setTabBarPosition: (position: string) => void;
  setTabDisplayMode: (mode: string) => void;
  setTabSize: (size: string) => void;
  hideViews: () => void;
  showViews: () => void;
  setSplitMode: (mode: SplitMode) => void;
  getSplitMode: () => Promise<SplitMode>;
  toggleDevTools: () => void;
  reloadApp: () => void;
  openExternal: (url: string) => void;
  onConfigLoaded: (callback: (data: { tabs: TabConfig[]; activeTabId: string; config?: AppConfig }) => void) => void;
  onTabUpdated: (callback: (data: TabUpdateData) => void) => void;
  onNavigationBlocked: (callback: (data: { tabId: string; url: string; reason: string }) => void) => void;
  onTabSwitched: (callback: (data: { tabId: string }) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
