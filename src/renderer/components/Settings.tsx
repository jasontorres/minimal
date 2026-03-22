import React, { useState, useEffect } from 'react';
import type { AppConfig, ProfileConfig, TabConfig } from '../types';

const api = window.electronAPI;

interface SettingsProps {
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'tabs' | 'advanced';

export default function Settings({ onClose }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [status, setStatus] = useState<{ text: string; type: '' | 'error' | 'success' }>({ text: '', type: '' });
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Editing state for tabs
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [addingTab, setAddingTab] = useState(false);

  useEffect(() => {
    api.getConfig().then(cfg => {
      setConfig(cfg);
      const editable = { ...cfg };
      delete editable.windowState;
      setJsonText(JSON.stringify(editable, null, 2));
    });
  }, []);

  if (!config) return null;

  const profile = config.profiles.find(p => p.id === config.activeProfileId) || config.profiles[0];

  function updateProfile(updates: Partial<ProfileConfig>) {
    if (!config) return;
    const newConfig = { ...config };
    const idx = newConfig.profiles.findIndex(p => p.id === profile.id);
    newConfig.profiles[idx] = { ...profile, ...updates };
    setConfig(newConfig);
  }

  function updateTab(tabId: string, updates: Partial<TabConfig>) {
    const newTabs = profile.tabs.map(t => t.id === tabId ? { ...t, ...updates } : t);
    updateProfile({ tabs: newTabs });
  }

  function deleteTab(tabId: string) {
    updateProfile({ tabs: profile.tabs.filter(t => t.id !== tabId) });
  }

  function addTab(tab: TabConfig) {
    updateProfile({ tabs: [...profile.tabs, tab] });
    setAddingTab(false);
  }

  function moveTab(tabId: string, direction: -1 | 1) {
    const tabs = [...profile.tabs];
    const idx = tabs.findIndex(t => t.id === tabId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tabs.length) return;
    [tabs[idx], tabs[newIdx]] = [tabs[newIdx], tabs[idx]];
    updateProfile({ tabs });
  }

  async function save() {
    if (!config) return;
    // If on advanced tab, parse JSON
    let configToSave = config;
    if (activeTab === 'advanced') {
      try {
        configToSave = JSON.parse(jsonText);
      } catch (err: any) {
        setStatus({ text: err.message, type: 'error' });
        return;
      }
    }
    const result = await api.saveConfig(configToSave);
    if (result.success) {
      setStatus({ text: 'Saved. Reloading...', type: 'success' });
      setTimeout(() => api.reloadApp(), 500);
    } else {
      setStatus({ text: result.error || 'Save failed', type: 'error' });
    }
  }

  // Sync JSON text when switching to advanced
  useEffect(() => {
    if (activeTab === 'advanced' && config) {
      const editable = { ...config };
      delete editable.windowState;
      setJsonText(JSON.stringify(editable, null, 2));
    }
  }, [activeTab]);

  return (
    <div className="settings-overlay">
      <div className="settings-header">
        <h2>Settings</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['appearance', 'tabs', 'advanced'] as SettingsTab[]).map(t => (
            <button
              key={t}
              className={`btn btn-sm ${activeTab === t ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button className="settings-close-btn" onClick={onClose} title="Close">×</button>
        </div>
      </div>

      <div className="settings-body">
        {activeTab === 'appearance' && (
          <AppearanceSettings
            config={config}
            profile={profile}
            onConfigChange={setConfig}
            onProfileChange={updateProfile}
          />
        )}

        {activeTab === 'tabs' && (
          <TabsSettings
            tabs={profile.tabs}
            editingTabId={editingTabId}
            addingTab={addingTab}
            onEditTab={setEditingTabId}
            onUpdateTab={updateTab}
            onDeleteTab={deleteTab}
            onAddTab={addTab}
            onMoveTab={moveTab}
            onStartAdd={() => { setAddingTab(true); setEditingTabId(null); }}
            onCancelAdd={() => setAddingTab(false)}
          />
        )}

        {activeTab === 'advanced' && (
          <div className="settings-section">
            <h3>JSON Configuration</h3>
            <textarea
              className={`json-editor ${jsonError ? 'error' : ''}`}
              value={jsonText}
              onChange={e => {
                setJsonText(e.target.value);
                try { JSON.parse(e.target.value); setJsonError(''); } catch (err: any) { setJsonError(err.message); }
              }}
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const ta = e.target as HTMLTextAreaElement;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  setJsonText(jsonText.substring(0, start) + '  ' + jsonText.substring(end));
                  setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
              }}
              spellCheck={false}
              rows={20}
            />
            {jsonError && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{jsonError}</div>}
          </div>
        )}
      </div>

      <div className="settings-footer">
        <span className={`settings-status ${status.type}`}>{status.text}</span>
        <div className="settings-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save &amp; Reload</button>
        </div>
      </div>
    </div>
  );
}

/* ── Appearance Section ── */

function AppearanceSettings({
  config, profile, onConfigChange, onProfileChange
}: {
  config: AppConfig;
  profile: ProfileConfig;
  onConfigChange: (c: AppConfig) => void;
  onProfileChange: (u: Partial<ProfileConfig>) => void;
}) {
  return (
    <>
      <div className="settings-section">
        <h3>Theme</h3>
        <div className="setting-row">
          <span className="setting-label">Dark Mode</span>
          <button
            className={`toggle-switch ${config.darkMode ? 'on' : ''}`}
            onClick={() => onConfigChange({ ...config, darkMode: !config.darkMode })}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Tab Bar</h3>
        <div className="setting-row">
          <span className="setting-label">Position</span>
          <select
            className="setting-select"
            value={profile.tabBarPosition}
            onChange={e => onProfileChange({ tabBarPosition: e.target.value as any })}
          >
            <option value="top">Top</option>
            <option value="left">Left</option>
          </select>
        </div>
        <div className="setting-row">
          <span className="setting-label">Display Mode</span>
          <select
            className="setting-select"
            value={profile.tabDisplayMode || 'full'}
            onChange={e => onProfileChange({ tabDisplayMode: e.target.value as any })}
          >
            <option value="full">Full (Icon + Title)</option>
            <option value="icon-only">Icon Only</option>
          </select>
        </div>
        <div className="setting-row">
          <span className="setting-label">Size</span>
          <select
            className="setting-select"
            value={profile.tabSize || 'medium'}
            onChange={e => onProfileChange({ tabSize: e.target.value as any })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>
    </>
  );
}

/* ── Tabs Section ── */

function TabsSettings({
  tabs, editingTabId, addingTab,
  onEditTab, onUpdateTab, onDeleteTab, onAddTab, onMoveTab,
  onStartAdd, onCancelAdd
}: {
  tabs: TabConfig[];
  editingTabId: string | null;
  addingTab: boolean;
  onEditTab: (id: string | null) => void;
  onUpdateTab: (id: string, u: Partial<TabConfig>) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: (t: TabConfig) => void;
  onMoveTab: (id: string, dir: -1 | 1) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
}) {
  return (
    <div className="settings-section">
      <h3>Tabs</h3>

      {tabs.map((tab, idx) => (
        <React.Fragment key={tab.id}>
          {editingTabId === tab.id ? (
            <TabEditForm
              tab={tab}
              onSave={(updates) => { onUpdateTab(tab.id, updates); onEditTab(null); }}
              onCancel={() => onEditTab(null)}
            />
          ) : (
            <div className="tab-list-item">
              <span className="tab-list-icon">{tab.icon || '🌐'}</span>
              <div className="tab-list-info">
                <div className="tab-list-title">{tab.title}</div>
                <div className="tab-list-url">{tab.url}</div>
              </div>
              <div className="tab-list-actions">
                {idx > 0 && <button className="icon-btn" onClick={() => onMoveTab(tab.id, -1)} title="Move up">↑</button>}
                {idx < tabs.length - 1 && <button className="icon-btn" onClick={() => onMoveTab(tab.id, 1)} title="Move down">↓</button>}
                <button className="icon-btn" onClick={() => { onEditTab(tab.id); onCancelAdd(); }} title="Edit">✎</button>
                <button className="icon-btn danger" onClick={() => onDeleteTab(tab.id)} title="Delete">✕</button>
              </div>
            </div>
          )}
        </React.Fragment>
      ))}

      {addingTab ? (
        <TabEditForm
          onSave={tab => onAddTab(tab as TabConfig)}
          onCancel={onCancelAdd}
          isNew
        />
      ) : (
        <button className="btn" onClick={onStartAdd} style={{ marginTop: 8 }}>+ Add Tab</button>
      )}
    </div>
  );
}

/* ── Tab Edit Form ── */

function TabEditForm({
  tab,
  onSave,
  onCancel,
  isNew
}: {
  tab?: TabConfig;
  onSave: (t: Partial<TabConfig>) => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [title, setTitle] = useState(tab?.title || '');
  const [url, setUrl] = useState(tab?.url || 'https://');
  const [icon, setIcon] = useState(tab?.icon || '');
  const [appIcon, setAppIcon] = useState(tab?.appIcon || '');
  const [origins, setOrigins] = useState(tab?.allowedOrigins?.join(', ') || '');

  function handleSave() {
    const originList = origins.split(',').map(o => o.trim()).filter(Boolean);
    // Auto-add the URL origin if not included
    try {
      const urlOrigin = new URL(url).origin;
      if (!originList.some(o => { try { return new URL(o).origin === urlOrigin; } catch { return false; } })) {
        originList.unshift(urlOrigin);
      }
    } catch { /* */ }

    const result: Partial<TabConfig> = {
      title: title || 'New Tab',
      url,
      icon: icon || undefined,
      appIcon: appIcon || undefined,
      allowedOrigins: originList,
    };

    if (isNew) {
      result.id = 'tab-' + Date.now();
    }

    onSave(result);
  }

  return (
    <div className="tab-edit-form">
      <div className="form-row">
        <label>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="My App" />
      </div>
      <div className="form-row">
        <label>URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" />
      </div>
      <div className="form-row">
        <label>Icon (emoji)</label>
        <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🌐" style={{ width: 60 }} />
      </div>
      <div className="form-row">
        <label>App Icon URL</label>
        <input value={appIcon} onChange={e => setAppIcon(e.target.value)} placeholder="https://example.com/icon.png" />
      </div>
      <div className="form-row">
        <label>Allowed Origins</label>
        <input value={origins} onChange={e => setOrigins(e.target.value)} placeholder="https://example.com, https://auth.example.com" />
      </div>
      <div className="form-actions">
        <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>{isNew ? 'Add' : 'Update'}</button>
      </div>
    </div>
  );
}
