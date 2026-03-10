import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api as convexApi } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { PageHeader } from '../components/ui';

import { useAuth } from '../hooks/useAuth';

export default function AnalyticsPage() {
    const { orgId } = useAuth();

    const aiStats = useQuery(convexApi.aiLogs.getStats);
    const costSummary = useQuery(convexApi.costs.getCostSummary);
    const taskStats = useQuery(convexApi.tasks.getStats, orgId ? { orgId } : "skip");
    const contentStats = useQuery(convexApi.content.getContentStats);

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
            <div className="flex-row mb-12" style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
                {items.map(([key, count]) => (
                    <div key={key} style={{
                        width: `${(count / total) * 100}%`,
                        background: colors[key] || '#6b7280',
                        minWidth: 2,
                    }} title={`${key}: ${count}`} />
                ))}
            </div>
            <div className="flex-row flex-wrap gap-12">
                {items.map(([key, count]) => (
                    <div key={key} className="flex-row gap-6 text-base">
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[key] || '#6b7280' }} />
                        <span className="text-muted">{key}</span>
                        <span className="font-semibold">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            <PageHeader title="📊 Analytics" description="Overview of AI usage, costs, projects, and activity" />

            {/* Top-level KPIs */}
            <div className="grid-auto gap-12 mb-24">
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

            <div className="grid-2 gap-16">
                {/* Projects by Tier */}
                <div className="section-card">
                    <h3 className="section-header">Projects by Tier</h3>
                    {renderBar(
                        Object.entries(projectsByTier).sort(([, a], [, b]) => b - a),
                        tierColors,
                        projects.length || 1
                    )}
                </div>

                {/* Projects by Lane */}
                <div className="section-card">
                    <h3 className="section-header">Projects by Lane</h3>
                    {renderBar(
                        Object.entries(projectsByLane).sort(([, a], [, b]) => b - a),
                        laneColors,
                        projects.length || 1
                    )}
                </div>

                {/* Task Status */}
                {taskStats && (
                    <div className="section-card">
                        <h3 className="section-header">Task Status</h3>
                        {renderBar(
                            Object.entries(taskStats.byStatus),
                            { todo: '#60a5fa', in_progress: '#fbbf24', done: '#34d399' },
                            taskStats.total || 1
                        )}
                    </div>
                )}

                {/* AI Usage by Day */}
                {aiStats && Object.keys(aiStats.byDay).length > 0 && (
                    <div className="section-card">
                        <h3 className="section-header">AI Calls by Day</h3>
                        <div className="flex-row gap-4" style={{ alignItems: 'flex-end', height: 80 }}>
                            {Object.entries(aiStats.byDay).sort().slice(-14).map(([day, count]) => {
                                const max = Math.max(...Object.values(aiStats.byDay));
                                return (
                                    <div key={day} className="flex-col flex-center gap-4 flex-1">
                                        <div style={{
                                            width: '100%', borderRadius: 3,
                                            background: '#818cf8',
                                            height: `${((count as number) / max) * 60}px`,
                                            minHeight: 4,
                                        }} title={`${day}: ${count} calls`} />
                                        <span className="text-tertiary" style={{ fontSize: 8, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
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
                <div className="section-card mt-16">
                    <h3 className="section-header">Top Technologies</h3>
                    <div className="flex-row flex-wrap gap-8">
                        {Object.entries(techUsage)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 20)
                            .map(([tech, count]) => (
                                <div key={tech} className="flex-row gap-6 text-base" style={{
                                    padding: '4px 10px', borderRadius: 6,
                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                }}>
                                    <span className="font-medium">{tech}</span>
                                    <span className="text-tertiary text-xs font-semibold">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
