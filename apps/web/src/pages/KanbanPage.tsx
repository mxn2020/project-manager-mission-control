import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Tier, Project } from '../lib/types';
import { TIER_ORDER, TIER_CONFIG, LANE_COLORS } from '../lib/types';

export default function KanbanPage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const columns = useMemo(() => {
        const g: Record<string, Project[]> = {};
        for (const t of TIER_ORDER) g[t] = [];
        for (const p of data.projects) { const t = p.tier || 'idea'; if (!g[t]) g[t] = []; g[t].push(p); }
        const prio = ['high', 'medium', 'low', 'parked'];
        for (const t of TIER_ORDER) g[t].sort((a, b) => prio.indexOf(a.priority) - prio.indexOf(b.priority));
        return g;
    }, [data.projects]);

    return (
        <div>
            <div className="page-header"><h1 className="page-title">Kanban Board</h1><p className="page-description">Projects by lifecycle tier</p></div>
            <div className="kanban-board">
                {TIER_ORDER.map(tier => {
                    const cfg = TIER_CONFIG[tier as Tier]; const items = columns[tier] || [];
                    return (
                        <div className="kanban-column" key={tier}>
                            <div className="kanban-column-header">
                                <div className="kanban-column-title" style={{ color: cfg.color }}><span>{cfg.emoji}</span> {cfg.label}</div>
                                <span className="kanban-count">{items.length}</span>
                            </div>
                            <div className="kanban-cards">
                                {items.map(p => (
                                    <div key={p.path} className="kanban-card" onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)} style={{ borderLeft: `3px solid ${cfg.color}` }}>
                                        <div className="kanban-card-name">{p.name}</div>
                                        <div className="kanban-card-lane" style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)' }}>{p.lane}</div>
                                        {p.stack.length > 0 && <div className="kanban-card-stack">{p.stack.slice(0, 3).map(s => <span key={s} className="stack-tag">{s}</span>)}</div>}
                                    </div>
                                ))}
                                {items.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 12 }}>No projects</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
