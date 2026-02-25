import type { StatusData } from '../lib/types';
import { TIER_ORDER, TIER_CONFIG, PRIORITY_ORDER, PRIORITY_CONFIG, LANE_COLORS } from '../lib/types';

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

export default function OverviewPage({ data }: { data: StatusData }) {
    const tierColors: Record<string, string> = {};
    TIER_ORDER.forEach(t => { tierColors[t] = TIER_CONFIG[t].color; });
    const priorityColors: Record<string, string> = {};
    PRIORITY_ORDER.forEach(p => { priorityColors[p] = PRIORITY_CONFIG[p].color; });
    const ossCount = data.projects.filter(p => p.oss).length;
    const avgHealth = data.projects.length > 0 ? Math.round(data.projects.reduce((s, p) => s + (p.health_score || 0), 0) / data.projects.length) : 0;
    const stackColors = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#a78bfa', '#f87171'];
    const topStacks: Record<string, string> = {};
    Object.entries(data.summary.by_stack).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([s], i) => { topStacks[s] = stackColors[i % stackColors.length]; });

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Portfolio Overview</h1>
                <p className="page-description">Last scanned: {new Date(data.generated_at).toLocaleString()}</p>
            </div>
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-label">Total Projects</div>
                    <div className="stat-value">{data.total_projects}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Open Source</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{ossCount}</div>
                    <div className="stat-sub">{data.total_projects - ossCount} closed source</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Avg Health</div>
                    <div className="stat-value" style={{ color: avgHealth >= 60 ? 'var(--success)' : avgHealth >= 40 ? 'var(--warning)' : 'var(--error)' }}>{avgHealth}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Lanes</div>
                    <div className="stat-value">{Object.keys(data.summary.by_lane).length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active (Building)</div>
                    <div className="stat-value" style={{ color: TIER_CONFIG.building.color }}>{data.summary.by_tier.building || 0}</div>
                </div>
            </div>
            <div className="overview-charts">
                <BarChart title="By Tier" items={data.summary.by_tier} colorMap={tierColors} />
                <BarChart title="By Lane" items={data.summary.by_lane} colorMap={LANE_COLORS} />
                <BarChart title="By Priority" items={data.summary.by_priority} colorMap={priorityColors} />
                <BarChart title="Top Stacks" items={Object.fromEntries(Object.entries(data.summary.by_stack).sort((a, b) => b[1] - a[1]).slice(0, 8))} colorMap={topStacks} />
            </div>
        </div>
    );
}
