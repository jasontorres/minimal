import React, { useState, useRef, useEffect } from 'react';
import LayoutPicker from './LayoutPicker';
import type { ProfileConfig } from '../types';

const api = window.electronAPI;

interface TitleBarProps {
  isDark: boolean;
  tabCount: number;
  profiles: ProfileConfig[];
  activeProfileId: string;
  onToggleDarkMode: () => void;
  onOpenSettings: (tab?: 'appearance' | 'tabs' | 'profiles' | 'advanced') => void;
  onSwitchProfile: (id: string) => void;
}

export default function TitleBar({ isDark, tabCount, profiles, activeProfileId, onToggleDarkMode, onOpenSettings, onSwitchProfile }: TitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handleClick = () => {
      if (menuOpen) closeMenu();
      if (profileMenuOpen) closeProfileMenu();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen, profileMenuOpen]);

  function openMenu() { api.hideViews(); setMenuOpen(true); }
  function closeMenu() { setMenuOpen(false); api.showViews(); }
  function openProfileMenu() { api.hideViews(); setProfileMenuOpen(true); }
  function closeProfileMenu() { setProfileMenuOpen(false); api.showViews(); }

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="title-bar">
      <div className="title-bar-content">Minimal Browser</div>
      <div className="title-bar-controls">
        {/* Profile switcher */}
        {profiles.length > 1 && (
          <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
            <button
              className="title-bar-btn profile-btn"
              onClick={e => { e.stopPropagation(); profileMenuOpen ? closeProfileMenu() : openProfileMenu(); }}
              title="Switch Profile"
            >
              <span style={{ fontSize: 11, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProfile?.name || 'Profile'}
              </span>
              <span style={{ fontSize: 8, marginLeft: 3 }}>▼</span>
            </button>
            <div className={`dropdown-menu ${profileMenuOpen ? 'open' : ''}`}>
              {profiles.map(p => (
                <button
                  key={p.id}
                  className="dropdown-item"
                  onClick={() => { onSwitchProfile(p.id); closeProfileMenu(); }}
                >
                  <span className="icon">{p.id === activeProfileId ? '●' : '○'}</span>
                  <span>{p.name}</span>
                </button>
              ))}
              <div className="dropdown-sep" />
              <button className="dropdown-item" onClick={() => { onOpenSettings('profiles'); closeProfileMenu(); }}>
                <span className="icon">✎</span>
                <span>Manage Profiles</span>
              </button>
            </div>
          </div>
        )}

        {tabCount >= 2 && <LayoutPicker tabCount={tabCount} />}

        {/* Settings menu */}
        <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
          <button className="title-bar-btn" onClick={e => { e.stopPropagation(); menuOpen ? closeMenu() : openMenu(); }} title="Menu">⚙</button>
          <div className={`dropdown-menu ${menuOpen ? 'open' : ''}`}>
            <button className="dropdown-item" onClick={() => { onToggleDarkMode(); closeMenu(); }}>
              <span className="icon">{isDark ? '☀' : '☽'}</span>
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="dropdown-sep" />
            <button className="dropdown-item" onClick={() => { onOpenSettings(); closeMenu(); }}>
              <span className="icon">⚙</span>
              <span>Settings</span>
            </button>
            <button className="dropdown-item" onClick={() => { api.toggleDevTools(); closeMenu(); }}>
              <span className="icon">🔧</span>
              <span>Developer Tools</span>
            </button>
            <div className="dropdown-sep" />
            <button className="dropdown-item" onClick={() => api.quitApp()}>
              <span className="icon">✕</span>
              <span>Quit</span>
            </button>
          </div>
        </div>

        <button className="title-bar-btn" onClick={() => api.minimizeWindow()} title="Minimize">_</button>
        <button className="title-bar-btn" onClick={() => api.maximizeWindow()} title="Maximize">□</button>
        <button className="title-bar-btn close" onClick={() => api.closeWindow()} title="Close">×</button>
      </div>
    </div>
  );
}
