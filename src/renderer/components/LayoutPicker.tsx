import React, { useState, useEffect } from 'react';
import type { SplitMode, SavedLayout } from '../types';

const api = window.electronAPI;

interface LayoutPickerProps {
  tabCount: number;
}

const LAYOUTS: { mode: SplitMode; label: string; minTabs: number }[] = [
  { mode: 'single',  label: 'Single',       minTabs: 1 },
  { mode: 'split-v', label: 'Side by Side',  minTabs: 2 },
  { mode: 'split-h', label: 'Stacked',       minTabs: 2 },
  { mode: 'grid',    label: 'Grid',          minTabs: 4 },
];

function LayoutIcon({ mode, active }: { mode: SplitMode; active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-dim)';
  const bg = active ? 'var(--accent)' : 'var(--border)';
  const size = 20;

  switch (mode) {
    case 'single':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case 'split-v':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="1" y="1" width="8" height="18" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
          <rect x="11" y="1" width="8" height="18" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
        </svg>
      );
    case 'split-h':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="1" y="1" width="18" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
          <rect x="1" y="11" width="18" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
        </svg>
      );
    case 'grid':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="1" y="1" width="8" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
          <rect x="11" y="1" width="8" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
          <rect x="1" y="11" width="8" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
          <rect x="11" y="11" width="8" height="8" rx="1.5" fill={bg} opacity={active ? 0.3 : 0.4} stroke={color} strokeWidth="1" />
        </svg>
      );
  }
}

export default function LayoutPicker({ tabCount }: LayoutPickerProps) {
  const [mode, setMode] = useState<SplitMode>('single');
  const [open, setOpen] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);

  useEffect(() => {
    api.getSplitMode().then(m => setMode(m));
    api.getSavedLayouts().then(l => setSavedLayouts(l));
  }, []);

  function refreshLayouts() {
    api.getSavedLayouts().then(l => setSavedLayouts(l));
  }

  function select(m: SplitMode) {
    setMode(m);
    api.setSplitMode(m);
    setOpen(false);
    api.showViews();
  }

  function toggle() {
    if (open) {
      setOpen(false);
      api.showViews();
    } else {
      api.hideViews();
      refreshLayouts();
      setOpen(true);
    }
  }

  async function saveCurrentLayout() {
    const nextNum = savedLayouts.length + 1;
    const name = `Layout ${nextNum}`;
    const layout = await api.saveLayout(name);
    setSavedLayouts([...savedLayouts, layout]);
  }

  function loadLayout(layoutId: string) {
    api.loadLayout(layoutId);
    const layout = savedLayouts.find(l => l.id === layoutId);
    if (layout) setMode(layout.splitMode);
    setOpen(false);
    api.showViews();
  }

  async function deleteLayout(e: React.MouseEvent, layoutId: string) {
    e.stopPropagation();
    await api.deleteLayout(layoutId);
    setSavedLayouts(savedLayouts.filter(l => l.id !== layoutId));
  }

  const available = LAYOUTS.filter(l => l.minTabs <= tabCount);

  return (
    <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
      <button className="title-bar-btn" onClick={toggle} title="Layout">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1" opacity="0.7" /><rect x="9" y="1" width="6" height="6" rx="1" opacity="0.7" />
          <rect x="1" y="9" width="6" height="6" rx="1" opacity="0.7" /><rect x="9" y="9" width="6" height="6" rx="1" opacity="0.7" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu open" style={{ padding: '8px', minWidth: 220 }}>
          {/* Layout mode selector */}
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Layout Mode
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {available.map(l => (
              <button
                key={l.mode}
                onClick={() => select(l.mode)}
                title={l.label}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: mode === l.mode ? 'var(--bg-hover)' : 'transparent',
                  border: mode === l.mode ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <LayoutIcon mode={l.mode} active={mode === l.mode} />
              </button>
            ))}
          </div>

          {/* Saved layouts */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Saved Layouts
            </div>
            {savedLayouts.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 0', fontStyle: 'italic' }}>
                No saved layouts
              </div>
            )}
            {savedLayouts.map(layout => (
              <div
                key={layout.id}
                className="saved-layout-item"
                onClick={() => loadLayout(layout.id)}
              >
                <LayoutIcon mode={layout.splitMode} active={false} />
                <span className="saved-layout-name">{layout.name}</span>
                <span className="saved-layout-info">{layout.tabIds.length} tabs</span>
                <button
                  className="saved-layout-delete"
                  onClick={(e) => deleteLayout(e, layout.id)}
                  title="Delete layout"
                >
                  <svg width="8" height="8" viewBox="0 0 10 10">
                    <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
              </div>
            ))}
            {mode !== 'single' && (
              <button
                className="save-layout-btn"
                onClick={saveCurrentLayout}
              >
                + Save Current Layout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
