import React, { useState, useEffect } from 'react';
import type { SplitMode } from '../types';

const api = window.electronAPI;

interface LayoutPickerProps {
  tabCount: number;
}

const LAYOUTS: { mode: SplitMode; label: string; minTabs: number }[] = [
  { mode: 'single',  label: 'Single',     minTabs: 1 },
  { mode: 'split-v', label: 'Side by Side', minTabs: 2 },
  { mode: 'split-h', label: 'Stacked',    minTabs: 2 },
  { mode: 'grid',    label: 'Grid',       minTabs: 4 },
];

function LayoutIcon({ mode, active }: { mode: SplitMode; active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-dim)';
  const bg = active ? 'var(--accent)' : 'var(--border)';
  const size = 20;
  const gap = 1.5;

  // Simple SVG grid icons
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

  useEffect(() => {
    api.getSplitMode().then(m => setMode(m));
  }, []);

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
      setOpen(true);
    }
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
        <div className="dropdown-menu open" style={{ padding: '8px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
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
        </div>
      )}
    </div>
  );
}
