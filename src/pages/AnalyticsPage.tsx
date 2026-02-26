import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';

export default function AnalyticsPage() {
    const aiStats = useQuery(api.aiLogs.getStats);
    const costSummary = useQuery(api.costs.getCostSummary);
    const taskStats = useQuery(api.tasks.getTaskStats);
    const contentStats = useQuery(api.content.getContentStats);
    const { data: projectData } = useProjects();

    const projects = projectData?.projects || [];

    // Project activity: count by tier
    const projectsByTier: Record<string, number> = {};
    const projectsByLane: Record<string, number> = {};
    const techUsage: Record<string, number> = {};

    for (const p of projects) {
        projectsByTier[p.tier] = (projectsByTier[p.tier] || 0) + 1;
        projectsByLane[p.lane] = (projectsByLane[p.lane] || 0) + 1;
        for (const t of (p.stack || [])) {
            techUsage[t] = (techUsage[t] || 0) + 1;
        }
    }

    const tierColors: Record<string, string> = {
        idea: '#a78bfa', prototype: '#fbbf24', building: '#34d399',
        shipped: '#60a5fa', maintaining: '#818cf8', archived: '#6b7280',
    };

    const laneColors: Record<string, string> = {
        'minions': '#818cf8', 'claw-platform': '#34d399', 'mehdi-verse': '#fbbf24',
        'oss': '#60a5fa', 'side-projects': '#f472b6', 'client': '#fb923c',
        'infra': '#a78bfa', 'uncategorized': '#6b7280',
    };

    const renderBar = (items: [string, number][], colors: Record<string, string>, total: number) => (
        <div>
            {/* Progress bar */}
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                {items.map(([key, count]) => (
                    <div key={key} style={{
                        width: `${(count / total) * 100}%`,
                        background: colors[key] || '#6b7280',
                        minWidth: 2,
                    }} title={`${key}: ${count}`} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {items.map(([key, count]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[key] || '#6b7280' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📊 Analytics</h1>
                <p className="page-description">Overview of AI usage, costs, projects, and activity</p>
            </div>

            {/* Top-level KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-value">{projects.length}</div>
                    <div className="stat-label">Total Projects</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{aiStats?.totalCalls || 0}</div>
                    <div className="stat-label">AI Calls</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{(aiStats?.totalTokens || 0).toLocaleString()}</div>
                    <div className="stat-label">Tokens Used</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#f87171' }}>${((costSummary?.totalMonthly || 0)).toFixed(2)}</div>
                    <div className="stat-label">Monthly Costs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{taskStats?.total || 0}</div>
                    <div className="stat-label">Total Tasks</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{contentStats?.totalPlans || 0}</div>
                    <div className="stat-label">Content Plans</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Projects by Tier */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Projects by Tier</h3>
                    {renderBar(
                        Object.entries(projectsByTier).sort(([, a], [, b]) => b - a),
                        tierColors,
                        projects.length || 1
                    )}
                </div>

                {/* Projects by Lane */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Projects by Lane</h3>
                    {renderBar(
                        Object.entries(projectsByLane).sort(([, a], [, b]) => b - a),
                        laneColors,
                        projects.length || 1
                    )}
                </div>

                {/* Task Status */}
                {taskStats && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Task Status</h3>
                        {renderBar(
                            Object.entries(taskStats.byStatus),
                            { todo: '#60a5fa', in_progress: '#fbbf24', done: '#34d399' },
                            taskStats.total || 1
                        )}
                    </div>
                )}

                {/* AI Usage by Day */}
                {aiStats && Object.keys(aiStats.byDay).length > 0 && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>AI Calls by Day</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                            {Object.entries(aiStats.byDay).sort().slice(-14).map(([day, count]) => {
                                const max = Math.max(...Object.values(aiStats.byDay));
                                return (
                                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <div style={{
                                            width: '100%', borderRadius: 3,
                                            background: '#818cf8',
                                            height: `${((count as number) / max) * 60}px`,
                                            minHeight: 4,
                                        }} title={`${day}: ${count} calls`} />
                                        <span style={{ fontSize: 8, color: 'var(--text-tertiary)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                                            {day.slice(5)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Top Technologies */}
            {Object.keys(techUsage).length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', marginTop: 16 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Top Technologies</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(techUsage)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 20)
                            .map(([tech, count]) => (
                                <div key={tech} style={{
                                    padding: '4px 10px', borderRadius: 6,
                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                    fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    <span style={{ fontWeight: 500 }}>{tech}</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600 }}>{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
