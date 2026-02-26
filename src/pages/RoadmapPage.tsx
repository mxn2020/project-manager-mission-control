import { useState, useMemo } from 'react';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect from '../components/SearchableSelect';
import { TIER_CONFIG, TIER_ORDER, type Tier } from '../lib/types';

type RoadmapView = 'pipeline' | 'list' | 'compact';

export default function RoadmapPage() {
    const { data } = useProjects();
    const projects = data?.projects || [];
    const [filterLane, setFilterLane] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSubcategory, setFilterSubcategory] = useState('');
    const [view, setView] = useState<RoadmapView>('pipeline');

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
        // Sort within tier by priority
        const order: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
        for (const t of Object.keys(map)) {
            map[t].sort((a: any, b: any) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
        }
        return map;
    }, [filtered]);

    const renderPipeline = () => (
        <>
            {/* Pipeline stages bar */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TIER_ORDER.length}, 1fr)`, gap: 4, marginBottom: 8 }}>
                {TIER_ORDER.map(tier => {
                    const cfg = TIER_CONFIG[tier as Tier];
                    const count = byTier[tier]?.length || 0;
                    return (
                        <div key={tier} style={{
                            textAlign: 'center', padding: '12px 8px', borderRadius: 8,
                            background: cfg?.bg || 'var(--bg-secondary)', border: `1px solid ${cfg?.color || 'var(--border)'}30`,
                        }}>
                            <div style={{ fontSize: 18 }}>{cfg?.emoji}</div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: cfg?.color }}>{cfg?.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{count}</div>
                        </div>
                    );
                })}
            </div>

            {/* Flow arrow */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '8px 0 20px', fontSize: 12, color: 'var(--text-tertiary)' }}>
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
                    <div key={tier} style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {cfg?.emoji} {cfg?.label}
                            <span style={{ background: (cfg?.color || '#666') + '25', color: cfg?.color, padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                                {byTier[tier].length}
                            </span>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                            {byTier[tier].map((p: any) => (
                                <div key={p.path} style={{
                                    padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
                                    border: '1px solid var(--border)', fontSize: 12,
                                    borderLeft: `3px solid ${cfg?.color || 'var(--border)'}`,
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.name}</div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.lane}</span>
                                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>{p.priority}</span>
                                    </div>
                                    {p.stack?.length > 0 && (
                                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                            {p.stack.slice(0, 3).map((s: string) => (
                                                <span key={s} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>{s}</span>
                                            ))}
                                            {p.stack.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{p.stack.length - 3}</span>}
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
        <div style={{ marginTop: 16 }}>
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🗺️</div>
                    <div className="empty-state-text">No projects match filters</div>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Name</th>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Tier</th>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Lane</th>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Priority</th>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Category</th>
                            <th style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Stack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((p: any) => {
                            const cfg = TIER_CONFIG[p.tier as Tier];
                            const segments = p.path.split('/');
                            return (
                                <tr key={p.path} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{p.name}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{ color: cfg?.color }}>{cfg?.emoji} {cfg?.label}</span>
                                    </td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{p.lane}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'var(--bg-secondary)' }}>{p.priority}</span>
                                    </td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11 }}>
                                        {segments[0]}{segments.length > 2 ? ` / ${segments[1]}` : ''}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                            {(p.stack || []).slice(0, 3).map((s: string) => (
                                                <span key={s} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-secondary)' }}>{s}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );

    const renderCompact = () => (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {filtered.map((p: any) => {
                const cfg = TIER_CONFIG[p.tier as Tier];
                return (
                    <div key={p.path} style={{
                        padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6,
                        border: '1px solid var(--border)', borderLeft: `3px solid ${cfg?.color || 'var(--border)'}`,
                        fontSize: 11,
                    }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 6 }}>
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
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">🗺️ Roadmap</h1>
                        <p className="page-description">Project lifecycle progression — from Idea to Shipped</p>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} projects</span>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button className={view === 'pipeline' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('pipeline')} style={{ borderRadius: 0, fontSize: 12 }}>🔀 Pipeline</button>
                    <button className={view === 'list' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('list')} style={{ borderRadius: 0, fontSize: 12 }}>☰ List</button>
                    <button className={view === 'compact' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('compact')} style={{ borderRadius: 0, fontSize: 12 }}>⊞ Compact</button>
                </div>
                <SearchableSelect options={categoryOptions} value={filterCategory} onChange={(v) => { setFilterCategory(v); setFilterSubcategory(''); }} placeholder="All Categories" width="170px" />
                {subcategoryOptions.length > 0 && (
                    <SearchableSelect options={subcategoryOptions} value={filterSubcategory} onChange={setFilterSubcategory} placeholder="All Subcategories" width="170px" />
                )}
                <SearchableSelect options={laneOptions} value={filterLane} onChange={setFilterLane} placeholder="All Lanes" width="150px" />
                <SearchableSelect options={priorityOptions} value={filterPriority} onChange={setFilterPriority} placeholder="All Priorities" width="150px" />
            </div>

            {!data ? (
                <div className="loading"><div className="loading-spinner" /> Loading roadmap...</div>
            ) : view === 'pipeline' ? renderPipeline() : view === 'list' ? renderList() : renderCompact()}
        </div>
    );
}
