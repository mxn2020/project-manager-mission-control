import { useProjects } from '../hooks/useProjects';
import { useState } from 'react';

const TIER_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
    idea: { label: 'Idea', emoji: '💡', color: '#a78bfa' },
    prototype: { label: 'Prototype', emoji: '🧪', color: '#fbbf24' },
    building: { label: 'Building', emoji: '🏗️', color: '#34d399' },
    shipped: { label: 'Shipped', emoji: '🚀', color: '#60a5fa' },
    maintaining: { label: 'Maintaining', emoji: '🔧', color: '#818cf8' },
    archived: { label: 'Archived', emoji: '📦', color: '#6b7280' },
};

const TIER_ORDER = ['idea', 'prototype', 'building', 'shipped', 'maintaining', 'archived'];

export default function RoadmapPage() {
    const { data, loading } = useProjects();
    const [filterLane, setFilterLane] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');

    const projects = data?.projects || [];
    const lanes = [...new Set(projects.map((p: any) => p.lane))].sort();

    const filtered = projects.filter((p: any) => {
        if (filterLane !== 'all' && p.lane !== filterLane) return false;
        if (filterPriority !== 'all' && p.priority !== filterPriority) return false;
        return true;
    });

    // Group by tier
    const byTier: Record<string, any[]> = {};
    for (const tier of TIER_ORDER) byTier[tier] = [];
    for (const p of filtered) {
        const tier = p.tier || 'idea';
        if (!byTier[tier]) byTier[tier] = [];
        byTier[tier].push(p);
    }

    if (loading) return <div className="loading"><div className="loading-spinner" /> Loading roadmap...</div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🗺️ Roadmap</h1>
                <p className="page-description">Project lifecycle progression — from Idea to Shipped</p>
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={filterLane} onChange={e => setFilterLane(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12 }}>
                    <option value="all">All Lanes</option>
                    {lanes.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12 }}>
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} projects</span>
            </div>

            {/* Tier Pipeline */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
                {TIER_ORDER.map(tier => {
                    const cfg = TIER_CONFIG[tier];
                    const count = byTier[tier]?.length || 0;
                    return (
                        <div key={tier} style={{
                            flex: 1, textAlign: 'center', padding: '8px 4px',
                            background: cfg.color + '20', borderRadius: 6,
                            borderBottom: `3px solid ${cfg.color}`,
                        }}>
                            <div style={{ fontSize: 18 }}>{cfg.emoji}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{count}</div>
                        </div>
                    );
                })}
            </div>

            {/* Flow Arrow Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>
                {TIER_ORDER.map((tier, i) => (
                    <span key={tier}>
                        {TIER_CONFIG[tier].emoji} {TIER_CONFIG[tier].label}
                        {i < TIER_ORDER.length - 1 && <span style={{ margin: '0 4px' }}>→</span>}
                    </span>
                ))}
            </div>

            {/* Swimlanes by Tier */}
            {TIER_ORDER.filter(tier => (byTier[tier]?.length || 0) > 0).map(tier => {
                const cfg = TIER_CONFIG[tier];
                const tierProjects = byTier[tier];

                return (
                    <div key={tier} style={{ marginBottom: 20 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                            paddingBottom: 8, borderBottom: `2px solid ${cfg.color}`,
                        }}>
                            <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{cfg.label}</span>
                            <span style={{
                                background: cfg.color + '30', color: cfg.color,
                                padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            }}>
                                {tierProjects.length}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                            {tierProjects.sort((a: any, b: any) => {
                                const prio: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
                                return (prio[a.priority] || 2) - (prio[b.priority] || 2);
                            }).map((p: any) => (
                                <div key={p.path || p.name} style={{
                                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px',
                                    border: '1px solid var(--border)',
                                    borderLeft: `3px solid ${cfg.color}`,
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                                        {p.lane} · {p.priority}
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {(p.stack || []).slice(0, 4).map((t: string) => (
                                            <span key={t} style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 9,
                                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                                color: 'var(--text-tertiary)',
                                            }}>
                                                {t}
                                            </span>
                                        ))}
                                        {(p.stack || []).length > 4 && (
                                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{p.stack.length - 4}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
