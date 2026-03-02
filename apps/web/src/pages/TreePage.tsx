import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier, Priority } from '../lib/types';
import { TIER_CONFIG, TIER_ORDER, PRIORITY_CONFIG, LANE_COLORS } from '../lib/types';

// ─── Tree Node Component ──────────────────────────────────────────────────────

function TreeNode({
    label,
    icon,
    count,
    color,
    defaultExpanded = true,
    children,
}: {
    label: string;
    icon?: string;
    count: number;
    color?: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="tree-node">
            <div
                className={`tree-node-header ${expanded ? 'expanded' : ''}`}
                onClick={() => setExpanded(e => !e)}
            >
                <span className={`tree-chevron ${expanded ? 'expanded' : ''}`}>▶</span>
                {icon && <span className="tree-node-icon">{icon}</span>}
                <span className="tree-node-label" style={color ? { color } : undefined}>
                    {label}
                </span>
                <span className="tree-node-count">{count}</span>
            </div>
            {expanded && <div className="tree-node-children">{children}</div>}
        </div>
    );
}

// ─── Tree Leaf (Project) ──────────────────────────────────────────────────────

function TreeLeaf({ project, onClick }: { project: Project; onClick: () => void }) {
    const tierCfg = TIER_CONFIG[project.tier as Tier] || TIER_CONFIG.idea;
    const priCfg = PRIORITY_CONFIG[project.priority as Priority] || PRIORITY_CONFIG.medium;

    return (
        <div className="tree-leaf" onClick={onClick}>
            <div className="tree-leaf-main">
                <span className="tree-leaf-icon">📄</span>
                <span className="tree-leaf-name">{project.name}</span>
                <span className="tier-badge" style={{ color: tierCfg.color, background: tierCfg.bg, fontSize: 11, padding: '1px 6px' }}>
                    {tierCfg.emoji} {tierCfg.label}
                </span>
            </div>
            <div className="tree-leaf-meta">
                <span className="priority-dot" style={{ background: priCfg.color }} />
                <span className={`health-badge ${project.health_score >= 60 ? 'health-good' : project.health_score >= 40 ? 'health-warn' : 'health-bad'}`}>
                    {project.health_score}
                </span>
                {project.oss && <span className="oss-badge">OSS</span>}
                {project.stack.length > 0 && (
                    <span className="tree-leaf-stack">
                        {project.stack.slice(0, 3).map(s => (
                            <span key={s} className="stack-tag">{s}</span>
                        ))}
                        {project.stack.length > 3 && <span className="stack-tag">+{project.stack.length - 3}</span>}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Tree Page ────────────────────────────────────────────────────────────────

interface TreeGroup {
    lane: string;
    tiers: { tier: string; projects: Project[] }[];
    total: number;
}

export default function TreePage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [laneFilter, setLaneFilter] = useState('all');

    const lanes = useMemo(() => [...new Set(data.projects.map(p => p.lane))].sort(), [data.projects]);

    const filtered = useMemo(() => {
        return data.projects.filter(p => {
            if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
            if (laneFilter !== 'all' && p.lane !== laneFilter) return false;
            return true;
        });
    }, [data.projects, search, laneFilter]);

    const tree = useMemo<TreeGroup[]>(() => {
        const laneMap: Record<string, Record<string, Project[]>> = {};
        for (const p of filtered) {
            const lane = p.lane || 'uncategorized';
            const tier = p.tier || 'idea';
            if (!laneMap[lane]) laneMap[lane] = {};
            if (!laneMap[lane][tier]) laneMap[lane][tier] = [];
            laneMap[lane][tier].push(p);
        }

        const sortedLanes = Object.keys(laneMap).sort();
        return sortedLanes.map(lane => {
            const tierMap = laneMap[lane];
            const tiers = TIER_ORDER.filter(t => tierMap[t]?.length > 0).map(t => ({
                tier: t,
                projects: tierMap[t].sort((a, b) => a.name.localeCompare(b.name)),
            }));
            // Add any tiers not in TIER_ORDER
            const extraTiers = Object.keys(tierMap)
                .filter(t => !TIER_ORDER.includes(t as Tier))
                .map(t => ({
                    tier: t,
                    projects: tierMap[t].sort((a, b) => a.name.localeCompare(b.name)),
                }));
            const allTiers = [...tiers, ...extraTiers];
            return {
                lane,
                tiers: allTiers,
                total: allTiers.reduce((sum, t) => sum + t.projects.length, 0),
            };
        });
    }, [filtered]);

    const handleProjectClick = useCallback(
        (path: string) => navigate(`/project/${encodeURIComponent(path)}`),
        [navigate],
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Tree View</h1>
                <p className="page-description">Hierarchical view of projects by lane and tier</p>
            </div>
            <div className="filter-bar">
                <input
                    className="search-input"
                    placeholder="Search projects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select className="filter-select" value={laneFilter} onChange={e => setLaneFilter(e.target.value)}>
                    <option value="all">All Lanes</option>
                    {lanes.map(l => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
                <span className="result-count">{filtered.length} projects</span>
            </div>

            {tree.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-text">No matching projects</div>
                </div>
            ) : (
                <div className="tree-container">
                    {tree.map(group => (
                        <TreeNode
                            key={group.lane}
                            label={group.lane}
                            icon="📂"
                            count={group.total}
                            color={LANE_COLORS[group.lane] || 'var(--text-secondary)'}
                        >
                            {group.tiers.map(({ tier, projects }) => {
                                const cfg = TIER_CONFIG[tier as Tier] || TIER_CONFIG.idea;
                                return (
                                    <TreeNode
                                        key={tier}
                                        label={cfg.label}
                                        icon={cfg.emoji}
                                        count={projects.length}
                                        color={cfg.color}
                                    >
                                        {projects.map(p => (
                                            <TreeLeaf
                                                key={p.path}
                                                project={p}
                                                onClick={() => handleProjectClick(p.path)}
                                            />
                                        ))}
                                    </TreeNode>
                                );
                            })}
                        </TreeNode>
                    ))}
                </div>
            )}
        </div>
    );
}
