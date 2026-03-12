import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { useUrlFilters } from '../hooks/useUrlFilters';
import SearchableSelect from '../components/SearchableSelect';
import CreateProjectModal from '../components/CreateProjectModal';
import AIChatPanel, { ROADMAP_PROFILES } from '../components/AIChatPanel';
import { TIER_CONFIG, TIER_ORDER, type Tier } from '../lib/types';
import { PageHeader, Badge, EmptyState } from '../components/ui';
import { FormInput, FormTextarea } from '../components/ui';
import type { Id } from '../lib/types';

type RoadmapView = 'pipeline' | 'list' | 'compact' | 'kanban';

const FILTER_DEFAULTS = { view: 'pipeline', lane: '', priority: '', category: '', subcategory: '', tab: 'projects' };

const FEATURE_STATUS_COLS = [
    { key: 'proposed', label: 'Proposed', icon: '💡', color: '#a78bfa' },
    { key: 'planned', label: 'Planned', icon: '📋', color: '#60a5fa' },
    { key: 'in-progress', label: 'In Progress', icon: '🔨', color: '#fbbf24' },
    { key: 'shipped', label: 'Shipped', icon: '🚀', color: '#34d399' },
    { key: 'cancelled', label: 'Cancelled', icon: '❌', color: '#6b7280' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: '#ef4444' },
    high: { label: 'High', color: '#f87171' },
    medium: { label: 'Medium', color: '#fbbf24' },
    low: { label: 'Low', color: '#60a5fa' },
};

