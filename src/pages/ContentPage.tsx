import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

const STATUS_FLOW = [
    { key: 'draft', label: 'Draft', icon: '📝', color: '#a78bfa' },
    { key: 'planned', label: 'Planned', icon: '📅', color: '#60a5fa' },
    { key: 'in_progress', label: 'In Progress', icon: '⚡', color: '#fbbf24' },
    { key: 'published', label: 'Published', icon: '✅', color: '#34d399' },
    { key: 'skipped', label: 'Skipped', icon: '⏭️', color: '#6b7280' },
];

const PLATFORMS = ['twitter', 'reddit', 'youtube', 'linkedin', 'devto', 'github'];

export default function ContentPage() {
    const { data: projectData } = useProjects();
    const plans = useQuery(api.content.listPlans, {});
    const stats = useQuery(api.content.getContentStats);
    const createPlan = useMutation(api.content.createPlan);
    const updatePlan = useMutation(api.content.updatePlan);
    const deletePlan = useMutation(api.content.deletePlan);
    const addItem = useMutation(api.content.addItem);
    const updateItem = useMutation(api.content.updateItem);

    const [filter, setFilter] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
    const [newItemContent, setNewItemContent] = useState('');
    const [newItemPlatform, setNewItemPlatform] = useState('twitter');

    // Create form
    const [newProject, setNewProject] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const allPlans = plans || [];
    const filtered = allPlans.filter((p: any) => filter === 'all' || p.status === filter);

    const projectOptions: SelectOption[] = useMemo(() => {
        const allPaths = new Set<string>();
        for (const p of (projectData?.projects || [])) allPaths.add(p.path);
        for (const p of allPlans) allPaths.add((p as any).projectPath);
        return [...allPaths].sort().map(path => {
            const segments = path.split('/');
            return { value: path, label: segments[segments.length - 1] || path, sublabel: segments.slice(0, -1).join('/'), group: segments[0], icon: '📁' };
        });
    }, [projectData, allPlans]);

    const platformIcons: Record<string, string> = {
        twitter: '🐦', reddit: '🔴', youtube: '▶️', linkedin: '💼', devto: '📰', github: '🐙'
    };

    const platformOptions: SelectOption[] = PLATFORMS.map(p => ({ value: p, label: p, icon: platformIcons[p] || '📄' }));

    const handleCreate = async () => {
        if (!newProject.trim() || !newTag.trim()) return;
        const id = await createPlan({
            projectPath: newProject.trim(),
            releaseTag: newTag.trim(),
            releaseTitle: newTitle.trim() || undefined,
            releaseNotes: newNotes.trim() || undefined,
        });
        setShowCreate(false);
        setNewProject('');
        setNewTag('');
        setNewTitle('');
        setNewNotes('');
        setExpandedPlan(id);
    };

    // Load plan detail with items
    const expandedDetail = useQuery(
        api.content.getPlan,
        expandedPlan ? { id: expandedPlan as any } : 'skip'
    );

    const handleAddItem = async () => {
        if (!expandedPlan || !newItemContent.trim()) return;
        await addItem({
            planId: expandedPlan as any,
            platform: newItemPlatform,
            content: newItemContent.trim(),
        });
        setNewItemContent('');
    };


    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">📢 Content Planner</h1>
                        <p className="page-description">Manage release announcements across platforms</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Plan</button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span style={{ fontWeight: 600 }}>{stats.totalPlans}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 6 }}>Plans</span>
                    </div>
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span style={{ fontWeight: 600 }}>{stats.totalItems}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 6 }}>Content Items</span>
                    </div>
                    {Object.entries(stats.byPlatform).map(([platform, count]) => (
                        <div key={platform} className="stat-card" style={{ padding: '8px 16px' }}>
                            <span>{platformIcons[platform] || '📄'}</span>
                            <span style={{ fontWeight: 600, marginLeft: 4 }}>{count as number}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="Select project *" grouped allowCreate onCreateNew={(v) => setNewProject(v)} />
                        <input placeholder="Release tag * (e.g. v1.0.0)" value={newTag} onChange={e => setNewTag(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                    </div>
                    <input placeholder="Release title (optional)" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, marginBottom: 12 }} />
                    <textarea placeholder="Release notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, minHeight: 60, resize: 'vertical', marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newProject.trim() || !newTag.trim()}>Create Plan</button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="filter-bar">
                {[{ key: 'all', label: `All (${allPlans.length})` }, ...STATUS_FLOW].map(f => (
                    <button
                        key={f.key}
                        className={`btn ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f.key)}
                        style={{ fontSize: 12 }}
                    >
                        {'icon' in f ? `${f.icon} ` : ''}{f.label}
                    </button>
                ))}
            </div>

            {/* Plans List */}
            <div style={{ marginTop: 16 }}>
                {!plans ? (
                    <div className="loading"><div className="loading-spinner" /> Loading plans...</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📢</div>
                        <div className="empty-state-text">No content plans yet</div>
                    </div>
                ) : (
                    filtered.map((plan: any) => (
                        <div key={plan._id} style={{
                            background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 8,
                            border: expandedPlan === plan._id ? '1px solid var(--accent)' : '1px solid var(--border)',
                        }}>
                            <div
                                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                                onClick={() => setExpandedPlan(expandedPlan === plan._id ? null : plan._id)}
                            >
                                <span style={{ fontSize: 18 }}>{STATUS_FLOW.find(s => s.key === plan.status)?.icon || '📝'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{plan.releaseTitle || `${plan.projectPath} ${plan.releaseTag}`}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        {plan.projectPath} · {plan.releaseTag} · {new Date(plan.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <select
                                    value={plan.status}
                                    onChange={e => { e.stopPropagation(); updatePlan({ id: plan._id, status: e.target.value }); }}
                                    onClick={e => e.stopPropagation()}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 11 }}
                                >
                                    {STATUS_FLOW.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                                </select>
                                <button
                                    onClick={e => { e.stopPropagation(); deletePlan({ id: plan._id }); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                >✕</button>
                            </div>

                            {/* Expanded Detail */}
                            {expandedPlan === plan._id && expandedDetail && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                                    {expandedDetail.releaseNotes && (
                                        <div style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                            {expandedDetail.releaseNotes}
                                        </div>
                                    )}

                                    {/* Content Items */}
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                                            Content Items ({expandedDetail.items?.length || 0})
                                        </div>
                                        {(expandedDetail.items || []).map((item: any) => (
                                            <div key={item._id} style={{
                                                display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px',
                                                background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border)',
                                            }}>
                                                <span style={{ fontSize: 16 }}>{platformIcons[item.platform] || '📄'}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{item.content}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                        {item.platform} · {item.status}
                                                    </div>
                                                </div>
                                                <select
                                                    value={item.status}
                                                    onChange={e => updateItem({ id: item._id, status: e.target.value })}
                                                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 10 }}
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="scheduled">Scheduled</option>
                                                    <option value="posted">Posted</option>
                                                </select>
                                            </div>
                                        ))}

                                        {/* Add Item Form */}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <div style={{ width: 140 }}>
                                                <SearchableSelect options={platformOptions} value={newItemPlatform} onChange={setNewItemPlatform} placeholder="Platform" clearable={false} />
                                            </div>
                                            <input
                                                placeholder="Content draft..."
                                                value={newItemContent}
                                                onChange={e => setNewItemContent(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                                                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12 }}
                                            />
                                            <button className="btn btn-primary" onClick={handleAddItem} disabled={!newItemContent.trim()} style={{ fontSize: 12, padding: '6px 12px' }}>Add</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
