import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Tier, Priority, Project } from '../lib/types';
import { TIER_CONFIG, PRIORITY_CONFIG, LANE_COLORS } from '../lib/types';
import SearchableSelect from '../components/SearchableSelect';
import type { ConvexProject } from '../lib/types';

const LANES = ['ai-agents', 'web-apps', 'mobile-apps', 'developer-tools', 'templates', 'infrastructure', 'learning', 'uncategorized'];

export default function ProjectPage() {
    const { path: projectPath } = useParams<{ path: string }>();
    const navigate = useNavigate();

    const projectId = projectPath ? decodeURIComponent(projectPath) : '';

    // Convex queries
    const project = useQuery(api.projects.getByPath, projectId ? { path: projectId } : "skip");
    const updateProject = useMutation(api.projects.updateByPath);

    // Form state
    const [editedProject, setEditedProject] = useState<Partial<Project> & { deployUrl?: string }>({});
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);

    // Sync form with project data once loaded
    useEffect(() => {
        if (project && Object.keys(editedProject).length === 0) {
            setEditedProject(project as Partial<ConvexProject>);
        }
    }, [project, editedProject]);

    const handleSave = async () => {
        if (!projectId) return;
        setSaving(true);
        setSaveStatus(null);
        try {
            await updateProject({
                path: projectId,
                name: editedProject.name || undefined,
                description: editedProject.description || undefined,
                tier: editedProject.tier,
                lane: editedProject.lane,
                priority: editedProject.priority,
                oss: editedProject.oss,
                repo: editedProject.repo || undefined,
                deployUrl: editedProject.deployUrl || undefined,
            });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: string, value: string | boolean | string[] | number) => {
        setEditedProject(prev => ({ ...prev, [field]: value }));
    };

    if (project === undefined) return <div className="loading"><div className="loading-spinner" />Loading...</div>;
    if (project === null) return <div className="error-message">Project not found</div>;

    const currentProject = { ...project, ...editedProject };

    const tc = TIER_CONFIG[currentProject.tier as Tier] || TIER_CONFIG.idea;
    const pc = PRIORITY_CONFIG[(currentProject.priority as Priority)] || PRIORITY_CONFIG.medium;
    const lc = LANE_COLORS[currentProject.lane] || 'var(--text-tertiary)';

    const hasChanges = Object.keys(editedProject).some((k) => editedProject[k as keyof Project] !== (project as Record<string, unknown>)[k]);

    return (
        <div className="project-detail">
            <button className="detail-back" onClick={() => navigate(-1)}>← Back</button>
            <div className="detail-header">
                <h1 className="detail-name">{currentProject.name}</h1>
                <span className="tier-badge" style={{ color: tc.color, background: tc.bg, fontSize: 13, padding: '5px 14px' }}>{tc.emoji} {tc.label}</span>
                {currentProject.oss && <span className="oss-badge" style={{ fontSize: 12, padding: '4px 10px' }}>OSS</span>}
                <span className={`health-badge ${(currentProject.healthScore || 0) >= 60 ? 'health-good' : (currentProject.healthScore || 0) >= 40 ? 'health-warn' : 'health-bad'}`}>{currentProject.healthScore || 0}</span>
            </div>

            <div className="detail-meta mb-24 mt-16">
                <div className="meta-item"><div className="meta-label">Path/ID</div><div className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{projectId}</div></div>
                <div className="meta-item"><div className="meta-label">Last Active</div><div className="meta-value">{currentProject.lastActive ? new Date(currentProject.lastActive).toLocaleDateString() : '—'}</div></div>
            </div>

            {/* ─── Project Details Form ─── */}
            <div className="yaml-editor-section">
                <div className="yaml-editor-header">
                    <div className="yaml-editor-title">📝 Project Settings {hasChanges && <span style={{ color: 'var(--warning)', fontSize: 11, fontWeight: 400 }}>(unsaved)</span>}</div>
                    <div className="yaml-editor-actions">
                        {saveStatus && <span className={`save-status ${saveStatus}`}>{saveStatus === 'success' ? '✓ Saved' : '✗ Error'}</span>}
                        {hasChanges && <button className="btn btn-secondary" onClick={() => setEditedProject(project as Partial<ConvexProject>)}>Cancel</button>}
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasChanges}>{saving ? '⏳' : '💾'} Save</button>
                    </div>
                </div>

                <div className="gap-16 flex-col mt-16 mb-16" style={{ padding: '0 16px' }}>
                    <div className="grid-2 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Project Name</label>
                            <input className="form-input" value={currentProject.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Description</label>
                            <input className="form-input" value={currentProject.description || ''} onChange={(e) => handleChange('description', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid-3 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Tier</label>
                            <SearchableSelect
                                options={Object.entries(TIER_CONFIG).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))}
                                value={currentProject.tier}
                                onChange={(v) => handleChange('tier', v)}
                                clearable={false}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Lane</label>
                            <SearchableSelect
                                options={LANES.map(l => ({ value: l, label: l }))}
                                value={currentProject.lane}
                                onChange={(v) => handleChange('lane', v)}
                                clearable={false}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Priority</label>
                            <SearchableSelect
                                options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                                value={currentProject.priority}
                                onChange={(v) => handleChange('priority', v)}
                                clearable={false}
                            />
                        </div>
                    </div>

                    <div className="grid-2 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Repository URL</label>
                            <input className="form-input" value={currentProject.repo || ''} onChange={(e) => handleChange('repo', e.target.value)} placeholder="https://github.com/..." />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Deployment URL</label>
                            <input className="form-input" value={currentProject.deployUrl || ''} onChange={(e) => handleChange('deployUrl', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="flex-row gap-8 mt-8">
                        <label className="flex-row gap-8 cursor-pointer text-base">
                            <input type="checkbox" checked={currentProject.oss || false} onChange={(e) => handleChange('oss', e.target.checked)} />
                            Open Source (OSS)
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
