import React, { useState, useEffect } from 'react';
import type { AppConfig, ProfileConfig, TabConfig } from '../types';

const api = window.electronAPI;

interface SettingsProps {
  onClose: () => void;
  initialTab?: SettingsTab;
}

type SettingsTab = 'appearance' | 'tabs' | 'profiles' | 'advanced';

const COMMON_EMOJIS = ['🌐', '💬', '📧', '📝', '📊', '📁', '🔧', '🎵', '🎬', '📷', '🛒', '💼', '📅', '🔒', '🏠', '⭐', '🚀', '💡', '📱', '🖥️'];

export default function Settings({ onClose, initialTab }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'appearance');
  const [status, setStatus] = useState<{ text: string; type: '' | 'error' | 'success' }>({ text: '', type: '' });
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [addingTab, setAddingTab] = useState(initialTab === 'tabs');

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

  function updateConfig(updates: Partial<AppConfig>) {
    setConfig({ ...config!, ...updates });
  }

  function updateProfile(updates: Partial<ProfileConfig>) {
    const newConfig = { ...config! };
    const idx = newConfig.profiles.findIndex(p => p.id === profile.id);
    newConfig.profiles[idx] = { ...profile, ...updates };
    setConfig(newConfig);
  }

  function updateProfileById(profileId: string, updates: Partial<ProfileConfig>) {
    const newConfig = { ...config! };
    const idx = newConfig.profiles.findIndex(p => p.id === profileId);
    if (idx >= 0) newConfig.profiles[idx] = { ...newConfig.profiles[idx], ...updates };
    setConfig(newConfig);
  }

  function addProfile() {
    const id = 'profile-' + Date.now();
    const newProfile: ProfileConfig = {
      id,
      name: 'New Profile',
      tabBarPosition: profile.tabBarPosition,
      tabDisplayMode: profile.tabDisplayMode,
      tabSize: profile.tabSize,
      tabs: [],
    };
    setConfig({ ...config!, profiles: [...config!.profiles, newProfile] });
  }

  function deleteProfile(profileId: string) {
    if (config!.profiles.length <= 1) return;
    const filtered = config!.profiles.filter(p => p.id !== profileId);
    const newActiveId = profileId === config!.activeProfileId ? filtered[0].id : config!.activeProfileId;
    setConfig({ ...config!, profiles: filtered, activeProfileId: newActiveId });
  }

  function duplicateProfile(profileId: string) {
    const source = config!.profiles.find(p => p.id === profileId);
    if (!source) return;
    const id = 'profile-' + Date.now();
    const dupe: ProfileConfig = {
      ...JSON.parse(JSON.stringify(source)),
      id,
      name: source.name + ' (copy)',
      tabs: source.tabs.map(t => ({ ...t, id: t.id + '-' + Date.now() })),
    };
    setConfig({ ...config!, profiles: [...config!.profiles, dupe] });
  }

  function updateTab(tabId: string, updates: Partial<TabConfig>) {
    updateProfile({ tabs: profile.tabs.map(t => t.id === tabId ? { ...t, ...updates } : t) });
  }

  function deleteTab(tabId: string) {
    updateProfile({ tabs: profile.tabs.filter(t => t.id !== tabId) });
    if (editingTabId === tabId) setEditingTabId(null);
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
    let configToSave = config;
    if (activeTab === 'advanced') {
      try { configToSave = JSON.parse(jsonText); }
      catch (err: any) { setStatus({ text: err.message, type: 'error' }); return; }
    }
    const result = await api.saveConfig(configToSave);
    if (result.success) {
      setStatus({ text: 'Saved. Reloading...', type: 'success' });
      setTimeout(() => api.reloadApp(), 500);
    } else {
      setStatus({ text: result.error || 'Save failed', type: 'error' });
    }
  }

  useEffect(() => {
    if (activeTab === 'advanced' && config) {
      const editable = { ...config };
      delete editable.windowState;
      setJsonText(JSON.stringify(editable, null, 2));
    }
  }, [activeTab]);

  const navTabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'tabs', label: 'Tabs', icon: '📑' },
    { id: 'profiles', label: 'Profiles', icon: '👤' },
    { id: 'advanced', label: 'Advanced', icon: '⚙' },
  ];

  return (
    <div className="settings-overlay">
      <div className="settings-header">
        <h2>Settings</h2>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {navTabs.map(t => (
            <button key={t.id} className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : ''}`} onClick={() => setActiveTab(t.id)}>
              <span style={{ marginRight: 4 }}>{t.icon}</span> {t.label}
            </button>
          ))}
          <button className="settings-close-btn" onClick={onClose} title="Close" style={{ marginLeft: 8 }}>×</button>
        </div>
      </div>

      <div className="settings-body">
        {activeTab === 'appearance' && (
          <AppearanceSection config={config} profile={profile} onConfigChange={updateConfig} onProfileChange={updateProfile} />
        )}
        {activeTab === 'tabs' && (
          <TabsSection
            tabs={profile.tabs} editingTabId={editingTabId} addingTab={addingTab}
            onEditTab={setEditingTabId} onUpdateTab={updateTab} onDeleteTab={deleteTab}
            onAddTab={addTab} onMoveTab={moveTab}
            onStartAdd={() => { setAddingTab(true); setEditingTabId(null); }}
            onCancelAdd={() => setAddingTab(false)}
          />
        )}
        {activeTab === 'profiles' && (
          <ProfilesSection
            config={config}
            onUpdateProfile={updateProfileById}
            onAddProfile={addProfile}
            onDeleteProfile={deleteProfile}
            onDuplicateProfile={duplicateProfile}
            onSetActive={(id) => updateConfig({ activeProfileId: id })}
          />
        )}
        {activeTab === 'advanced' && (
          <AdvancedSection jsonText={jsonText} jsonError={jsonError} setJsonText={setJsonText} setJsonError={setJsonError} onSave={save} />
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

/* ── Appearance ── */

function AppearanceSection({ config, profile, onConfigChange, onProfileChange }: {
  config: AppConfig; profile: ProfileConfig;
  onConfigChange: (u: Partial<AppConfig>) => void; onProfileChange: (u: Partial<ProfileConfig>) => void;
}) {
  return (
    <>
      <div className="settings-section">
        <h3>Theme</h3>
        <SettingRow label="Dark Mode" description="Use dark colors for the browser chrome">
          <button className={`toggle-switch ${config.darkMode ? 'on' : ''}`} onClick={() => onConfigChange({ darkMode: !config.darkMode })} />
        </SettingRow>
      </div>
      <div className="settings-section">
        <h3>Tab Bar</h3>
        <SettingRow label="Position" description="Where to place the tab bar">
          <SegmentedControl options={[{ value: 'top', label: 'Top' }, { value: 'left', label: 'Left' }]} value={profile.tabBarPosition} onChange={v => onProfileChange({ tabBarPosition: v as any })} />
        </SettingRow>
        <SettingRow label="Display Mode" description="Show icon + title or icon only">
          <SegmentedControl options={[{ value: 'full', label: 'Full' }, { value: 'icon-only', label: 'Icon Only' }]} value={profile.tabDisplayMode || 'full'} onChange={v => onProfileChange({ tabDisplayMode: v as any })} />
        </SettingRow>
        <SettingRow label="Size" description="Tab bar size">
          <SegmentedControl options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} value={profile.tabSize || 'medium'} onChange={v => onProfileChange({ tabSize: v as any })} />
        </SettingRow>
      </div>
    </>
  );
}

/* ── Profiles ── */

function ProfilesSection({ config, onUpdateProfile, onAddProfile, onDeleteProfile, onDuplicateProfile, onSetActive }: {
  config: AppConfig;
  onUpdateProfile: (id: string, u: Partial<ProfileConfig>) => void;
  onAddProfile: () => void;
  onDeleteProfile: (id: string) => void;
  onDuplicateProfile: (id: string) => void;
  onSetActive: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="settings-section">
      <h3>Profiles ({config.profiles.length})</h3>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
        Profiles let you switch between different sets of tabs for different workstreams. Appearance settings are shared.
      </p>

      {config.profiles.map(p => (
        <div key={p.id} className="tab-list-item" style={{ borderColor: p.id === config.activeProfileId ? 'var(--accent)' : undefined }}>
          {editingId === p.id ? (
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="setting-input"
                value={p.name}
                onChange={e => onUpdateProfile(p.id, { name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') setEditingId(null); }}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm btn-primary" onClick={() => setEditingId(null)}>Done</button>
            </div>
          ) : (
            <>
              <span className="tab-list-icon" style={{ fontSize: 14, color: p.id === config.activeProfileId ? 'var(--accent)' : 'var(--text-dim)' }}>
                {p.id === config.activeProfileId ? '●' : '○'}
              </span>
              <div className="tab-list-info">
                <div className="tab-list-title">{p.name}</div>
                <div className="tab-list-url">{p.tabs.length} tab{p.tabs.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="tab-list-actions">
                {p.id !== config.activeProfileId && (
                  <button className="btn btn-sm" onClick={() => onSetActive(p.id)}>Activate</button>
                )}
                <button className="icon-btn" onClick={() => setEditingId(p.id)} title="Rename">✎</button>
                <button className="icon-btn" onClick={() => onDuplicateProfile(p.id)} title="Duplicate">⧉</button>
                {config.profiles.length > 1 && (
                  <button className="icon-btn danger" onClick={() => onDeleteProfile(p.id)} title="Delete">✕</button>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      <button className="btn" onClick={onAddProfile} style={{ marginTop: 8, width: '100%' }}>+ New Profile</button>
    </div>
  );
}

/* ── Tabs ── */

function TabsSection({ tabs, editingTabId, addingTab, onEditTab, onUpdateTab, onDeleteTab, onAddTab, onMoveTab, onStartAdd, onCancelAdd }: {
  tabs: TabConfig[]; editingTabId: string | null; addingTab: boolean;
  onEditTab: (id: string | null) => void; onUpdateTab: (id: string, u: Partial<TabConfig>) => void;
  onDeleteTab: (id: string) => void; onAddTab: (t: TabConfig) => void;
  onMoveTab: (id: string, dir: -1 | 1) => void; onStartAdd: () => void; onCancelAdd: () => void;
}) {
  return (
    <div className="settings-section">
      <h3>Tabs ({tabs.length})</h3>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
        Tabs for the active profile. Each tab loads a specific URL.
      </p>

      {tabs.map((tab, idx) => (
        <React.Fragment key={tab.id}>
          {editingTabId === tab.id ? (
            <TabEditForm tab={tab} onSave={updates => { onUpdateTab(tab.id, updates); onEditTab(null); }} onCancel={() => onEditTab(null)} />
          ) : (
            <div className="tab-list-item">
              <TabIconPreview icon={tab.icon} appIcon={tab.appIcon} />
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
        <TabEditForm onSave={tab => onAddTab(tab as TabConfig)} onCancel={onCancelAdd} isNew />
      ) : (
        <button className="btn" onClick={onStartAdd} style={{ marginTop: 8, width: '100%' }}>+ Add Tab</button>
      )}
    </div>
  );
}

function TabIconPreview({ icon, appIcon }: { icon?: string; appIcon?: string }) {
  if (appIcon) {
    return (
      <span className="tab-list-icon">
        <img src={appIcon} alt="" style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.textContent = icon || '🌐'; }} />
      </span>
    );
  }
  return <span className="tab-list-icon">{icon || '🌐'}</span>;
}

/* ── Tab Edit Form ── */

function TabEditForm({ tab, onSave, onCancel, isNew }: {
  tab?: TabConfig; onSave: (t: Partial<TabConfig>) => void; onCancel: () => void; isNew?: boolean;
}) {
  const [title, setTitle] = useState(tab?.title || '');
  const [url, setUrl] = useState(tab?.url || 'https://');
  const [icon, setIcon] = useState(tab?.icon || '');
  const [appIcon, setAppIcon] = useState(tab?.appIcon || '');
  const [origins, setOrigins] = useState(tab?.allowedOrigins?.join(', ') || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  function handleSave() {
    const originList = origins.split(',').map(o => o.trim()).filter(Boolean);
    try {
      const urlOrigin = new URL(url).origin;
      if (!originList.some(o => { try { return new URL(o).origin === urlOrigin; } catch { return false; } })) originList.unshift(urlOrigin);
    } catch { /* */ }

    onSave({
      ...(isNew ? { id: 'tab-' + Date.now() } : {}),
      title: title || 'New Tab', url,
      icon: icon || undefined, appIcon: appIcon || undefined, allowedOrigins: originList,
    });
  }

  return (
    <div className="tab-edit-form">
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {appIcon ? <img src={appIcon} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : (icon || '🌐')}
          </div>
          <button className="btn btn-sm" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ fontSize: 11 }}>{showEmojiPicker ? 'Close' : 'Pick Icon'}</button>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Title"><input className="setting-input wide" value={title} onChange={e => setTitle(e.target.value)} placeholder="My App" /></FormField>
          <FormField label="URL"><input className="setting-input wide" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></FormField>
          <FormField label="App Icon URL" hint="Optional — overrides emoji with a custom image"><input className="setting-input wide" value={appIcon} onChange={e => setAppIcon(e.target.value)} placeholder="https://example.com/icon.png" /></FormField>
          <FormField label="Allowed Origins" hint="Comma-separated. Tab URL origin is auto-added."><input className="setting-input wide" value={origins} onChange={e => setOrigins(e.target.value)} placeholder="https://example.com, https://auth.example.com" /></FormField>
        </div>
      </div>

      {showEmojiPicker && (
        <div style={{ marginTop: 8, padding: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Pick an icon or type your own emoji</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {COMMON_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => { setIcon(emoji); setShowEmojiPicker(false); }}
                style={{ width: 32, height: 32, fontSize: 18, background: icon === emoji ? 'var(--accent)' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {emoji}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Custom:</span>
            <input className="setting-input" value={icon} onChange={e => setIcon(e.target.value)} placeholder="Paste any emoji" style={{ width: 120 }} />
            {icon && <button className="btn btn-sm" onClick={() => setIcon('')}>Clear</button>}
          </div>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>{isNew ? 'Add Tab' : 'Update Tab'}</button>
      </div>
    </div>
  );
}

/* ── Advanced ── */

function AdvancedSection({ jsonText, jsonError, setJsonText, setJsonError, onSave }: {
  jsonText: string; jsonError: string; setJsonText: (s: string) => void; setJsonError: (s: string) => void; onSave: () => void;
}) {
  return (
    <div className="settings-section">
      <h3>JSON Configuration</h3>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Edit the raw configuration file directly.</p>
      <textarea
        className={`json-editor ${jsonError ? 'error' : ''}`} value={jsonText} spellCheck={false} rows={20}
        onChange={e => { setJsonText(e.target.value); try { JSON.parse(e.target.value); setJsonError(''); } catch (err: any) { setJsonError(err.message); } }}
        onKeyDown={e => {
          if (e.key === 'Tab') { e.preventDefault(); const ta = e.target as HTMLTextAreaElement; const s = ta.selectionStart; const end = ta.selectionEnd; setJsonText(jsonText.substring(0, s) + '  ' + jsonText.substring(end)); setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0); }
          if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(); }
        }}
      />
      {jsonError && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{jsonError}</div>}
    </div>
  );
}

/* ── Shared Components ── */

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{ padding: '4px 12px', fontSize: 12, background: value === opt.value ? 'var(--accent)' : 'var(--bg-secondary)', color: value === opt.value ? '#fff' : 'var(--text)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer' }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>
        {label}{hint && <span style={{ marginLeft: 6, fontStyle: 'italic', opacity: 0.7 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