export default function RoadmapPage() {
    const { orgId } = useAuth();
    const { data, refresh } = useProjects();
    const projects = data?.projects || [];
    const [showCreate, setShowCreate] = useState(false);
    const [showCreateFeature, setShowCreateFeature] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);
    const [search, setSearch] = useState('');
    const [filters, setFilter] = useUrlFilters(FILTER_DEFAULTS);

    const activeTab = (filters.tab || 'projects') as 'projects' | 'features';
    const view = (filters.view || 'pipeline') as RoadmapView;
    const filterLane = filters.lane;
    const filterPriority = filters.priority;
    const filterCategory = filters.category;
    const filterSubcategory = filters.subcategory;

    // ─── Features queries & mutations ─────────────────────────────────
    const features = useQuery(api.features.list, orgId ? { orgId } : 'skip');
    const featureStats = useQuery(api.features.getStats, orgId ? { orgId } : 'skip');
    const createFeature = useMutation(api.features.create);
    const updateFeature = useMutation(api.features.update);
    const deleteFeature = useMutation(api.features.remove);

    // Create feature form state
    const [newFeatureTitle, setNewFeatureTitle] = useState('');
    const [newFeatureDesc, setNewFeatureDesc] = useState('');
    const [newFeaturePriority, setNewFeaturePriority] = useState('medium');
    const [newFeatureEffort, setNewFeatureEffort] = useState('M');
    const [newFeatureProject, setNewFeatureProject] = useState('');

    // Derive categories from project paths
    const categories = useMemo(() => {
        const cats = new Map<string, Set<string>>();
        for (const p of projects) {
            const segments = p.path.split('/');
            const cat = segments[0] || 'root';
            if (!cats.has(cat)) cats.set(cat, new Set());
            if (segments.length > 2) {
                cats.get(cat)!.add(segments[1]);
            }
        }
        return cats;
    }, [projects]);

    const categoryOptions = useMemo(() =>
        [...categories.keys()].sort().map(c => ({
            value: c, label: c, sublabel: `${categories.get(c)?.size || 0} subcategories`,
        })), [categories]
    );

    const subcategoryOptions = useMemo(() => {
        if (!filterCategory || !categories.has(filterCategory)) return [];
        return [...categories.get(filterCategory)!].sort().map(s => ({ value: s, label: s }));
    }, [filterCategory, categories]);

    const laneOptions = useMemo(() =>
        [...new Set(projects.map(p => p.lane))].sort().map(l => ({ value: l, label: l })),
        [projects]
    );

    const projectOptions = useMemo(() =>
        (projects || []).map(p => ({
            value: p.id,
            label: p.name,
            sublabel: p.path,
            group: p.lane || 'other',
            icon: '📁',
        })), [projects]
    );

    const priorityOptions = [
        { value: 'high', label: 'High', icon: '🔴' },
        { value: 'medium', label: 'Medium', icon: '🟡' },
        { value: 'low', label: 'Low', icon: '🔵' },
        { value: 'parked', label: 'Parked', icon: '⏸️' },
    ];

    const filtered = useMemo(() => {
        return projects.filter(p => {
            if (search) {
                const q = search.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
            }
            if (filterLane && p.lane !== filterLane) return false;
            if (filterPriority && p.priority !== filterPriority) return false;
            if (filterCategory) {
                const cat = p.path.split('/')[0];
                if (cat !== filterCategory) return false;
            }
            if (filterSubcategory) {
                const segments = p.path.split('/');
                if (segments.length < 2 || segments[1] !== filterSubcategory) return false;
            }
            return true;
        });
    }, [projects, search, filterLane, filterPriority, filterCategory, filterSubcategory]);

    // Group by tier for pipeline view
    const byTier = useMemo(() => {
        const map: Record<string, typeof filtered> = {};
        for (const tier of TIER_ORDER) map[tier] = [];
        for (const p of filtered) {
            const t = p.tier || 'idea';
            if (!map[t]) map[t] = [];
            map[t].push(p);
        }
        const order: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
        for (const t of Object.keys(map)) {
            map[t].sort((a: { priority?: string }, b: { priority?: string }) => (order[a.priority ?? ''] ?? 99) - (order[b.priority ?? ''] ?? 99));
        }
        return map;
    }, [filtered]);

    // ─── Feature Handlers ────────────────────────────────────────────

    const handleCreateFeature = async () => {
        if (!newFeatureTitle.trim() || !orgId) return;
        await createFeature({
            orgId,
            title: newFeatureTitle.trim(),
            description: newFeatureDesc.trim(),
            priority: newFeaturePriority,
            effort: newFeatureEffort,
            projectId: newFeatureProject ? newFeatureProject as Id<"projects"> : undefined,
        });
        setNewFeatureTitle('');
        setNewFeatureDesc('');
        setNewFeaturePriority('medium');
        setNewFeatureEffort('M');
        setNewFeatureProject('');
        setShowCreateFeature(false);
    };

    const handleFeatureStatusChange = async (featureId: string, status: string) => {
        await updateFeature({ featureId: featureId as Id<"features">, status });
    };

    const handleDeleteFeature = async (featureId: string) => {
        if (confirm('Delete this feature?')) {
            await deleteFeature({ featureId: featureId as Id<"features"> });
        }
    };

    // ───────────── Projects Tab Renderers ──────────────────────────────

    const renderPipeline = () => (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TIER_ORDER.length}, 1fr)`, gap: 4 }} className="mb-8">
                {TIER_ORDER.map(tier => {
                    const cfg = TIER_CONFIG[tier as Tier];
                    const count = byTier[tier]?.length || 0;
                    return (
                        <div key={tier} className="text-center" style={{
                            padding: '12px 8px', borderRadius: 8,
                            background: cfg?.bg || 'var(--bg-secondary)', border: `1px solid ${cfg?.color || 'var(--border)'}30`,
                        }}>
                            <div className="text-2xl">{cfg?.emoji}</div>
                            <div className="font-semibold text-md" style={{ color: cfg?.color }}>{cfg?.label}</div>
                            <div className="text-3xl font-bold mt-4">{count}</div>
                        </div>
                    );
                })}
            </div>
            <div className="flex-row flex-center gap-8 text-base text-tertiary" style={{ margin: '8px 0 20px' }}>
                {TIER_ORDER.map((tier, i) => (
                    <span key={tier}>
                        {TIER_CONFIG[tier as Tier]?.emoji} {TIER_CONFIG[tier as Tier]?.label}
                        {i < TIER_ORDER.length - 1 && <span style={{ margin: '0 4px' }}>→</span>}
                    </span>
                ))}
            </div>
            {TIER_ORDER.filter(t => (byTier[t]?.length || 0) > 0).map(tier => {
                const cfg = TIER_CONFIG[tier as Tier];
                return (
                    <div key={tier} className="dimension-group">
                        <div className="dimension-group-header" style={{ borderColor: cfg?.color || 'var(--border)' }}>
                            <span className="dimension-group-icon">{cfg?.emoji}</span>
                            <span className="dimension-group-label" style={{ color: cfg?.color }}>{cfg?.label}</span>
                            <span className="dimension-group-count">{byTier[tier].length}</span>
                        </div>
                        <div className="grid-auto-180 gap-8">
                            {byTier[tier].map(p => (
                                <div key={p.path} className="section-card-sm" style={{ borderLeft: `3px solid ${cfg?.color || 'var(--border)'}` }}>
                                    <div className="font-semibold text-md mb-4">{p.name}</div>
                                    <div className="flex-row flex-wrap gap-6">
                                        <span className="text-xs text-tertiary">{p.lane}</span>
                                        <Badge variant="priority" priority={p.priority} size="sm" />
                                    </div>
                                    {p.stack?.length > 0 && (
                                        <div className="flex-row flex-wrap gap-4 mt-8">
                                            {p.stack.slice(0, 3).map((s: string) => <span key={s} className="stack-tag">{s}</span>)}
                                            {p.stack.length > 3 && <span className="text-xs text-tertiary">+{p.stack.length - 3}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </>
    );

    const renderList = () => (
        <div className="mt-16">
            {filtered.length === 0 ? (
                <EmptyState icon="🗺️" message="No projects match filters" />
            ) : (
                <div className="project-table-wrapper">
                    <table className="project-table">
                        <thead><tr><th>Name</th><th>Tier</th><th>Lane</th><th>Priority</th><th>Category</th><th>Stack</th></tr></thead>
                        <tbody>
                            {filtered.map(p => {
                                const segments = p.path.split('/');
                                return (
                                    <tr key={p.path}>
                                        <td><div className="table-name">{p.name}</div></td>
                                        <td><Badge variant="tier" tier={p.tier} /></td>
                                        <td className="text-muted font-medium">{p.lane}</td>
                                        <td><Badge variant="priority" priority={p.priority} /></td>
                                        <td className="text-sm text-tertiary">{segments[0]}{segments.length > 2 ? ` / ${segments[1]}` : ''}</td>
                                        <td><div className="flex-row flex-wrap gap-4">{(p.stack || []).slice(0, 3).map((s: string) => <span key={s} className="stack-tag">{s}</span>)}</div></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderCompact = () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {filtered.map(p => {
                const cfg = TIER_CONFIG[p.tier as Tier];
                return (
                    <div key={p.path} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-secondary)', border: `1px solid ${cfg?.color || 'var(--border)'}22` }}>
                        <div className="font-semibold text-md">{cfg?.emoji} {p.name}</div>
                        <div className="text-sm text-tertiary">{p.lane} · {p.priority}</div>
                    </div>
                );
            })}
        </div>
    );

    const renderKanban = () => (
        <div className="kanban-board">
            {TIER_ORDER.map(tier => {
                const cfg = TIER_CONFIG[tier as Tier];
                const items = byTier[tier] || [];
                return (
                    <div key={tier} className="kanban-column">
                        <div className="kanban-column-header">
                            <div className="kanban-column-title" style={{ color: cfg?.color || 'var(--text-primary)' }}>{cfg?.emoji} {cfg?.label || tier}</div>
                            <span className="kanban-count">{items.length}</span>
                        </div>
                        <div className="kanban-cards">
                            {items.map(p => (
                                <div key={p.path} className="kanban-card" style={{ borderLeft: `3px solid ${cfg?.color || 'var(--border)'}` }}>
                                    <div className="kanban-card-name">{p.name}</div>
                                    <div className="kanban-card-lane" style={{ color: 'var(--text-tertiary)' }}>{p.lane}</div>
                                    <div className="flex-row gap-4 mt-4">
                                        <Badge variant="priority" priority={p.priority} />
                                        {p.oss && <Badge variant="oss" />}
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 12 }}>No projects</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // ───────────── Features Tab Renderer ──────────────────────────────

    const renderFeaturesTab = () => {
        const allFeatures = features || [];
        return (
            <div>
                {showCreateFeature && (
                    <div className="section-card mb-16">
                        <div className="grid-2 gap-12 mb-12">
                            <FormInput value={newFeatureTitle} onChange={e => setNewFeatureTitle(e.target.value)} placeholder="Feature title *" />
                            <SearchableSelect options={projectOptions} value={newFeatureProject} onChange={setNewFeatureProject} placeholder="Select project" grouped />
                        </div>
                        <FormTextarea value={newFeatureDesc} onChange={e => setNewFeatureDesc(e.target.value)} placeholder="Description (optional)" style={{ minHeight: 60 }} />
                        <div className="flex-row gap-12 mt-12">
                            <SearchableSelect options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} value={newFeaturePriority} onChange={setNewFeaturePriority} placeholder="Priority" clearable={false} width="130px" />
                            <SearchableSelect options={['XS', 'S', 'M', 'L', 'XL'].map(e => ({ value: e, label: e }))} value={newFeatureEffort} onChange={setNewFeatureEffort} placeholder="Effort" clearable={false} width="80px" />
                            <div className="flex-1" />
                            <button className="btn btn-secondary text-base" onClick={() => setShowCreateFeature(false)}>Cancel</button>
                            <button className="btn btn-primary text-base" onClick={handleCreateFeature} disabled={!newFeatureTitle.trim()}>Create Feature</button>
                        </div>
                    </div>
                )}

                {featureStats && (
                    <div className="flex-row flex-wrap gap-12 mb-16">
                        {FEATURE_STATUS_COLS.map(col => (
                            <div key={col.key} className="flex-row gap-6 text-md" style={{ padding: '6px 12px', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                <span>{col.icon}</span>
                                <span className="font-semibold">{featureStats.byStatus[col.key] || 0}</span>
                                <span className="text-sm text-tertiary">{col.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="gap-12" style={{ display: 'grid', gridTemplateColumns: `repeat(${FEATURE_STATUS_COLS.length}, minmax(200px, 1fr))`, overflowX: 'auto' }}>
                    {FEATURE_STATUS_COLS.map(col => {
                        const colFeatures = allFeatures.filter(f => f.status === col.key);
                        return (
                            <div key={col.key} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 12, minHeight: 300, border: '1px solid var(--border)' }}>
                                <div className="flex-row gap-8 mb-12" style={{ paddingBottom: 10, borderBottom: `2px solid ${col.color}`, alignItems: 'center' }}>
                                    <span>{col.icon}</span>
                                    <span className="font-semibold text-sm">{col.label}</span>
                                    <span className="text-xs font-semibold" style={{ background: col.color + '25', color: col.color, padding: '2px 6px', borderRadius: 8, marginLeft: 'auto' }}>{colFeatures.length}</span>
                                </div>
                                <div className="flex-col gap-8">
                                    {colFeatures.map(feature => (
                                        <div key={feature._id} className="task-kanban-card">
                                            <div className="font-medium text-md mb-6">{feature.title}</div>
                                            <div className="flex-row flex-wrap gap-4 mb-6">
                                                <span className="text-xs font-semibold" style={{
                                                    padding: '1px 6px', borderRadius: 4,
                                                    background: (PRIORITY_CONFIG[feature.priority]?.color || '#6b7280') + '20',
                                                    color: PRIORITY_CONFIG[feature.priority]?.color || '#6b7280',
                                                }}>{feature.priority}</span>
                                                {feature.effort && <span className="text-xs text-tertiary font-mono">{feature.effort}</span>}
                                            </div>
                                            <div className="flex-row gap-4">
                                                {FEATURE_STATUS_COLS.filter(s => s.key !== feature.status).slice(0, 2).map(s => (
                                                    <button key={s.key} onClick={() => handleFeatureStatusChange(feature._id, s.key)}
                                                        className="text-xs" style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                        {s.icon}
                                                    </button>
                                                ))}
                                                <button onClick={() => handleDeleteFeature(feature._id)} className="icon-btn text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', marginLeft: 'auto' }} title="Delete">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {colFeatures.length === 0 && <div className="text-sm text-tertiary text-center" style={{ padding: 24, opacity: 0.5 }}>No features</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div>
            <PageHeader title="🗺️ Roadmap" description="Project lifecycle & feature management"
                actions={
                <div className="flex-row gap-8">
                        <button className="btn btn-secondary text-base" onClick={() => setShowAIChat(!showAIChat)} title="AI Assistant">🤖 AI</button>
                        <span className="text-base text-tertiary">{activeTab === 'projects' ? `${filtered.length} projects` : `${features?.length || 0} features`}</span>
                        {activeTab === 'projects' ? (
                            <button className="btn btn-primary text-base" onClick={() => setShowCreate(true)}>+ New Project</button>
                        ) : (
                            <button className="btn btn-primary text-base" onClick={() => setShowCreateFeature(!showCreateFeature)}>+ New Feature</button>
                        )}
                    </div>
                }
            />

            <div className="flex-row gap-4 mb-16" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                <button className={`btn text-sm ${activeTab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('tab', 'projects')} style={{ borderRadius: '8px 8px 0 0', padding: '8px 20px' }}>📦 Projects</button>
                <button className={`btn text-sm ${activeTab === 'features' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('tab', 'features')} style={{ borderRadius: '8px 8px 0 0', padding: '8px 20px' }}>✨ Features</button>
            </div>

            {activeTab === 'projects' && (
                <>
                    <div className="filter-bar flex-row flex-wrap gap-8 mb-16">
                        <FormInput value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." inputSize="sm" style={{ width: 180, background: 'var(--bg-secondary)' }} />
                        <div className="view-toggle">
                            <button className={`btn ${view === 'pipeline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'pipeline')}>🔀 Pipeline</button>
                            <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'list')}>☰ List</button>
                            <button className={`btn ${view === 'compact' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'compact')}>⊞ Compact</button>
                            <button className={`btn ${view === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'kanban')}>🏗️ Kanban</button>
                        </div>
                        <SearchableSelect options={categoryOptions} value={filterCategory} onChange={(v) => { setFilter('category', v); setFilter('subcategory', ''); }} placeholder="All Categories" width="170px" />
                        {subcategoryOptions.length > 0 && <SearchableSelect options={subcategoryOptions} value={filterSubcategory} onChange={(v) => setFilter('subcategory', v)} placeholder="All Subcategories" width="170px" />}
                        <SearchableSelect options={laneOptions} value={filterLane} onChange={(v) => setFilter('lane', v)} placeholder="All Lanes" width="150px" />
                        <SearchableSelect options={priorityOptions} value={filterPriority} onChange={(v) => setFilter('priority', v)} placeholder="All Priorities" width="150px" />
                    </div>
                    {!data ? <div className="loading"><div className="loading-spinner" /> Loading roadmap...</div>
                        : view === 'pipeline' ? renderPipeline() : view === 'list' ? renderList() : view === 'kanban' ? renderKanban() : renderCompact()}
                </>
            )}

            {activeTab === 'features' && (
                features === undefined ? <div className="loading"><div className="loading-spinner" /> Loading features...</div> : renderFeaturesTab()
            )}

            {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => { refresh(); }} lanes={[...new Set(projects.map(p => p.lane))]} />}

            <AIChatPanel
                pageContext="Roadmap"
                profiles={ROADMAP_PROFILES}
                isOpen={showAIChat}
                onToggle={() => setShowAIChat(false)}
            />
        </div>
    );
}
