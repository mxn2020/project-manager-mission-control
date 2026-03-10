import { useState, useEffect, useMemo } from 'react';

import { useProjects } from '../hooks/useProjects';
import SearchableSelect from '../components/SearchableSelect';
import toast from 'react-hot-toast'

interface GitStatus {
    branch: string;
    hasChanges: boolean;
    changedFiles: number;
    lastCommit: string;
    lastCommitDate: string;
}

interface CloneStatus {
    status: 'not_cloned' | 'cloning' | 'cloned' | 'error';
    repo?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}

function hasValue(v: any): boolean {
    return v && v !== 'null' && v !== 'undefined' && v !== '';
}

export default function IntegrationsPage() {
    const { data } = useProjects();
    const projects = data?.projects || [];
    const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({});
    const [cloneStatuses, setCloneStatuses] = useState<Record<string, CloneStatus>>({});
    const [loading, setLoading] = useState(false);
    const [cloning, setCloning] = useState<Set<string>>(new Set());
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
        setLoading(false);
        setGitStatuses({});
    };

    const fetchCloneStatuses = async () => {
        setCloneStatuses({});
    };

    useEffect(() => {
        if (projects.length > 0) {
            fetchGitStatus();
            fetchCloneStatuses();
        }
    }, [projects.length]);

    const handleClone = async (projectPath: string, repo?: string) => {
        toast.error("Local git cloning has been deprecated in favor of the upcoming GitHub integration.");
    };

    const getCloneStatusBadge = (projectPath: string) => {
        const status = cloneStatuses[projectPath];
        if (!status || status.status === 'not_cloned') return null;
        const styles: Record<string, { bg: string; color: string; label: string }> = {
            cloned: { bg: '#34d39920', color: '#34d399', label: '✓ cloned' },
            cloning: { bg: '#60a5fa20', color: '#60a5fa', label: '⏳ cloning' },
            error: { bg: '#f8717120', color: '#f87171', label: '✗ error' },
        };
        const s = styles[status.status] || styles.error;
        return (
            <span title={status.error || ''} className="text-xs" style={{
                padding: '1px 6px', borderRadius: 4, background: s.bg, color: s.color,
            }}>
                {s.label}
            </span>
        );
    };

    const clonedCount = Object.values(cloneStatuses).filter(s => s.status === 'cloned').length;

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">🔗 Integrations</h1>
                        <p className="page-description">GitHub repos, deployment status, and sync overview</p>
                    </div>
                    <div className="flex-row gap-8">
                        <SearchableSelect
                            options={laneOptions}
                            value={filterLane}
                            onChange={setFilterLane}
                            placeholder="All Lanes"
                            width="160px"
                        />
                        <button className="btn btn-secondary text-base" onClick={() => { fetchGitStatus(); fetchCloneStatuses(); }} disabled={loading}>
                            {loading ? '⏳' : '🔄'} Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="mb-24" style={{ padding: 16, background: 'rgba(251,191,36,0.1)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)' }}>
                <div className="font-semibold text-md mb-4" style={{ color: '#fbbf24' }}>🔒 Local Git Integrations Deprecated</div>
                <div className="text-base text-muted">
                    This feature is being rewritten to integrate directly with GitHub. Local git status checks and cloning via the Express server are no longer supported.
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid-auto gap-12 mb-24">
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
                    <div className="stat-value" style={{ color: '#818cf8' }}>{clonedCount}</div>
                    <div className="stat-label">Cloned Locally</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#fbbf24' }}>{withoutRepo.length}</div>
                    <div className="stat-label">No Repo</div>
                </div>
            </div>

            {/* Deployed Projects */}
            {filteredDeployed.length > 0 && (
                <div className="mb-24">
                    <h3 className="flex-row gap-8 text-lg mb-12">
                        🌐 Deployed Projects
                        <span className="text-sm" style={{ background: '#34d39930', color: '#34d399', padding: '2px 8px', borderRadius: 10 }}>{filteredDeployed.length}</span>
                    </h3>
                    <div className="gap-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {filteredDeployed.map((p: any) => (
                            <div key={p.path || p.name} className="flex-row gap-12" style={{
                                padding: '12px 16px', alignItems: 'center',
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                                <div className="flex-1">
                                    <div className="font-semibold text-md">{p.name}</div>
                                    <a href={p.deploy_url} target="_blank" rel="noreferrer"
                                        className="text-sm" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                        {p.deploy_url}
                                    </a>
                                </div>
                                {getCloneStatusBadge(p.path)}
                                <span className="text-xs text-tertiary">{p.tier}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* GitHub Repos */}
            {filteredWithRepo.length > 0 && (
                <div className="mb-24">
                    <h3 className="flex-row gap-8 text-lg mb-12">
                        🐙 GitHub Repositories
                        <span className="text-sm" style={{ background: '#60a5fa30', color: '#60a5fa', padding: '2px 8px', borderRadius: 10 }}>{filteredWithRepo.length}</span>
                    </h3>
                    <div className="flex-col gap-6">
                        {filteredWithRepo.map((p: any) => {
                            const git = gitStatuses[p.path];
                            const cs = cloneStatuses[p.path];
                            const isCloned = cs?.status === 'cloned';
                            const isCloning = cs?.status === 'cloning' || cloning.has(p.path);
                            return (
                                <div key={p.path || p.name} className="flex-row gap-12 text-md" style={{
                                    padding: '10px 16px', alignItems: 'center',
                                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                                }}>
                                    <span>🐙</span>
                                    <div className="flex-1">
                                        <div className="font-medium">{p.name}</div>
                                        <a href={p.repo} target="_blank" rel="noreferrer"
                                            className="text-sm" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                            {p.repo?.replace('https://github.com/', '')}
                                        </a>
                                    </div>
                                    {git && (
                                        <>
                                            <span className="text-xs font-mono text-tertiary">
                                                🌿 {git.branch}
                                            </span>
                                            {git.hasChanges ? (
                                                <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: '#fbbf2420', color: '#fbbf24' }}>
                                                    {git.changedFiles} changes
                                                </span>
                                            ) : (
                                                <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: '#34d39920', color: '#34d399' }}>
                                                    ✓ clean
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {getCloneStatusBadge(p.path)}
                                    {!isCloned && (
                                        <button
                                            onClick={() => handleClone(p.path, p.repo)}
                                            disabled={isCloning}
                                            className="text-xs font-semibold" style={{
                                                padding: '3px 10px', borderRadius: 6,
                                                background: isCloning ? '#60a5fa20' : '#818cf820',
                                                color: isCloning ? '#60a5fa' : '#818cf8',
                                                border: '1px solid transparent', cursor: isCloning ? 'wait' : 'pointer',
                                            }}
                                        >
                                            {isCloning ? '⏳ Cloning...' : '📥 Clone'}
                                        </button>
                                    )}
                                    {isCloned && !git && (
                                        <button
                                            onClick={() => handleClone(p.path, p.repo)}
                                            disabled={isCloning}
                                            className="text-xs font-semibold" style={{
                                                padding: '3px 10px', borderRadius: 6,
                                                background: '#34d39915', color: '#34d399',
                                                border: '1px solid transparent', cursor: 'pointer',
                                            }}
                                        >
                                            🔄 Pull
                                        </button>
                                    )}
                                    <span className="text-xs" style={{
                                        padding: '2px 6px', borderRadius: 4,
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
                    <h3 className="flex-row gap-8 text-lg mb-12">
                        ⚠️ No Repository
                        <span className="text-sm" style={{ background: '#fbbf2430', color: '#fbbf24', padding: '2px 8px', borderRadius: 10 }}>{filteredWithoutRepo.length}</span>
                    </h3>
                    <div className="gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                        {filteredWithoutRepo.map((p: any) => (
                            <div key={p.path || p.name} className="flex-row gap-8 text-base" style={{
                                padding: '8px 14px', alignItems: 'center',
                                background: 'var(--bg-secondary)', borderRadius: 8,
                                border: '1px solid var(--border)',
                            }}>
                                <span className="opacity-50">📦</span>
                                <span className="flex-1">{p.name}</span>
                                {getCloneStatusBadge(p.path)}
                                <span className="text-xs text-tertiary">{p.tier}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
