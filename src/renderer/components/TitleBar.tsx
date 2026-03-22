import React, { useState, useRef, useEffect } from 'react';

const api = window.electronAPI;

interface TitleBarProps {
  isDark: boolean;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
}

export default function TitleBar({ isDark, onToggleDarkMode, onOpenSettings }: TitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => { if (menuOpen) closeMenu(); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  function openMenu() {
    api.hideViews();
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
    api.showViews();
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    menuOpen ? closeMenu() : openMenu();
  }

  return (
    <div className="title-bar">
      <div className="title-bar-content">Minimal Browser</div>
      <div className="title-bar-controls">
        <div className="dropdown-wrapper" ref={wrapperRef} onClick={e => e.stopPropagation()}>
          <button className="title-bar-btn" onClick={handleToggle} title="Menu">⚙</button>
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
