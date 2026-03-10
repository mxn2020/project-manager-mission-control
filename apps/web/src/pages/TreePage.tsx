import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier } from '../lib/types';
import { TIER_CONFIG, TIER_ORDER, LANE_COLORS } from '../lib/types';
import { groupByDimension, getSubDimension, type Dimension } from '../lib/dimensions';
import { useDimensions } from '../hooks/useDimensions';
import { PageHeader, FilterBar, Badge, EmptyState, DimensionPicker } from '../components/ui';

// ─── Tree Node Component ──────────────────────────────────────────────────────

function TreeNode({
    label, icon, count, color, defaultExpanded = true, storageKey, children,
}: {
    label: string; icon?: string; count: number; color?: string; defaultExpanded?: boolean; storageKey?: string; children: React.ReactNode;
}) {
    const [expanded, setExpanded] = useState(() => {
        if (storageKey) {
            const saved = localStorage.getItem(`mc-tree:${storageKey}`);
            if (saved !== null) return saved === '1';
        }
        return defaultExpanded;
    });

    useEffect(() => {
        if (storageKey) {
            localStorage.setItem(`mc-tree:${storageKey}`, expanded ? '1' : '0');
        }
    }, [expanded, storageKey]);

    return (
        <div className="tree-node">
            <div className={`tree-node-header ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(e => !e)}>
                <span className={`tree-chevron ${expanded ? 'expanded' : ''}`}>▶</span>
                {icon && <span className="tree-node-icon">{icon}</span>}
                <span className="tree-node-label" style={color ? { color } : undefined}>{label}</span>
                <span className="tree-node-count">{count}</span>
            </div>
            {expanded && <div className="tree-node-children">{children}</div>}
        </div>
    );
}

// ─── Tree Leaf (Project) ──────────────────────────────────────────────────────

function TreeLeaf({ project, onClick }: { project: Project; onClick: () => void }) {
    return (
        <div className="tree-leaf" onClick={onClick}>
            <div className="tree-leaf-main">
                <span className="tree-leaf-icon">📄</span>
                <span className="tree-leaf-name">{project.name}</span>
                <Badge variant="tier" tier={project.tier} size="sm" />
            </div>
            <div className="tree-leaf-meta">
                <Badge variant="priority" priority={project.priority} size="sm" />
                <Badge variant="health" score={project.health_score} />
                {project.oss && <Badge variant="oss" />}
                {(project.stack || []).length > 0 && (
                    <span className="tree-leaf-stack">
                        {(project.stack || []).slice(0, 3).map(s => <span key={s} className="stack-tag">{s}</span>)}
                        {(project.stack || []).length > 3 && <span className="stack-tag">+{(project.stack || []).length - 3}</span>}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Tree Page ────────────────────────────────────────────────────────────────

export default function TreePage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const { dimensions } = useDimensions(data.projects);
    const [search, setSearch] = useState('');
    const [groupDimension, setGroupDimension] = useState('lane');

    const filtered = useMemo(() => {
        return data.projects.filter(p => {
            if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [data.projects, search]);

    const activeDimension = dimensions.find(d => d.id === groupDimension);

    const handleProjectClick = useCallback(
        (path: string) => navigate(`/project/${encodeURIComponent(path)}`),
        [navigate],
    );

    // When no dimension selected: show all dimensions as top-level, sub-dimensions nested
    const renderAllDimensions = () => (
        <div className="tree-container">
            {dimensions.map(dim => {
                const groups = groupByDimension(filtered, dim);
                const withProjects = groups.filter(g => g.projects.length > 0);
                if (withProjects.length === 0) return null;
                return (
                    <TreeNode key={dim.id} label={dim.label} icon={dim.icon} count={filtered.length} color="var(--accent)" storageKey={`all:${dim.id}`}>
                        {withProjects.map(g => (
                            <TreeNode key={g.key} label={g.sub.label} icon={g.sub.icon} count={g.projects.length} color={g.sub.color} storageKey={`all:${dim.id}:${g.key}`}>
                                {g.projects.map(p => <TreeLeaf key={p.path} project={p} onClick={() => handleProjectClick(p.path)} />)}
                            </TreeNode>
                        ))}
                    </TreeNode>
                );
            })}
        </div>
    );

    // When a dimension is selected: sub-dimensions as top-level nodes
    const renderSingleDimension = (dim: Dimension) => {
        const groups = groupByDimension(filtered, dim);
        return (
            <div className="tree-container">
                {groups.filter(g => g.projects.length > 0).map(g => (
                    <TreeNode key={g.key} label={g.sub.label} icon={g.sub.icon} count={g.projects.length} color={g.sub.color} storageKey={`${dim.id}:${g.key}`}>
                        {g.projects.map(p => <TreeLeaf key={p.path} project={p} onClick={() => handleProjectClick(p.path)} />)}
                    </TreeNode>
                ))}
            </div>
        );
    };

    return (
        <div>
            <PageHeader title="Tree View" description="Hierarchical view of projects" />
            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: 'Search projects...' }}
                resultCount={filtered.length}
                filters={
                    <DimensionPicker dimensions={dimensions} selected={groupDimension} onChange={setGroupDimension} allowNone={false} />
                }
            />

            {filtered.length === 0 ? (
                <EmptyState icon="🔍" message="No matching projects" />
            ) : activeDimension ? (
                renderSingleDimension(activeDimension)
            ) : (
                renderAllDimensions()
            )}
        </div>
    );
}
