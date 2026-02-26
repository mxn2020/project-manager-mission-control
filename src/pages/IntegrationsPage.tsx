import { useState, useEffect, useMemo } from 'react';
import { getAuthHeaders, API_BASE } from '../lib/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect from '../components/SearchableSelect';

interface GitStatus {
    branch: string;
    hasChanges: boolean;
    changedFiles: number;
    lastCommit: string;
    lastCommitDate: string;
}

function hasValue(v: any): boolean {
    return v && v !== 'null' && v !== 'undefined' && v !== '';
}

export default function IntegrationsPage() {
    const { data } = useProjects();
    const projects = data?.projects || [];
    const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({});
    const [loading, setLoading] = useState(false);
    const [filterLane, setFilterLane] = useState('');

    // Correct filtering using hasValue helper
    const deployed = projects.filter((p: any) => hasValue(p.deploy_url));
    const withRepo = projects.filter((p: any) => hasValue(p.repo));
    const withoutRepo = projects.filter((p: any) => !hasValue(p.repo));

    // Filter by lane
    const filteredDeployed = filterLane ? deployed.filter((p: any) => p.lane === filterLane) : deployed;
    const filteredWithRepo = filterLane ? withRepo.filter((p: any) => p.lane === filterLane) : withRepo;
    const filteredWithoutRepo = filterLane ? withoutRepo.filter((p: any) => p.lane === filterLane) : withoutRepo;

    const laneOptions = useMemo(() => {
        const lanes = [...new Set(projects.map((p: any) => p.lane))].sort();
        return lanes.map(l => ({ value: l, label: l }));
    }, [projects]);

    const fetchGitStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/integrations/git-status`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setGitStatuses(data);
            }
        } catch (err) {
            console.error('Failed to fetch git status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projects.length > 0) fetchGitStatus();
    }, [projects.length]);

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">🔗 Integrations</h1>
                        <p className="page-description">GitHub repos, deployment status, and sync overview</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <SearchableSelect
                            options={laneOptions}
                            value={filterLane}
                            onChange={setFilterLane}
                            placeholder="All Lanes"
                            width="160px"
                        />
                        <button className="btn btn-secondary" onClick={fetchGitStatus} disabled={loading} style={{ fontSize: 12 }}>
                            {loading ? '⏳' : '🔄'} Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-value">{projects.length}</div>
                    <div className="stat-label">Total Projects</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#34d399' }}>{withRepo.length}</div>
                    <div className="stat-label">With GitHub Repo</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#60a5fa' }}>{deployed.length}</div>
                    <div className="stat-label">Deployed</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#fbbf24' }}>{withoutRepo.length}</div>
                    <div className="stat-label">No Repo</div>
                </div>
            </div>

            {/* Deployed Projects */}
            {filteredDeployed.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🌐 Deployed Projects
                        <span style={{ background: '#34d39930', color: '#34d399', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{filteredDeployed.length}</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                        {filteredDeployed.map((p: any) => (
                            <div key={p.path || p.name} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                    <a href={p.deploy_url} target="_blank" rel="noreferrer"
                                        style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                                        {p.deploy_url}
                                    </a>
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.tier}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* GitHub Repos */}
            {filteredWithRepo.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🐙 GitHub Repositories
                        <span style={{ background: '#60a5fa30', color: '#60a5fa', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{filteredWithRepo.length}</span>
                    </h3>
                    <div style={{ display: 'grid', gap: 6 }}>
                        {filteredWithRepo.map((p: any) => {
                            const git = gitStatuses[p.path];
                            return (
                                <div key={p.path || p.name} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                                    fontSize: 13,
                                }}>
                                    <span>🐙</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                                        <a href={p.repo} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                                            {p.repo?.replace('https://github.com/', '')}
                                        </a>
                                    </div>
                                    {git && (
                                        <>
                                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                                                🌿 {git.branch}
                                            </span>
                                            {git.hasChanges ? (
                                                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#fbbf2420', color: '#fbbf24' }}>
                                                    {git.changedFiles} changes
                                                </span>
                                            ) : (
                                                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#34d39920', color: '#34d399' }}>
                                                    ✓ clean
                                                </span>
                                            )}
                                        </>
                                    )}
                                    <span style={{
                                        padding: '2px 6px', borderRadius: 4, fontSize: 10,
                                        background: p.tier === 'shipped' ? '#34d39920' : 'var(--bg-primary)',
                                        color: p.tier === 'shipped' ? '#34d399' : 'var(--text-tertiary)',
                                    }}>
                                        {p.tier}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Projects without repos */}
            {filteredWithoutRepo.length > 0 && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠️ No Repository
                        <span style={{ background: '#fbbf2430', color: '#fbbf24', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{filteredWithoutRepo.length}</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                        {filteredWithoutRepo.map((p: any) => (
                            <div key={p.path || p.name} style={{
                                padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
                                border: '1px solid var(--border)', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <span style={{ opacity: 0.5 }}>📦</span>
                                <span style={{ flex: 1 }}>{p.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.tier}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
