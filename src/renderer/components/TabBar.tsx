import React from 'react';
import type { TabConfig } from '../types';

interface TabBarProps {
  tabs: TabConfig[];
  activeTabId: string | null;
  position: 'top' | 'left';
  displayMode: 'full' | 'icon-only';
  size: 'small' | 'medium' | 'large';
  tabStates: Map<string, { isLoading?: boolean; title?: string; favicon?: string }>;
  onSwitchTab: (id: string) => void;
  onAddTab: () => void;
}

export default function TabBar({ tabs, activeTabId, position, displayMode, size, tabStates, onSwitchTab, onAddTab }: TabBarProps) {
  const barClasses = [
    'tab-bar',
    `size-${size}`,
    displayMode === 'icon-only' ? 'icon-only' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={barClasses}>
      <div className="tabs-container">
        {tabs.map(tab => {
          const state = tabStates.get(tab.id);
          const title = state?.title || tab.title;
          const favicon = state?.favicon;
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={`tab ${isActive ? 'active' : ''} ${state?.isLoading ? 'loading' : ''}`}
              onClick={() => onSwitchTab(tab.id)}
              title={title}
            >
              <TabIcon tab={tab} favicon={favicon} />
              <span className="tab-title">{title}</span>
            </div>
          );
        })}
      </div>
      <button className="add-tab-btn" onClick={onAddTab} title="Add Tab">+</button>
    </div>
  );
}

function TabIcon({ tab, favicon }: { tab: TabConfig; favicon?: string }) {
  // Priority: appIcon > favicon from page > icon emoji > google favicon
  const src = tab.appIcon || favicon;

  if (src) {
    return (
      <span className="tab-icon">
        <img
          className="tab-favicon"
          src={src}
          alt=""
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.textContent = tab.icon || '🌐';
          }}
        />
      </span>
    );
  }

  if (tab.icon) {
    return <span className="tab-icon">{tab.icon}</span>;
  }

  // Fallback: google favicon
  let googleFavicon = '';
  try {
    googleFavicon = `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`;
  } catch { /* */ }

  return (
    <span className="tab-icon">
      {googleFavicon ? (
        <img
          className="tab-favicon"
          src={googleFavicon}
          alt=""
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.textContent = '🌐';
          }}
        />
      ) : '🌐'}
    </span>
  );
}
