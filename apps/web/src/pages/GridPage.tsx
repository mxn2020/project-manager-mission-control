import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier } from '../lib/types';
import { TIER_CONFIG, LANE_COLORS, TIER_ORDER, PRIORITY_ORDER } from '../lib/types';

function HealthBadge({ score }: { score: number }) {
    const cls = score >= 60 ? 'health-good' : score >= 40 ? 'health-warn' : 'health-bad';
    return <span className={`health-badge ${cls}`}>{score}</span>;
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
    const tierCfg = TIER_CONFIG[project.tier as Tier] || TIER_CONFIG.idea;
    const laneColor = LANE_COLORS[project.lane] || 'var(--text-tertiary)';
    return (
        <div className="project-card" onClick={onClick}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tierCfg.color, borderRadius: '12px 12px 0 0' }} />
            <div className="card-header">
                <div className="card-name">{project.name}</div>
                <span className="tier-badge" style={{ color: tierCfg.color, background: tierCfg.bg }}>{tierCfg.emoji} {tierCfg.label}</span>
            </div>
            <div className="card-description">{project.description}</div>
            <div className="card-stack">
                {project.stack.slice(0, 4).map(s => <span key={s} className="stack-tag">{s}</span>)}
                {project.stack.length > 4 && <span className="stack-tag">+{project.stack.length - 4}</span>}
            </div>
            <div className="card-footer">
                <span className="card-lane" style={{ color: laneColor, background: laneColor + '18' }}>{project.lane}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HealthBadge score={project.health_score} />
                    {project.oss && <span className="oss-badge">OSS</span>}
                    {project.last_active && <span className="card-date">{project.last_active}</span>}
                </div>
            </div>
        </div>
    );
}

export default function GridPage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [laneFilter, setLaneFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');

    const lanes = useMemo(() => [...new Set(data.projects.map(p => p.lane))].sort(), [data]);
    const filtered = useMemo(() => data.projects.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (tierFilter !== 'all' && p.tier !== tierFilter) return false;
        if (laneFilter !== 'all' && p.lane !== laneFilter) return false;
        if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
        return true;
    }), [data.projects, search, tierFilter, laneFilter, priorityFilter]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Grid View</h1>
                <p className="page-description">Browse all projects as cards</p>
            </div>
            <div className="filter-bar">
                <input className="search-input" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="filter-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                    <option value="all">All Tiers</option>
                    {TIER_ORDER.map(t => <option key={t} value={t}>{TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}</option>)}
                </select>
                <select className="filter-select" value={laneFilter} onChange={e => setLaneFilter(e.target.value)}>
                    <option value="all">All Lanes</option>
                    {lanes.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                    <option value="all">All Priorities</option>
                    {PRIORITY_ORDER.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="result-count">{filtered.length} projects</span>
            </div>
            {filtered.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">No matching projects</div></div>
            ) : (
                <div className="project-grid">
                    {filtered.map(p => <ProjectCard key={p.path} project={p} onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)} />)}
                </div>
            )}
        </div>
    );
}
