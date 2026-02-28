import { useState, useEffect } from 'react';
import { api as restApi, getAuthHeaders, API_BASE } from '../lib/api';

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
        fetch(`${API_BASE}/api/dependencies`, { headers: { ...getAuthHeaders() } })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(setData)
            .catch(() => { })
            .finally(() => setLoading(false));

        // Also load last automation status
        fetch(`${API_BASE}/api/automation/status`, { headers: { ...getAuthHeaders() } })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(r => { if (r.startedAt) setAutomationResult(r); })
            .catch(() => { });
    }, []);

    const runAutomation = async () => {
        setRunningAutomation(true);
        try {
            const res = await fetch(`${API_BASE}/api/automation/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            });
            const result = await res.json();
            setAutomationResult(result);
        } catch (err) {
            console.error(err);
        }
        setRunningAutomation(false);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">🔗 Dependencies & Automation</h1>
                        <p className="page-description">Cross-project dependency analysis and portfolio automation</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={runAutomation}
                        disabled={runningAutomation}
                        style={{ fontSize: 12 }}
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
            <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button className={view === 'shared' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('shared')} style={{ borderRadius: 0, fontSize: 12 }}>📊 Shared Deps</button>
                    <button className={view === 'projects' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('projects')} style={{ borderRadius: 0, fontSize: 12 }}>📁 By Project</button>
                    <button className={view === 'versions' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('versions')} style={{ borderRadius: 0, fontSize: 12 }}>🔄 Automation</button>
                </div>
                {view !== 'versions' && (
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="🔍 Search packages..."
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12, flex: 1, minWidth: 150 }}
                    />
                )}
            </div>

            {/* Shared Dependencies View */}
            {view === 'shared' && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: selectedDep ? '1fr 1fr' : '1fr', gap: 16 }}>
                        <div>
                            {filteredShared.map(dep => {
                                const maxCount = data.summary.topShared[0]?.count || 1;
                                return (
                                    <div
                                        key={dep.name}
                                        onClick={() => setSelectedDep(selectedDep === dep.name ? null : dep.name)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                            background: selectedDep === dep.name ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                                            borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                                            border: selectedDep === dep.name ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, minWidth: 180 }}>{dep.name}</span>
                                        <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                            <div style={{ width: `${(dep.count / maxCount) * 100}%`, height: '100%', background: '#818cf8', borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{dep.count}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>projects</span>
                                        {dep.versions.length > 1 && (
                                            <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                                                {dep.versions.length} versions
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Detail panel */}
                        {selectedPkg && (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', position: 'sticky', top: 20, alignSelf: 'start' }}>
                                <h3 style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: 16 }}>{selectedDep}</h3>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                                    Used by {selectedPkg.usedBy.length} project{selectedPkg.usedBy.length > 1 ? 's' : ''} · {selectedPkg.versions.length} version{selectedPkg.versions.length > 1 ? 's' : ''}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Versions</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                                    {selectedPkg.versions.map(v => (
                                        <span key={v} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace' }}>{v}</span>
                                    ))}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Used By</div>
                                {selectedPkg.usedBy.map(p => {
                                    const node = data.nodes.find(n => n.id === p);
                                    return (
                                        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: 'var(--bg-primary)' }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[node?.tier || ''] || '#6b7280' }} />
                                            <span style={{ fontSize: 12, fontWeight: 500 }}>{node?.name || p}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{node?.tier}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* By Project View */}
            {view === 'projects' && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {data.nodes
                        .filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.deps.some(d => d.name.toLowerCase().includes(search.toLowerCase())))
                        .sort((a, b) => b.depCount - a.depCount)
                        .map(node => (
                            <div key={node.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', borderLeft: `3px solid ${TIER_COLORS[node.tier] || '#6b7280'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{node.name}</div>
                                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: (TIER_COLORS[node.tier] || '#6b7280') + '20', color: TIER_COLORS[node.tier] || '#6b7280' }}>{node.tier}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{node.depCount} dependencies · {node.lane}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {node.deps.slice(0, 12).map(d => (
                                        <span key={d.name} style={{
                                            padding: '1px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace',
                                            background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                            cursor: 'pointer',
                                        }}
                                            onClick={() => { setSelectedDep(d.name); setView('shared'); }}
                                        >{d.name}</span>
                                    ))}
                                    {node.deps.length > 12 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{node.deps.length - 12} more</span>}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Automation View */}
            {view === 'versions' && (
                <div style={{ marginTop: 16 }}>
                    {!automationResult ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🤖</div>
                            <div className="empty-state-text">No automation run yet. Click "Run Automation" to start.</div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                                Last run: {new Date(automationResult.startedAt).toLocaleString()}
                                {automationResult.completedAt && ` · Completed: ${new Date(automationResult.completedAt).toLocaleString()}`}
                            </div>

                            {automationResult.steps?.map((step: any) => (
                                <div key={step.name} style={{
                                    background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 12,
                                    border: '1px solid var(--border)', borderLeft: `3px solid ${step.status === 'success' ? '#34d399' : '#f87171'}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>
                                            {step.name === 'scan' ? '🔍 Project Scan' :
                                                step.name === 'stale_detection' ? '⏰ Stale Detection' :
                                                    step.name === 'git_status' ? '📂 Git Status' :
                                                        step.name === 'health_overview' ? '💪 Health Overview' : step.name}
                                        </div>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 4, fontSize: 10,
                                            background: step.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                                            color: step.status === 'success' ? '#34d399' : '#f87171',
                                        }}>{step.status}</span>
                                    </div>

                                    {step.name === 'scan' && <div style={{ fontSize: 12 }}>Scanned {step.projects} projects</div>}

                                    {step.name === 'stale_detection' && (
                                        <div>
                                            <div style={{ fontSize: 12, marginBottom: 8 }}>{step.staleCount} stale projects ({'>'} 30 days)</div>
                                            {step.staleProjects?.slice(0, 10).map((p: any) => (
                                                <div key={p.path} style={{ fontSize: 11, padding: '4px 0', color: 'var(--text-secondary)' }}>
                                                    ⚠️ {p.name} ({p.tier}) — {p.lastActive || 'never active'}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {step.name === 'git_status' && (
                                        <div>
                                            <div style={{ fontSize: 12, marginBottom: 8 }}>{step.dirtyCount} repos with uncommitted changes</div>
                                            {step.dirtyProjects?.map((p: any) => (
                                                <div key={p.path} style={{ fontSize: 11, padding: '4px 0', color: 'var(--text-secondary)' }}>
                                                    📝 {p.name} — {p.changes} changed files
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {step.name === 'health_overview' && step.buckets && (
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {Object.entries(step.buckets).map(([key, count]) => (
                                                <div key={key} style={{ textAlign: 'center' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 18 }}>{count as number}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{key}</div>
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
