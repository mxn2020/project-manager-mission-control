import { useState, useMemo } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useUrlFilters } from '../hooks/useUrlFilters';
import SearchableSelect from '../components/SearchableSelect';
import CreateProjectModal from '../components/CreateProjectModal';
import { TIER_CONFIG, TIER_ORDER, type Tier } from '../lib/types';
import { PageHeader, Badge, EmptyState } from '../components/ui';

type RoadmapView = 'pipeline' | 'list' | 'compact';

const FILTER_DEFAULTS = { view: 'pipeline', lane: '', priority: '', category: '', subcategory: '' };

export default function RoadmapPage() {
    const { data, refresh } = useProjects();
    const projects = data?.projects || [];
    const [showCreate, setShowCreate] = useState(false);
    const [filters, setFilter] = useUrlFilters(FILTER_DEFAULTS);

    const view = (filters.view || 'pipeline') as RoadmapView;
    const filterLane = filters.lane;
    const filterPriority = filters.priority;
    const filterCategory = filters.category;
    const filterSubcategory = filters.subcategory;

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

    const priorityOptions = [
        { value: 'high', label: 'High', icon: '🔴' },
        { value: 'medium', label: 'Medium', icon: '🟡' },
        { value: 'low', label: 'Low', icon: '🔵' },
        { value: 'parked', label: 'Parked', icon: '⏸️' },
    ];

    const filtered = useMemo(() => {
        return projects.filter((p: any) => {
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
    }, [projects, filterLane, filterPriority, filterCategory, filterSubcategory]);

    // Group by tier for pipeline view
    const byTier = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const tier of TIER_ORDER) map[tier] = [];
        for (const p of filtered) {
            const t = p.tier || 'idea';
            if (!map[t]) map[t] = [];
            map[t].push(p);
        }
        const order: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
        for (const t of Object.keys(map)) {
            map[t].sort((a: any, b: any) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
        }
        return map;
    }, [filtered]);

    const renderPipeline = () => (
        <>
            {/* Pipeline stages bar */}
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

            {/* Flow arrow */}
            <div className="flex-row flex-center gap-8 text-base text-tertiary" style={{ margin: '8px 0 20px' }}>
                {TIER_ORDER.map((tier, i) => (
                    <span key={tier}>
                        {TIER_CONFIG[tier as Tier]?.emoji} {TIER_CONFIG[tier as Tier]?.label}
                        {i < TIER_ORDER.length - 1 && <span style={{ margin: '0 4px' }}>→</span>}
                    </span>
                ))}
            </div>

            {/* Project cards by tier */}
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
                            {byTier[tier].map((p: any) => (
                                <div key={p.path} className="section-card-sm" style={{
                                    borderLeft: `3px solid ${cfg?.color || 'var(--border)'}`,
                                }}>
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
                        <thead>
                            <tr>
                                <th>Name</th><th>Tier</th><th>Lane</th><th>Priority</th><th>Category</th><th>Stack</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p: any) => {
                                const segments = p.path.split('/');
                                return (
                                    <tr key={p.path}>
                                        <td><div className="table-name">{p.name}</div></td>
                                        <td><Badge variant="tier" tier={p.tier} /></td>
                                        <td className="text-muted font-medium">{p.lane}</td>
                                        <td><Badge variant="priority" priority={p.priority} /></td>
                                        <td className="text-sm text-tertiary">{segments[0]}{segments.length > 2 ? ` / ${segments[1]}` : ''}</td>
                                        <td>
                                            <div className="flex-row flex-wrap gap-4">
                                                {(p.stack || []).slice(0, 3).map((s: string) => <span key={s} className="stack-tag">{s}</span>)}
                                            </div>
                                        </td>
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
        <div className="grid-auto-180 gap-6 mt-16">
            {filtered.map((p: any) => {
                const cfg = TIER_CONFIG[p.tier as Tier];
                return (
                    <div key={p.path} className="section-card-sm" style={{
                        borderLeft: `3px solid ${cfg?.color || 'var(--border)'}`,
                    }}>
                        <div className="font-semibold text-base truncate">{p.name}</div>
                        <div className="flex-row gap-6 text-tertiary text-sm mt-4">
                            <span>{cfg?.emoji}</span>
                            <span>{p.lane}</span>
                            <span style={{ marginLeft: 'auto' }}>{p.priority}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div>
            <PageHeader
                title="🗺️ Roadmap"
                description="Project lifecycle progression — from Idea to Shipped"
                actions={
                    <div className="flex-row gap-8">
                        <span className="text-base text-tertiary">{filtered.length} projects</span>
                        <button className="btn btn-primary text-base" onClick={() => setShowCreate(true)}>+ New Project</button>
                    </div>
                }
            />

            {/* Filters */}
            <div className="filter-bar flex-row flex-wrap gap-8 mb-16">
                <div className="view-toggle">
                    <button className={`btn ${view === 'pipeline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'pipeline')}>🔀 Pipeline</button>
                    <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'list')}>☰ List</button>
                    <button className={`btn ${view === 'compact' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('view', 'compact')}>⊞ Compact</button>
                </div>
                <SearchableSelect options={categoryOptions} value={filterCategory} onChange={(v) => { setFilter('category', v); setFilter('subcategory', ''); }} placeholder="All Categories" width="170px" />
                {subcategoryOptions.length > 0 && (
                    <SearchableSelect options={subcategoryOptions} value={filterSubcategory} onChange={(v) => setFilter('subcategory', v)} placeholder="All Subcategories" width="170px" />
                )}
                <SearchableSelect options={laneOptions} value={filterLane} onChange={(v) => setFilter('lane', v)} placeholder="All Lanes" width="150px" />
                <SearchableSelect options={priorityOptions} value={filterPriority} onChange={(v) => setFilter('priority', v)} placeholder="All Priorities" width="150px" />
            </div>

            {!data ? (
                <div className="loading"><div className="loading-spinner" /> Loading roadmap...</div>
            ) : view === 'pipeline' ? renderPipeline() : view === 'list' ? renderList() : renderCompact()}

            {showCreate && (
                <CreateProjectModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { refresh(); }}
                    lanes={[...new Set(projects.map((p: any) => p.lane))]}
                />
            )}
        </div>
    );
}
