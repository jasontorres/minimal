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
  savedLayouts?: SavedLayout[];
  windowState?: any;
}

export type SplitMode = 'single' | 'split-v' | 'split-h' | 'grid';

export interface TabUpdateData {
  tabId: string;
  isLoading?: boolean;
  title?: string;
  favicon?: string;
}

export interface LayoutSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplate {
  id: string;
  label: string;
  slots: LayoutSlot[];
}

export interface PaneInfo {
  tabId: string;
  title: string;
  isPinned: boolean;
  slotIndex: number;
  headerBounds: { x: number; y: number; width: number; height: number };
}

export interface PaneLayoutData {
  panes: PaneInfo[];
  splitMode: string;
  templateId: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  templateId: string;
  splitMode: string;
  tabIds: string[];
  pinnedTabIds: string[];
}

export interface ElectronAPI {
  platform: string;
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
  switchProfile: (profileId: string) => void;
  setSplitMode: (mode: SplitMode) => void;
  getSplitMode: () => Promise<SplitMode>;
  setLayoutTemplate: (templateId: string) => void;
  getLayoutTemplateId: () => Promise<string>;
  getLayoutTemplates: () => Promise<LayoutTemplate[]>;
  closePane: (tabId: string) => void;
  togglePinPane: (tabId: string) => void;
  swapPanes: (tabIdA: string, tabIdB: string) => void;
  saveLayout: (name: string) => Promise<SavedLayout>;
  getSavedLayouts: () => Promise<SavedLayout[]>;
  loadLayout: (layoutId: string) => void;
  deleteLayout: (layoutId: string) => Promise<boolean>;
  toggleDevTools: () => void;
  reloadApp: () => void;
  openExternal: (url: string) => void;
  onConfigLoaded: (callback: (data: { tabs: TabConfig[]; activeTabId: string; config?: AppConfig }) => void) => void;
  onTabUpdated: (callback: (data: TabUpdateData) => void) => void;
  onNavigationBlocked: (callback: (data: { tabId: string; url: string; reason: string }) => void) => void;
  onTabSwitched: (callback: (data: { tabId: string }) => void) => void;
  onPaneLayout: (callback: (data: PaneLayoutData) => void) => void;
  onLayoutTemplateChanged: (callback: (data: { templateId: string }) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
