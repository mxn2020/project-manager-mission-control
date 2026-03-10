import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData } from '../lib/types';
import { TIER_ORDER, TIER_CONFIG, PRIORITY_ORDER, PRIORITY_CONFIG, LANE_COLORS, type Tier, type Priority } from '../lib/types';
import CreateProjectModal from '../components/CreateProjectModal';
import CloneProjectModal from '../components/CloneProjectModal';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PageHeader, StatCard, Card, Badge } from '../components/ui';

function BarChart({ title, items, colorMap }: { title: string; items: Record<string, number>; colorMap: Record<string, string> }) {
    const maxVal = Math.max(...Object.values(items), 1);
    const sorted = Object.entries(items).sort((a, b) => b[1] - a[1]);
    return (
        <div className="chart-section">
            <div className="chart-title">{title}</div>
            <div className="bar-chart">
                {sorted.map(([label, count]) => (
                    <div className="bar-row" key={label}>
                        <div className="bar-label">{label}</div>
                        <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${Math.max((count / maxVal) * 100, 8)}%`, background: colorMap[label] || 'var(--accent)' }}>
                                <span className="bar-value">{count}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DonutChart({ data, colors, size = 120 }: { data: Record<string, number>; colors: Record<string, string>; size?: number }) {
    const total = Object.values(data).reduce((s, v) => s + v, 0);
    if (total === 0) return null;
    const r = size / 2 - 8;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            {Object.entries(data).map(([key, val]) => {
                const pct = val / total;
                const dashArray = `${circumference * pct} ${circumference * (1 - pct)}`;
                const elem = (
                    <circle key={key} cx={size / 2} cy={size / 2} r={r}
                        fill="none" stroke={colors[key] || '#6b7280'}
                        strokeWidth="12" strokeDasharray={dashArray}
                        strokeDashoffset={-offset} strokeLinecap="round" />
                );
                offset += circumference * pct;
                return elem;
            })}
            <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill="var(--text-primary)"
                fontSize="20" fontWeight="700" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                {total}
            </text>
        </svg>
    );
}

export default function OverviewPage({ data, onNavigate }: { data: StatusData; onNavigate?: (path: string) => void }) {
    const [showCreate, setShowCreate] = useState(false);
    const [showClone, setShowClone] = useState(false);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const handleNewProject = () => {
        if (isMobile) {
            navigate('/projects/new');
        } else {
            setShowCreate(true);
        }
    };

    const tierColors: Record<string, string> = {};
    TIER_ORDER.forEach(t => { tierColors[t] = TIER_CONFIG[t].color; });
    const priorityColors: Record<string, string> = {};
    PRIORITY_ORDER.forEach(p => { priorityColors[p] = PRIORITY_CONFIG[p].color; });
    const ossCount = data.projects.filter(p => p.oss).length;
    const avgHealth = data.projects.length > 0 ? Math.round(data.projects.reduce((s, p) => s + (p.health_score || 0), 0) / data.projects.length) : 0;
    const stackColors = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#a78bfa', '#f87171'];
    const topStacks: Record<string, string> = {};
    Object.entries(data.summary.by_stack).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([s], i) => { topStacks[s] = stackColors[i % stackColors.length]; });

    // Recent projects (by last_active)
    const recentProjects = [...data.projects]
        .filter(p => p.last_active)
        .sort((a, b) => (b.last_active || '').localeCompare(a.last_active || ''))
        .slice(0, 8);

    // Active projects (building tier, high priority)
    const activeProjects = data.projects
        .filter(p => p.tier === 'building' || p.tier === 'prototype')
        .sort((a, b) => {
            const order: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
            return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
        })
        .slice(0, 6);

    return (
        <div>
            <PageHeader
                title="🏠 Mission Control"
                description={`Last scanned: ${new Date(data.generated_at).toLocaleString()}`}
                actions={
                    <div className="flex-row gap-8">
                        <button className="btn btn-secondary text-base" onClick={() => setShowClone(true)}>
                            🔗 Clone Project
                        </button>
                        <button className="btn btn-primary text-base" onClick={handleNewProject}>
                            ✨ New Project
                        </button>
                    </div>
                }
            />

            {/* KPI Row */}
            <div className="stats-row">
                <StatCard label="Total Projects" value={data.total_projects} />
                <StatCard
                    label="Active"
                    value={(data.summary.by_tier.building || 0) + (data.summary.by_tier.prototype || 0)}
                    color={TIER_CONFIG.building.color}
                    sub={`${data.summary.by_tier.building || 0} building · ${data.summary.by_tier.prototype || 0} proto`}
                />
                <StatCard label="Shipped" value={data.summary.by_tier.shipped || 0} color={TIER_CONFIG.shipped.color} />
                <StatCard
                    label="Open Source"
                    value={ossCount}
                    color="var(--success)"
                    sub={`${Math.round((ossCount / (data.total_projects || 1)) * 100)}% of total`}
                />
                <StatCard
                    label="Avg Health"
                    value={avgHealth}
                    color={avgHealth >= 60 ? 'var(--success)' : avgHealth >= 40 ? 'var(--warning)' : 'var(--error)'}
                />
                <StatCard label="Lanes" value={Object.keys(data.summary.by_lane).length} />
            </div>

            {/* Main Grid: Charts + Activity */}
            <div className="grid-2 gap-16 mt-20">
                {/* Left: Donut charts side by side */}
                <Card>
                    <h3 className="section-header">Distribution</h3>
                    <div className="flex-center gap-24">
                        <div className="text-center">
                            <DonutChart data={data.summary.by_tier} colors={tierColors} />
                            <div className="text-sm text-tertiary mt-8">By Tier</div>
                        </div>
                        <div className="text-center">
                            <DonutChart data={data.summary.by_priority} colors={priorityColors} />
                            <div className="text-sm text-tertiary mt-8">By Priority</div>
                        </div>
                    </div>
                    <div className="flex-row flex-wrap gap-8 mt-12" style={{ justifyContent: 'center' }}>
                        {TIER_ORDER.map(t => (
                            <span key={t} className="flex-row gap-4 text-sm">
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_CONFIG[t].color, display: 'inline-block' }} />
                                {TIER_CONFIG[t].label} ({data.summary.by_tier[t] || 0})
                            </span>
                        ))}
                    </div>
                </Card>

                {/* Right: Active projects */}
                <Card>
                    <h3 className="section-header flex-between">
                        🔥 Active Projects
                        <span className="text-sm text-tertiary" style={{ fontWeight: 400 }}>{activeProjects.length} in progress</span>
                    </h3>
                    {activeProjects.length === 0 ? (
                        <div className="text-center text-tertiary text-md" style={{ padding: 20 }}>No active projects</div>
                    ) : (
                        <div className="flex-col gap-6">
                            {activeProjects.map(p => {
                                const cfg = TIER_CONFIG[p.tier as Tier];
                                return (
                                    <div key={p.path} className="list-row" style={{
                                        background: 'var(--bg-primary)', borderRadius: 6, borderLeft: `3px solid ${cfg?.color || '#6b7280'}`,
                                    }}>
                                        <span className="text-lg">{cfg?.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-md truncate">{p.name}</div>
                                            <div className="text-xs text-tertiary">{p.lane}</div>
                                        </div>
                                        <Badge variant="custom" label={p.priority}
                                            color={PRIORITY_CONFIG[p.priority as Priority]?.color}
                                            bg={(PRIORITY_CONFIG[p.priority as Priority]?.color || '#6b7280') + '20'}
                                            size="sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* Second Row: Lane chart + Recent activity */}
            <div className="grid-2 gap-16 mt-16">
                <div className="overview-charts" style={{ margin: 0 }}>
                    <BarChart title="By Lane" items={data.summary.by_lane} colorMap={LANE_COLORS} />
                    <BarChart title="Top Stacks" items={Object.fromEntries(Object.entries(data.summary.by_stack).sort((a, b) => b[1] - a[1]).slice(0, 8))} colorMap={topStacks} />
                </div>

                {/* Recent Activity */}
                <Card>
                    <h3 className="section-header">🕐 Recently Active</h3>
                    {recentProjects.length === 0 ? (
                        <div className="text-center text-tertiary text-md" style={{ padding: 20 }}>No recent activity</div>
                    ) : (
                        <div className="flex-col gap-4">
                            {recentProjects.map(p => (
                                <div key={p.path} className="flex-row gap-10 text-base" style={{ padding: '6px 10px', borderRadius: 4 }}>
                                    <span className="text-base">{TIER_CONFIG[p.tier as Tier]?.emoji || '📦'}</span>
                                    <span className="flex-1 font-medium">{p.name}</span>
                                    <span className="text-xs text-tertiary font-mono">
                                        {p.last_active}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Quick Links */}
            <div className="grid-auto-180 gap-8 mt-16">
                {[
                    { icon: '🗺️', label: 'Roadmap', desc: 'Pipeline view', path: '/roadmap' },
                    { icon: '📋', label: 'Tasks', desc: 'Track work', path: '/tasks' },
                    { icon: '📦', label: 'Repositories', desc: 'Repos & deploy', path: '/repositories' },
                    { icon: '📊', label: 'Analytics', desc: 'Usage & stats', path: '/analytics' },
                    { icon: '📂', label: 'Files', desc: 'Browse sources', path: '/files' },
                    { icon: '🔧', label: 'Admin', desc: 'Configuration', path: '/admin' },
                ].map(q => (
                    <Card key={q.path} onClick={() => onNavigate?.(q.path)}>
                        <div className="text-3xl">{q.icon}</div>
                        <div className="font-semibold text-md mt-4">{q.label}</div>
                        <div className="text-sm text-tertiary">{q.desc}</div>
                    </Card>
                ))}
            </div>

            {showCreate && (
                <CreateProjectModal
                    lanes={Object.keys(data.summary.by_lane)}
                    onClose={() => setShowCreate(false)}
                    onCreated={(newId: string) => {
                        setShowCreate(false);
                        // Navigate to new project page if we got an ID
                        if (newId) navigate(`/project/${encodeURIComponent(newId)}`);
                    }}
                />
            )}

            {showClone && (
                <CloneProjectModal
                    lanes={Object.keys(data.summary.by_lane)}
                    onClose={() => setShowClone(false)}
                    onCreated={(newId: string) => {
                        setShowClone(false);
                        if (newId) navigate(`/project/${encodeURIComponent(newId)}`);
                    }}
                />
            )}
        </div>
    );
}
