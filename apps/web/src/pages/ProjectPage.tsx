import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tier, Priority } from '../lib/types';
import { TIER_CONFIG, PRIORITY_CONFIG, LANE_COLORS } from '../lib/types';
import { api } from '../lib/api';

// Service icon lookup
const SERVICE_ICONS: Record<string, string> = {
    convex: '🔺', stripe: '💳', openai: '🤖', nvidia: '🟢', anthropic: '🧠',
    elevenlabs: '🔊', resend: '📧', vercel: '▲', netlify: '🌐', cloudflare: '☁️',
    aws: '🟠', google: '🔵', firebase: '🔥', supabase: '⚡', github: '🐙',
    sentry: '🐛', posthog: '📊', clerk: '🔐', auth0: '🛡️', twilio: '📱',
    sendgrid: '📬', redis: '🔴', database: '🗄️', postgres: '🐘', mongodb: '🍃',
    hosting: '🌍', domain: '🌐', expo: '📲', cloudinary: '🖼️', replicate: '🔄',
    huggingface: '🤗', 'better-auth': '🔑', 'aws-s3': '📦',
};

export default function ProjectPage() {
    const { path: projectPath } = useParams<{ path: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Record<string, any> | null>(null);
    const [rawYaml, setRawYaml] = useState('');
    const [editedYaml, setEditedYaml] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);

    // Accounts state
    const [accounts, setAccounts] = useState<Record<string, string>>({});
    const [editedAccounts, setEditedAccounts] = useState<Record<string, string>>({});
    const [accountsExist, setAccountsExist] = useState(false);
    const [savingAccounts, setSavingAccounts] = useState(false);
    const [accountsSaveStatus, setAccountsSaveStatus] = useState<'success' | 'error' | null>(null);
    const [newService, setNewService] = useState('');

    useEffect(() => {
        if (!projectPath) return;
        setLoading(true);
        const decoded = decodeURIComponent(projectPath);
        Promise.all([
            api.projects.get(decoded),
            api.projects.getAccounts(decoded),
        ])
            .then(([{ project: p, raw_yaml }, { accounts: a, exists }]) => {
                setProject(p);
                setRawYaml(raw_yaml);
                setEditedYaml(raw_yaml);
                setAccounts(a);
                setEditedAccounts({ ...a });
                setAccountsExist(exists);
            })
            .catch(() => setProject(null))
            .finally(() => setLoading(false));
    }, [projectPath]);

    const handleSave = async () => {
        if (!projectPath) return;
        setSaving(true); setSaveStatus(null);
        try {
            await api.projects.update(decodeURIComponent(projectPath), editedYaml);
            setRawYaml(editedYaml); setSaveStatus('success');
            const { project: p } = await api.projects.get(decodeURIComponent(projectPath));
            setProject(p);
            setTimeout(() => setSaveStatus(null), 3000);
        } catch { setSaveStatus('error'); }
        finally { setSaving(false); }
    };

    const handleSaveAccounts = async () => {
        if (!projectPath) return;
        setSavingAccounts(true); setAccountsSaveStatus(null);
        try {
            await api.projects.updateAccounts(decodeURIComponent(projectPath), editedAccounts);
            setAccounts({ ...editedAccounts });
            setAccountsExist(true);
            setAccountsSaveStatus('success');
            setTimeout(() => setAccountsSaveStatus(null), 3000);
        } catch { setAccountsSaveStatus('error'); }
        finally { setSavingAccounts(false); }
    };

    const handleAddService = () => {
        const service = newService.trim().toLowerCase().replace(/\s+/g, '-');
        if (!service || editedAccounts[service] !== undefined) return;
        setEditedAccounts(prev => ({ ...prev, [service]: '' }));
        setNewService('');
    };

    const handleRemoveService = (service: string) => {
        setEditedAccounts(prev => {
            const next = { ...prev };
            delete next[service];
            return next;
        });
    };

    const hasChanges = editedYaml !== rawYaml;
    const hasAccountChanges = JSON.stringify(editedAccounts) !== JSON.stringify(accounts);

    if (loading) return <div className="loading"><div className="loading-spinner" />Loading...</div>;
    if (!project) return <div className="error-message">Project not found</div>;

    const tc = TIER_CONFIG[project.tier as Tier] || TIER_CONFIG.idea;
    const pc = PRIORITY_CONFIG[(project.priority as Priority)] || PRIORITY_CONFIG.medium;
    const lc = LANE_COLORS[project.lane] || 'var(--text-tertiary)';

    return (
        <div className="project-detail">
            <button className="detail-back" onClick={() => navigate(-1)}>← Back</button>
            <div className="detail-header">
                <h1 className="detail-name">{project.name}</h1>
                <span className="tier-badge" style={{ color: tc.color, background: tc.bg, fontSize: 13, padding: '5px 14px' }}>{tc.emoji} {tc.label}</span>
                {project.oss && <span className="oss-badge" style={{ fontSize: 12, padding: '4px 10px' }}>OSS</span>}
                <span className={`health-badge ${(project.health_score || 0) >= 60 ? 'health-good' : (project.health_score || 0) >= 40 ? 'health-warn' : 'health-bad'}`}>{project.health_score || 0}</span>
            </div>
            {project.description && <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>{project.description}</p>}
            <div className="detail-meta">
                <div className="meta-item"><div className="meta-label">Lane</div><div className="meta-value" style={{ color: lc }}>{project.lane}</div></div>
                <div className="meta-item"><div className="meta-label">Priority</div><div className="meta-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="priority-dot" style={{ background: pc.color }} />{pc.label}</div></div>
                <div className="meta-item"><div className="meta-label">Last Active</div><div className="meta-value">{project.last_active || '—'}</div></div>
                <div className="meta-item"><div className="meta-label">Path</div><div className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{project.path}</div></div>
                {project.repo && <div className="meta-item"><div className="meta-label">Repository</div><div className="meta-value"><a href={project.repo} target="_blank" rel="noopener noreferrer">{project.repo}</a></div></div>}
                <div className="meta-item"><div className="meta-label">Stack</div><div className="meta-value"><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(Array.isArray(project.stack) ? project.stack : []).map((s: string) => <span key={s} className="stack-tag">{s}</span>)}</div></div></div>
            </div>

            {/* ─── Accounts Section ─── */}
            <div className="yaml-editor-section">
                <div className="yaml-editor-header">
                    <div className="yaml-editor-title">🔑 Service Accounts {!accountsExist && <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 400 }}>(no ACCOUNTS.yaml)</span>}</div>
                    <div className="yaml-editor-actions">
                        {accountsSaveStatus && <span className={`save-status ${accountsSaveStatus}`}>{accountsSaveStatus === 'success' ? '✓ Saved' : '✗ Error'}</span>}
                        <button className="btn btn-primary" onClick={handleSaveAccounts} disabled={savingAccounts || !hasAccountChanges}>{savingAccounts ? '⏳' : '💾'} Save</button>
                    </div>
                </div>
                <div className="accounts-grid">
                    {Object.entries(editedAccounts).map(([service, account]) => (
                        <div key={service} className="account-row">
                            <div className="account-service">
                                <span className="account-icon">{SERVICE_ICONS[service] || '🔧'}</span>
                                <span className="account-name">{service}</span>
                            </div>
                            <input
                                type="text"
                                className="form-input account-input"
                                value={account}
                                onChange={e => setEditedAccounts(prev => ({ ...prev, [service]: e.target.value }))}
                                placeholder="account name / email"
                            />
                            <button className="account-remove" onClick={() => handleRemoveService(service)} title="Remove service">✕</button>
                        </div>
                    ))}
                    {Object.keys(editedAccounts).length === 0 && (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
                            No service accounts configured. Add one below or run <code>node scripts/scan-accounts.mjs</code> to auto-detect.
                        </div>
                    )}
                </div>
                <div className="account-add-row">
                    <input
                        type="text"
                        className="form-input account-input"
                        value={newService}
                        onChange={e => setNewService(e.target.value)}
                        placeholder="Add service (e.g. vercel, stripe...)"
                        onKeyDown={e => e.key === 'Enter' && handleAddService()}
                    />
                    <button className="btn btn-secondary" onClick={handleAddService} disabled={!newService.trim()}>+ Add</button>
                </div>
            </div>

            {/* ─── YAML Editor ─── */}
            <div className="yaml-editor-section">
                <div className="yaml-editor-header">
                    <div className="yaml-editor-title">📝 PROJECT.yaml {hasChanges && <span style={{ color: 'var(--warning)', fontSize: 11, fontWeight: 400 }}>(unsaved)</span>}</div>
                    <div className="yaml-editor-actions">
                        {saveStatus && <span className={`save-status ${saveStatus}`}>{saveStatus === 'success' ? '✓ Saved' : '✗ Error'}</span>}
                        {hasChanges && <button className="btn btn-secondary" onClick={() => setEditedYaml(rawYaml)}>Reset</button>}
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasChanges}>{saving ? '⏳' : '💾'} Save</button>
                    </div>
                </div>
                <textarea className="yaml-textarea" value={editedYaml} onChange={e => setEditedYaml(e.target.value)} spellCheck={false} />
            </div>
        </div>
    );
}
