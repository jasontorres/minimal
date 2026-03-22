/**
 * Shared types for config and IPC communication
 */

// Domain allow-list configuration
export interface TabConfig {
  id: string;
  title: string;
  url: string;
  allowedOrigins: string[];
  icon?: string;
}

// Profile containing multiple tabs
export interface Profile {
  id: string;
  name: string;
  tabBarPosition?: 'top' | 'left' | 'right';
  tabBarSize?: number;
  tabs: TabConfig[];
}

// Root configuration structure
export interface AppConfig {
  activeProfileId: string;
  profiles: Profile[];
  windowState?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isMaximized?: boolean;
  };
}

// Default configuration factory
export function createDefaultConfig(): AppConfig {
  return {
    activeProfileId: 'default',
    profiles: [
      {
        id: 'default',
        name: 'Default',
        tabs: [
          {
            id: 'example-1',
            title: 'Example Site',
            url: 'https://example.com',
            allowedOrigins: ['https://example.com'],
            icon: '🌐'
          }
        ]
      }
    ]
  };
}

// IPC channel names
export const IPC_CHANNELS = {
  // Renderer -> Main
  SWITCH_TAB: 'switch-tab',
  RELOAD_TAB: 'reload-tab',
  CLOSE_TAB: 'close-tab',
  GET_CONFIG: 'get-config',
  UPDATE_CONFIG: 'update-config',
  OPEN_EXTERNAL: 'open-external',

  // Main -> Renderer
  TAB_UPDATED: 'tab-updated',
  NAVIGATION_BLOCKED: 'navigation-blocked',
  CONFIG_UPDATED: 'config-updated'
} as const;

// IPC message types
export interface SwitchTabMessage {
  tabId: string;
}

export interface ReloadTabMessage {
  tabId: string;
}

export interface CloseTabMessage {
  tabId: string;
}

export interface TabUpdatedMessage {
  tabId: string;
  url: string;
  title?: string;
  isLoading?: boolean;
}

export interface NavigationBlockedMessage {
  tabId: string;
  url: string;
  reason: 'domain-not-allowed' | 'new-window-not-allowed';
}
