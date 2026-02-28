import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData } from '../lib/types';
import { TIER_ORDER, TIER_CONFIG, PRIORITY_ORDER, PRIORITY_CONFIG, LANE_COLORS, type Tier, type Priority } from '../lib/types';
import CreateProjectModal from '../components/CreateProjectModal';
import { useIsMobile } from '../hooks/useMediaQuery';

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
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">🏠 Mission Control</h1>
                        <p className="page-description">Last scanned: {new Date(data.generated_at).toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={handleNewProject} style={{ fontSize: 12 }}>
                            ✨ New Project
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-label">Total Projects</div>
                    <div className="stat-value">{data.total_projects}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active</div>
                    <div className="stat-value" style={{ color: TIER_CONFIG.building.color }}>{(data.summary.by_tier.building || 0) + (data.summary.by_tier.prototype || 0)}</div>
                    <div className="stat-sub">{data.summary.by_tier.building || 0} building · {data.summary.by_tier.prototype || 0} proto</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Shipped</div>
                    <div className="stat-value" style={{ color: TIER_CONFIG.shipped.color }}>{data.summary.by_tier.shipped || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Open Source</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{ossCount}</div>
                    <div className="stat-sub">{Math.round((ossCount / (data.total_projects || 1)) * 100)}% of total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Avg Health</div>
                    <div className="stat-value" style={{ color: avgHealth >= 60 ? 'var(--success)' : avgHealth >= 40 ? 'var(--warning)' : 'var(--error)' }}>{avgHealth}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Lanes</div>
                    <div className="stat-value">{Object.keys(data.summary.by_lane).length}</div>
                </div>
            </div>

            {/* Main Grid: Charts + Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
                {/* Left: Donut charts side by side */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Distribution</h3>
                    <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <DonutChart data={data.summary.by_tier} colors={tierColors} />
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>By Tier</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <DonutChart data={data.summary.by_priority} colors={priorityColors} />
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>By Priority</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                        {TIER_ORDER.map(t => (
                            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_CONFIG[t].color, display: 'inline-block' }} />
                                {TIER_CONFIG[t].label} ({data.summary.by_tier[t] || 0})
                            </span>
                        ))}
                    </div>
                </div>

                {/* Right: Active projects */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                        🔥 Active Projects
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{activeProjects.length} in progress</span>
                    </h3>
                    {activeProjects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>No active projects</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {activeProjects.map(p => {
                                const cfg = TIER_CONFIG[p.tier as Tier];
                                return (
                                    <div key={p.path} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                        background: 'var(--bg-primary)', borderRadius: 6, borderLeft: `3px solid ${cfg?.color || '#6b7280'}`,
                                    }}>
                                        <span style={{ fontSize: 14 }}>{cfg?.emoji}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.lane}</div>
                                        </div>
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 4, fontSize: 10,
                                            background: PRIORITY_CONFIG[p.priority as Priority]?.color + '20',
                                            color: PRIORITY_CONFIG[p.priority as Priority]?.color,
                                        }}>{p.priority}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Second Row: Lane chart + Recent activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <div className="overview-charts" style={{ margin: 0 }}>
                    <BarChart title="By Lane" items={data.summary.by_lane} colorMap={LANE_COLORS} />
                    <BarChart title="Top Stacks" items={Object.fromEntries(Object.entries(data.summary.by_stack).sort((a, b) => b[1] - a[1]).slice(0, 8))} colorMap={topStacks} />
                </div>

                {/* Recent Activity */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>🕐 Recently Active</h3>
                    {recentProjects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>No recent activity</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {recentProjects.map(p => (
                                <div key={p.path} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                                    borderRadius: 4, fontSize: 12,
                                }}>
                                    <span style={{ fontSize: 12 }}>{TIER_CONFIG[p.tier as Tier]?.emoji || '📦'}</span>
                                    <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                                        {p.last_active}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {[
                    { icon: '🗺️', label: 'Roadmap', desc: 'Pipeline view', path: '/roadmap' },
                    { icon: '📋', label: 'Tasks', desc: 'Track work', path: '/tasks' },
                    { icon: '🔗', label: 'Integrations', desc: 'Repos & deploy', path: '/integrations' },
                    { icon: '📊', label: 'Analytics', desc: 'Usage & stats', path: '/analytics' },
                    { icon: '📂', label: 'Files', desc: 'Browse sources', path: '/files' },
                    { icon: '🔧', label: 'Admin', desc: 'Configuration', path: '/admin' },
                ].map(q => (
                    <div key={q.path} onClick={() => onNavigate?.(q.path)} style={{
                        padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 8,
                        border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                        <div style={{ fontSize: 20 }}>{q.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{q.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{q.desc}</div>
                    </div>
                ))}
            </div>

            {showCreate && (
                <CreateProjectModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => window.location.reload()}
                    lanes={[...new Set(data.projects.map(p => p.lane))]}
                />
            )}
        </div>
    );
}
