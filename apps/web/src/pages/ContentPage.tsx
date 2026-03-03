import { useState, useMemo, useEffect, useCallback } from 'react';
import { useProjects } from '../hooks/useProjects';
import { api } from '../lib/api';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import { PageHeader, EmptyState } from '../components/ui';

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
    const [plans, setPlans] = useState<any[] | null>(null);
    const [stats, setStats] = useState<any>(null);

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

    const loadPlans = useCallback(async () => {
        try {
            const [p, s] = await Promise.all([api.content.list(), api.content.stats()]);
            setPlans(p);
            setStats(s);
        } catch (err) {
            console.error('Failed to load content plans:', err);
            setPlans([]);
        }
    }, []);

    useEffect(() => { loadPlans(); }, [loadPlans]);

    const allPlans = plans || [];
    const filtered = allPlans.filter((p: any) => filter === 'all' || p.status === filter);

    const projectOptions: SelectOption[] = useMemo(() => {
        const allPaths = new Set<string>();
        for (const p of (projectData?.projects || [])) allPaths.add(p.path);
        for (const p of allPlans) allPaths.add(p.projectPath);
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
        const plan = await api.content.create({
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
        setExpandedPlan(plan.id);
        await loadPlans();
    };

    const handleUpdatePlan = async (id: string, updates: Record<string, unknown>) => {
        await api.content.update(id, updates);
        await loadPlans();
    };

    const handleDeletePlan = async (id: string) => {
        await api.content.delete(id);
        if (expandedPlan === id) setExpandedPlan(null);
        await loadPlans();
    };

    const handleAddItem = async () => {
        if (!expandedPlan || !newItemContent.trim()) return;
        await api.content.addItem(expandedPlan, {
            platform: newItemPlatform,
            content: newItemContent.trim(),
        });
        setNewItemContent('');
        await loadPlans();
    };

    const handleUpdateItem = async (planId: string, itemId: string, updates: Record<string, unknown>) => {
        await api.content.updateItem(planId, itemId, updates);
        await loadPlans();
    };

    const expandedDetail = expandedPlan ? allPlans.find((p: any) => p.id === expandedPlan) : null;

    return (
        <div>
            <PageHeader
                title="📢 Content Planner"
                description="Manage release announcements across platforms · Minions-backed"
                actions={
                    <button className="btn btn-primary text-base" onClick={() => setShowCreate(!showCreate)}>+ New Plan</button>
                }
            />

            {/* Stats */}
            {stats && (
                <div className="flex-row flex-wrap gap-12 mb-16">
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span className="font-semibold">{stats.totalPlans}</span>
                        <span className="text-sm text-tertiary" style={{ marginLeft: 6 }}>Plans</span>
                    </div>
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span className="font-semibold">{stats.totalItems}</span>
                        <span className="text-sm text-tertiary" style={{ marginLeft: 6 }}>Content Items</span>
                    </div>
                    {Object.entries(stats.byPlatform).map(([platform, count]) => (
                        <div key={platform} className="stat-card" style={{ padding: '8px 16px' }}>
                            <span>{platformIcons[platform] || '📄'}</span>
                            <span className="font-semibold" style={{ marginLeft: 4 }}>{count as number}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <div className="grid-2 gap-12 mb-12">
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="Select project *" grouped allowCreate onCreateNew={(v) => setNewProject(v)} />
                        <input placeholder="Release tag * (e.g. v1.0.0)" value={newTag} onChange={e => setNewTag(e.target.value)} className="form-input" />
                    </div>
                    <input placeholder="Release title (optional)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="form-input mb-12" />
                    <textarea placeholder="Release notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="form-textarea mb-12" />
                    <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newProject.trim() || !newTag.trim()}>Create Plan</button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="filter-bar flex-row flex-wrap gap-8 mb-16">
                {[{ key: 'all', label: `All (${allPlans.length})` }, ...STATUS_FLOW].map(f => (
                    <button
                        key={f.key}
                        className={`btn text-base ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {'icon' in f ? `${f.icon} ` : ''}{f.label}
                    </button>
                ))}
            </div>

            {/* Plans List */}
            <div className="mt-16">
                {plans === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading plans...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon="📢" message="No content plans yet" />
                ) : (
                    filtered.map((plan: any) => (
                        <div key={plan.id} className="section-card-sm mb-8" style={{
                            borderColor: expandedPlan === plan.id ? 'var(--accent)' : undefined,
                        }}>
                            <div
                                className="flex-row gap-12"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                            >
                                <span className="text-2xl">{STATUS_FLOW.find(s => s.key === plan.status)?.icon || '📝'}</span>
                                <div className="flex-1">
                                    <div className="font-semibold text-lg">{plan.releaseTitle || `${plan.projectPath} ${plan.releaseTag}`}</div>
                                    <div className="text-sm text-tertiary mt-4">
                                        {plan.projectPath} · {plan.releaseTag} · {new Date(plan.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div onClick={e => e.stopPropagation()} style={{ width: 140 }}>
                                    <SearchableSelect
                                        options={STATUS_FLOW.map(s => ({ value: s.key, label: `${s.icon} ${s.label}` }))}
                                        value={plan.status}
                                        onChange={v => handleUpdatePlan(plan.id, { status: v })}
                                        placeholder="Status" clearable={false} width="140px" />
                                </div>
                                <button onClick={e => { e.stopPropagation(); handleDeletePlan(plan.id); }} className="icon-btn">✕</button>
                            </div>

                            {/* Expanded Detail */}
                            {expandedPlan === plan.id && expandedDetail && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                                    {expandedDetail.releaseNotes && (
                                        <div className="text-md text-muted whitespace-pre" style={{ padding: '12px 0' }}>
                                            {expandedDetail.releaseNotes}
                                        </div>
                                    )}

                                    {/* Content Items */}
                                    <div className="mt-12">
                                        <div className="section-label mb-8">
                                            Content Items ({expandedDetail.items?.length || 0})
                                        </div>
                                        {(expandedDetail.items || []).map((item: any) => (
                                            <div key={item._id} className="flex-row gap-8 mb-6" style={{
                                                alignItems: 'flex-start', padding: '8px 12px',
                                                background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)',
                                            }}>
                                                <span className="text-xl">{platformIcons[item.platform] || '📄'}</span>
                                                <div className="flex-1">
                                                    <div className="text-base whitespace-pre">{item.content}</div>
                                                    <div className="text-xs text-tertiary mt-4">
                                                        {item.platform} · {item.status}
                                                    </div>
                                                </div>
                                                <div style={{ width: 120 }}>
                                                    <SearchableSelect
                                                        options={[{ value: 'draft', label: 'Draft' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'posted', label: 'Posted' }]}
                                                        value={item.status}
                                                        onChange={v => handleUpdateItem(plan.id, item._id, { status: v })}
                                                        placeholder="Status" clearable={false} width="120px" />
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add Item Form */}
                                        <div className="flex-row gap-8 mt-8">
                                            <div style={{ width: 140 }}>
                                                <SearchableSelect options={platformOptions} value={newItemPlatform} onChange={setNewItemPlatform} placeholder="Platform" clearable={false} />
                                            </div>
                                            <input
                                                placeholder="Content draft..."
                                                value={newItemContent}
                                                onChange={e => setNewItemContent(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                                                className="form-input-sm flex-1"
                                            />
                                            <button className="btn btn-primary text-base" onClick={handleAddItem} disabled={!newItemContent.trim()} style={{ padding: '6px 12px' }}>Add</button>
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
