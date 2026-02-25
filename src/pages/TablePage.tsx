import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier, Priority } from '../lib/types';
import { TIER_CONFIG, TIER_ORDER, PRIORITY_CONFIG, PRIORITY_ORDER, LANE_COLORS } from '../lib/types';

type SortField = 'name' | 'tier' | 'lane' | 'priority' | 'health_score' | 'last_active' | 'oss';
type SortDir = 'asc' | 'desc';

export default function TablePage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const handleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } };

    const filtered = useMemo(() => {
        let r = data.projects.filter(p => {
            if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.path.toLowerCase().includes(search.toLowerCase())) return false;
            if (tierFilter !== 'all' && p.tier !== tierFilter) return false;
            return true;
        });
        r.sort((a, b) => {
            let c = 0;
            switch (sortField) {
                case 'name': c = a.name.localeCompare(b.name); break;
                case 'tier': c = TIER_ORDER.indexOf(a.tier as Tier) - TIER_ORDER.indexOf(b.tier as Tier); break;
                case 'lane': c = a.lane.localeCompare(b.lane); break;
                case 'priority': c = PRIORITY_ORDER.indexOf(a.priority as Priority) - PRIORITY_ORDER.indexOf(b.priority as Priority); break;
                case 'health_score': c = a.health_score - b.health_score; break;
                case 'last_active': c = (a.last_active || '').localeCompare(b.last_active || ''); break;
                case 'oss': c = (a.oss ? 1 : 0) - (b.oss ? 1 : 0); break;
            }
            return sortDir === 'desc' ? -c : c;
        });
        return r;
    }, [data.projects, search, tierFilter, sortField, sortDir]);

    const SH = ({ field, label }: { field: SortField; label: string }) => (
        <th className={sortField === field ? 'sorted' : ''} onClick={() => handleSort(field)}>
            {label}{sortField === field && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
        </th>
    );

    return (
        <div>
            <div className="page-header"><h1 className="page-title">Table View</h1></div>
            <div className="filter-bar">
                <input className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="filter-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                    <option value="all">All Tiers</option>
                    {TIER_ORDER.map(t => <option key={t} value={t}>{TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}</option>)}
                </select>
                <span className="result-count">{filtered.length} projects</span>
            </div>
            <div className="project-table-wrapper">
                <table className="project-table">
                    <thead><tr><SH field="name" label="Project" /><SH field="tier" label="Tier" /><SH field="lane" label="Lane" /><SH field="priority" label="Priority" /><SH field="health_score" label="Health" /><SH field="oss" label="OSS" /><SH field="last_active" label="Active" /></tr></thead>
                    <tbody>
                        {filtered.map(p => {
                            const tc = TIER_CONFIG[p.tier as Tier] || TIER_CONFIG.idea;
                            const pc = PRIORITY_CONFIG[p.priority as Priority] || PRIORITY_CONFIG.medium;
                            return (
                                <tr key={p.path} onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)}>
                                    <td><div className="table-name">{p.name}</div><div className="table-path">{p.path}</div></td>
                                    <td><span className="tier-badge" style={{ color: tc.color, background: tc.bg }}>{tc.emoji} {tc.label}</span></td>
                                    <td><span style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)', fontWeight: 600, fontSize: 13 }}>{p.lane}</span></td>
                                    <td><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><span className="priority-dot" style={{ background: pc.color }} />{pc.label}</span></td>
                                    <td><span className={`health-badge ${p.health_score >= 60 ? 'health-good' : p.health_score >= 40 ? 'health-warn' : 'health-bad'}`}>{p.health_score}</span></td>
                                    <td>{p.oss ? <span className="oss-badge">OSS</span> : '—'}</td>
                                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{p.last_active || '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
