import { useState, useEffect } from 'react';


interface DepNode {
    id: string;
    name: string;
    tier: string;
    lane: string;
    depCount: number;
    deps: { name: string; version: string }[];
}

interface SharedDep {
    name: string;
    count: number;
    versions: string[];
}

interface DepData {
    nodes: DepNode[];
    packages: Record<string, { name: string; usedBy: string[]; versions: string[] }>;
    summary: {
        totalProjects: number;
        totalPackages: number;
        sharedPackages: number;
        topShared: SharedDep[];
        avgDeps: number;
    };
}

const TIER_COLORS: Record<string, string> = {
    idea: '#a78bfa', prototype: '#fbbf24', building: '#34d399',
    shipped: '#60a5fa', maintaining: '#818cf8', archived: '#6b7280',
};

export default function DependencyGraphPage() {
    const [data, setData] = useState<DepData | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedDep, setSelectedDep] = useState<string | null>(null);
    const [view, setView] = useState<'shared' | 'projects' | 'versions'>('shared');
    const [automationResult, setAutomationResult] = useState<any>(null);
    const [runningAutomation, setRunningAutomation] = useState(false);

    useEffect(() => {
        // Return mock data indicating deprecation
        setData({
            nodes: [], packages: {},
            summary: { totalProjects: 0, totalPackages: 0, sharedPackages: 0, topShared: [], avgDeps: 0 }
        });
        setLoading(false);
    }, []);

    const runAutomation = async () => {
        setRunningAutomation(true);
        setTimeout(() => {
            setAutomationResult({
                startedAt: Date.now(),
                completedAt: Date.now(),
                steps: [{ name: 'deprecation_notice', status: 'error' }]
            });
            setRunningAutomation(false);
        }, 1000);
    };

    if (loading) return <div className="loading"><div className="loading-spinner" /> Loading dependency data...</div>;
    if (!data) return <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">Failed to load dependencies</div></div>;

    const filteredShared = (data.summary.topShared || []).filter(d =>
        !search || d.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedPkg = selectedDep ? data.packages[selectedDep] : null;

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">🔗 Dependencies & Automation</h1>
                        <p className="page-description">Cross-project dependency analysis and portfolio automation</p>
                    </div>
                    <button
                        className="btn btn-primary text-base"
                        onClick={runAutomation}
                        disabled={runningAutomation}
                    >
                        {runningAutomation ? '⏳ Running...' : '🚀 Run Automation'}
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{data.summary.totalProjects}</div>
                    <div className="stat-label">Projects w/ deps</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{data.summary.totalPackages.toLocaleString()}</div>
                    <div className="stat-label">Total Packages</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#818cf8' }}>{data.summary.sharedPackages}</div>
                    <div className="stat-label">Shared Across</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{data.summary.avgDeps}</div>
                    <div className="stat-label">Avg Deps/Project</div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="filter-bar flex-row flex-wrap gap-8">
                <div className="flex-row" style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button className={view === 'shared' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('shared')} style={{ borderRadius: 0, fontSize: 12 }}>📊 Shared Deps</button>
                    <button className={view === 'projects' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('projects')} style={{ borderRadius: 0, fontSize: 12 }}>📁 By Project</button>
                    <button className={view === 'versions' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('versions')} style={{ borderRadius: 0, fontSize: 12 }}>🔄 Automation</button>
                </div>
                {view !== 'versions' && (
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="🔍 Search packages..."
                        className="form-input-sm flex-1" style={{ minWidth: 150, background: 'var(--bg-secondary)' }}
                    />
                )}
            </div>

            {/* Shared Dependencies View */}
            {view === 'shared' && (
                <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: selectedDep ? '1fr 1fr' : '1fr', gap: 16 }}>
                    <div>
                        {filteredShared.map(dep => {
                            const maxCount = data.summary.topShared[0]?.count || 1;
                            return (
                                <div
                                    key={dep.name}
                                    onClick={() => setSelectedDep(selectedDep === dep.name ? null : dep.name)}
                                    className="flex-row gap-12 mb-4" style={{
                                        padding: '10px 14px', alignItems: 'center', cursor: 'pointer', borderRadius: 8,
                                        background: selectedDep === dep.name ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                                        border: selectedDep === dep.name ? '1px solid var(--accent)' : '1px solid var(--border)',
                                    }}
                                >
                                    <span className="font-mono text-base font-semibold" style={{ minWidth: 180 }}>{dep.name}</span>
                                    <div className="flex-1" style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                        <div style={{ width: `${(dep.count / maxCount) * 100}%`, height: '100%', background: '#818cf8', borderRadius: 4 }} />
                                    </div>
                                    <span className="text-base font-semibold" style={{ minWidth: 30, textAlign: 'right' }}>{dep.count}</span>
                                    <span className="text-xs text-tertiary">projects</span>
                                    {dep.versions.length > 1 && (
                                        <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                                            {dep.versions.length} versions
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail panel */}
                    {selectedPkg && (
                        <div className="section-card" style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
                            <h3 className="font-mono text-xl mb-12" style={{ margin: 0 }}>{selectedDep}</h3>
                            <div className="text-sm text-tertiary mb-12">
                                Used by {selectedPkg.usedBy.length} project{selectedPkg.usedBy.length > 1 ? 's' : ''} · {selectedPkg.versions.length} version{selectedPkg.versions.length > 1 ? 's' : ''}
                            </div>
                            <div className="section-label mb-8">Versions</div>
                            <div className="flex-row flex-wrap gap-6 mb-16">
                                {selectedPkg.versions.map(v => (
                                    <span key={v} className="tag font-mono">{v}</span>
                                ))}
                            </div>
                            <div className="section-label mb-8">Used By</div>
                            {selectedPkg.usedBy.map(p => {
                                const node = data.nodes.find(n => n.id === p);
                                return (
                                    <div key={p} className="flex-row gap-8 mb-4" style={{
                                        padding: '6px 10px', borderRadius: 6, alignItems: 'center',
                                        background: 'var(--bg-primary)',
                                    }}>
                                        <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[node?.tier || ''] || '#6b7280' }} />
                                        <span className="text-base font-medium">{node?.name || p}</span>
                                        <span className="text-xs text-tertiary" style={{ marginLeft: 'auto' }}>{node?.tier}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* By Project View */}
            {view === 'projects' && (
                <div className="mt-16 gap-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {data.nodes
                        .filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.deps.some(d => d.name.toLowerCase().includes(search.toLowerCase())))
                        .sort((a, b) => b.depCount - a.depCount)
                        .map(node => (
                            <div key={node.id} style={{
                                background: 'var(--bg-secondary)', borderRadius: 10, padding: 16,
                                border: '1px solid var(--border)', borderLeft: `3px solid ${TIER_COLORS[node.tier] || '#6b7280'}`,
                            }}>
                                <div className="flex-between mb-8">
                                    <div className="font-semibold text-lg">{node.name}</div>
                                    <span className="text-xs" style={{ padding: '2px 8px', borderRadius: 4, background: (TIER_COLORS[node.tier] || '#6b7280') + '20', color: TIER_COLORS[node.tier] || '#6b7280' }}>{node.tier}</span>
                                </div>
                                <div className="text-sm text-tertiary mb-8">{node.depCount} dependencies · {node.lane}</div>
                                <div className="flex-row flex-wrap gap-4">
                                    {node.deps.slice(0, 12).map(d => (
                                        <span key={d.name} className="text-xs font-mono" style={{
                                            padding: '1px 6px', borderRadius: 4,
                                            background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                            cursor: 'pointer',
                                        }}
                                            onClick={() => { setSelectedDep(d.name); setView('shared'); }}
                                        >{d.name}</span>
                                    ))}
                                    {node.deps.length > 12 && <span className="text-xs text-tertiary">+{node.deps.length - 12} more</span>}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Automation View */}
            {view === 'versions' && (
                <div className="mt-16">
                    {!automationResult ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🤖</div>
                            <div className="empty-state-text">No automation run yet. Click "Run Automation" to start.</div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-sm text-tertiary mb-16">
                                Last run: {new Date(automationResult.startedAt).toLocaleString()}
                                {automationResult.completedAt && ` · Completed: ${new Date(automationResult.completedAt).toLocaleString()}`}
                            </div>

                            {automationResult.steps?.map((step: any) => (
                                <div key={step.name} className="mb-12" style={{
                                    background: 'var(--bg-secondary)', borderRadius: 10, padding: 16,
                                    border: '1px solid var(--border)', borderLeft: `3px solid ${step.status === 'success' ? '#34d399' : '#f87171'}`,
                                }}>
                                    <div className="flex-between mb-8">
                                        <div className="font-semibold text-lg" style={{ textTransform: 'capitalize' }}>
                                            {step.name === 'scan' ? '🔍 Project Scan' :
                                                step.name === 'stale_detection' ? '⏰ Stale Detection' :
                                                    step.name === 'git_status' ? '📂 Git Status' :
                                                        step.name === 'health_overview' ? '💪 Health Overview' : step.name}
                                        </div>
                                        <span className="text-xs" style={{
                                            padding: '2px 8px', borderRadius: 4,
                                            background: step.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                                            color: step.status === 'success' ? '#34d399' : '#f87171',
                                        }}>{step.status}</span>
                                    </div>

                                    {step.name === 'scan' && <div className="text-base">Scanned {step.projects} projects</div>}

                                    {step.name === 'stale_detection' && (
                                        <div>
                                            <div className="text-base mb-8">{step.staleCount} stale projects ({'>'} 30 days)</div>
                                            {step.staleProjects?.slice(0, 10).map((p: any) => (
                                                <div key={p.path} className="text-sm text-muted" style={{ padding: '4px 0' }}>
                                                    ⚠️ {p.name} ({p.tier}) — {p.lastActive || 'never active'}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {step.name === 'git_status' && (
                                        <div>
                                            <div className="text-base mb-8">{step.dirtyCount} repos with uncommitted changes</div>
                                            {step.dirtyProjects?.map((p: any) => (
                                                <div key={p.path} className="text-sm text-muted" style={{ padding: '4px 0' }}>
                                                    📝 {p.name} — {p.changes} changed files
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {step.name === 'health_overview' && step.buckets && (
                                        <div className="flex-row flex-wrap gap-12">
                                            {Object.entries(step.buckets).map(([key, count]) => (
                                                <div key={key} className="text-center">
                                                    <div className="font-semibold text-2xl">{count as number}</div>
                                                    <div className="text-xs text-tertiary" style={{ textTransform: 'capitalize' }}>{key}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
