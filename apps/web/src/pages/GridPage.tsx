import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier } from '../lib/types';
import { TIER_CONFIG, LANE_COLORS, TIER_ORDER, PRIORITY_ORDER } from '../lib/types';
import { groupByDimension, type Dimension } from '../lib/dimensions';
import { useDimensions } from '../hooks/useDimensions';
import { PageHeader, FilterBar, Card, Badge, EmptyState, DimensionPicker } from '../components/ui';
import SearchableSelect from '../components/SearchableSelect';

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
    const tierCfg = TIER_CONFIG[project.tier as Tier] || TIER_CONFIG.idea;
    const laneColor = LANE_COLORS[project.lane] || 'var(--text-tertiary)';
    return (
        <Card onClick={onClick} accentColor={tierCfg.color}>
            <div className="card-header">
                <div className="card-name">{project.name}</div>
                <Badge variant="tier" tier={project.tier} />
            </div>
            <div className="card-description">{project.description}</div>
            <div className="card-stack">
                {(project.stack || []).slice(0, 4).map(s => <span key={s} className="stack-tag">{s}</span>)}
                {(project.stack || []).length > 4 && <span className="stack-tag">+{(project.stack || []).length - 4}</span>}
            </div>
            <div className="card-footer">
                <span className="card-lane" style={{ color: laneColor, background: laneColor + '18' }}>{project.lane}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant="health" score={project.health_score} />
                    {project.oss && <Badge variant="oss" />}
                    {project.last_active && <span className="card-date">{project.last_active}</span>}
                </div>
            </div>
        </Card>
    );
}

export default function GridPage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const { dimensions } = useDimensions(data.projects);
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [laneFilter, setLaneFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [groupDimension, setGroupDimension] = useState('');

    const lanes = useMemo(() => [...new Set(data.projects.map(p => p.lane))].sort(), [data]);
    const filtered = useMemo(() => data.projects.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (tierFilter !== 'all' && p.tier !== tierFilter) return false;
        if (laneFilter !== 'all' && p.lane !== laneFilter) return false;
        if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
        return true;
    }), [data.projects, search, tierFilter, laneFilter, priorityFilter]);

    const activeDimension = dimensions.find(d => d.id === groupDimension);
    const groups = useMemo(() => {
        if (!activeDimension) return null;
        return groupByDimension(filtered, activeDimension);
    }, [filtered, activeDimension]);

    const renderGrid = (projects: Project[]) => (
        <div className="project-grid">
            {projects.map(p => <ProjectCard key={p.path} project={p} onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)} />)}
        </div>
    );

    return (
        <div>
            <PageHeader title="Grid View" description="Browse all projects as cards" />
            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: 'Search projects...' }}
                resultCount={filtered.length}
                filters={
                    <>
                        <DimensionPicker dimensions={dimensions} selected={groupDimension} onChange={setGroupDimension} />
                        <SearchableSelect
                            options={[{ value: 'all', label: 'All Tiers' }, ...TIER_ORDER.map(t => ({ value: t, label: `${TIER_CONFIG[t].emoji} ${TIER_CONFIG[t].label}` }))]}
                            value={tierFilter} onChange={setTierFilter} placeholder="Tier" clearable={false} width="150px" />
                        <SearchableSelect
                            options={[{ value: 'all', label: 'All Lanes' }, ...lanes.map(l => ({ value: l, label: l }))]}
                            value={laneFilter} onChange={setLaneFilter} placeholder="Lane" clearable={false} width="150px" />
                        <SearchableSelect
                            options={[{ value: 'all', label: 'All Priorities' }, ...PRIORITY_ORDER.map(p => ({ value: p, label: p }))]}
                            value={priorityFilter} onChange={setPriorityFilter} placeholder="Priority" clearable={false} width="150px" />
                    </>
                }
            />
            {filtered.length === 0 ? (
                <EmptyState icon="🔍" message="No matching projects" />
            ) : groups ? (
                // Grouped view
                groups.filter(g => g.projects.length > 0).map(g => (
                    <div key={g.key} className="dimension-group">
                        <div className="dimension-group-header" style={{ borderColor: g.sub.color || 'var(--border)' }}>
                            {g.sub.icon && <span className="dimension-group-icon">{g.sub.icon}</span>}
                            <span className="dimension-group-label" style={{ color: g.sub.color }}>{g.sub.label}</span>
                            <span className="dimension-group-count">{g.projects.length}</span>
                        </div>
                        {renderGrid(g.projects)}
                    </div>
                ))
            ) : (
                renderGrid(filtered)
            )}
        </div>
    );
}
