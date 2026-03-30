import React, { useState, useEffect } from 'react';
import type { LayoutTemplate, SavedLayout } from '../types';

const api = window.electronAPI;

interface LayoutPickerProps {
  tabCount: number;
}

/**
 * SVG preview for a layout template — renders each slot as a rect in a 40x28 viewBox.
 */
function TemplatePreview({ template, active }: { template: LayoutTemplate; active: boolean }) {
  const stroke = active ? 'var(--accent)' : 'var(--text-dim)';
  const fill = active ? 'var(--accent)' : 'var(--border)';
  const fillOpacity = active ? 0.25 : 0.35;
  const vw = 40;
  const vh = 28;
  const gap = 1.5;

  return (
    <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`}>
      {template.slots.map((slot, i) => {
        const sx = slot.x * vw + (slot.x > 0 ? gap / 2 : 0);
        const sy = slot.y * vh + (slot.y > 0 ? gap / 2 : 0);
        const sw = slot.w * vw - (slot.x > 0 ? gap / 2 : 0) - (slot.x + slot.w < 1 ? gap / 2 : 0);
        const sh = slot.h * vh - (slot.y > 0 ? gap / 2 : 0) - (slot.y + slot.h < 1 ? gap / 2 : 0);
        return (
          <rect
            key={i}
            x={sx}
            y={sy}
            width={sw}
            height={sh}
            rx={2}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={active ? 1.2 : 0.8}
          />
        );
      })}
    </svg>
  );
}

/**
 * Small inline preview for saved layout items
 */
function TemplateMiniPreview({ template }: { template: LayoutTemplate }) {
  const vw = 20;
  const vh = 14;
  return (
    <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} style={{ flexShrink: 0 }}>
      {template.slots.map((slot, i) => (
        <rect
          key={i}
          x={slot.x * vw + 0.5}
          y={slot.y * vh + 0.5}
          width={slot.w * vw - 1}
          height={slot.h * vh - 1}
          rx={1}
          fill="var(--border)"
          fillOpacity={0.5}
          stroke="var(--text-dim)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}

export default function LayoutPicker({ tabCount }: LayoutPickerProps) {
  const [activeTemplateId, setActiveTemplateId] = useState('single');
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.getLayoutTemplateId().then(id => setActiveTemplateId(id));
    api.getLayoutTemplates().then(t => setTemplates(t));
    api.getSavedLayouts().then(l => setSavedLayouts(l));
  }, []);

  // Listen for auto-relayout changes (e.g. after pane close)
  useEffect(() => {
    api.onLayoutTemplateChanged(({ templateId }) => {
      setActiveTemplateId(templateId);
    });
  }, []);

  function refreshLayouts() {
    api.getSavedLayouts().then(l => setSavedLayouts(l));
    api.getLayoutTemplateId().then(id => setActiveTemplateId(id));
  }

  function selectTemplate(templateId: string) {
    setActiveTemplateId(templateId);
    api.setLayoutTemplate(templateId);
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
    if (layout) setActiveTemplateId(layout.templateId || layout.splitMode);
    setOpen(false);
    api.showViews();
  }

  async function deleteLayout(e: React.MouseEvent, layoutId: string) {
    e.stopPropagation();
    await api.deleteLayout(layoutId);
    setSavedLayouts(savedLayouts.filter(l => l.id !== layoutId));
  }

  // Group templates by slot count, filter by available tabs
  const grouped: Record<number, LayoutTemplate[]> = {};
  for (const t of templates) {
    if (t.slots.length > tabCount) continue;
    const count = t.slots.length;
    if (!grouped[count]) grouped[count] = [];
    grouped[count].push(t);
  }

  const slotGroups = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const groupLabels: Record<number, string> = {
    1: 'Single',
    2: '2 Panes',
    3: '3 Panes',
    4: '4 Panes',
  };

  function findTemplateById(id: string): LayoutTemplate | undefined {
    return templates.find(t => t.id === id);
  }

  return (
    <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
      <button className="title-bar-btn" onClick={toggle} title="Snap Layout">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1" opacity="0.7" />
          <rect x="9" y="1" width="6" height="6" rx="1" opacity="0.7" />
          <rect x="1" y="9" width="6" height="6" rx="1" opacity="0.7" />
          <rect x="9" y="9" width="6" height="6" rx="1" opacity="0.7" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu open snap-layout-menu">
          {/* Snap layout grid */}
          {slotGroups.map(count => (
            <div key={count} className="snap-layout-group">
              <div className="snap-layout-group-label">
                {groupLabels[count] || `${count} Panes`}
              </div>
              <div className="snap-layout-grid">
                {grouped[count].map(t => (
                  <button
                    key={t.id}
                    className={`snap-layout-btn ${activeTemplateId === t.id ? 'active' : ''}`}
                    onClick={() => selectTemplate(t.id)}
                    title={t.label}
                  >
                    <TemplatePreview template={t} active={activeTemplateId === t.id} />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Saved layouts */}
          <div className="snap-layout-saved">
            <div className="snap-layout-group-label">Saved Layouts</div>
            {savedLayouts.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0', fontStyle: 'italic' }}>
                No saved layouts
              </div>
            )}
            {savedLayouts.map(layout => {
              const tmpl = findTemplateById(layout.templateId || layout.splitMode);
              return (
                <div
                  key={layout.id}
                  className="saved-layout-item"
                  onClick={() => loadLayout(layout.id)}
                >
                  {tmpl && <TemplateMiniPreview template={tmpl} />}
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
              );
            })}
            {activeTemplateId !== 'single' && (
              <button className="save-layout-btn" onClick={saveCurrentLayout}>
                + Save Current Layout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
