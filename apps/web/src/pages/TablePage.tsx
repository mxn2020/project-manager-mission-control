import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Tier, Priority } from '../lib/types';
import { TIER_CONFIG, TIER_ORDER, PRIORITY_CONFIG, PRIORITY_ORDER, LANE_COLORS } from '../lib/types';
import { PageHeader, FilterBar, Badge } from '../components/ui';
import SearchableSelect from '../components/SearchableSelect';

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
            <PageHeader title="Table View" />
            <FilterBar
                search={{ value: search, onChange: setSearch }}
                resultCount={filtered.length}
                filters={
                    <SearchableSelect
                        options={[{ value: 'all', label: 'All Tiers' }, ...TIER_ORDER.map(t => ({ value: t, label: `${TIER_CONFIG[t].emoji} ${TIER_CONFIG[t].label}` }))]}
                        value={tierFilter} onChange={setTierFilter} placeholder="Tier" clearable={false} width="150px" />
                }
            />
            <div className="project-table-wrapper">
                <table className="project-table">
                    <thead><tr><SH field="name" label="Project" /><SH field="tier" label="Tier" /><SH field="lane" label="Lane" /><SH field="priority" label="Priority" /><SH field="health_score" label="Health" /><SH field="oss" label="OSS" /><SH field="last_active" label="Active" /></tr></thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.path} onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)}>
                                <td><div className="table-name">{p.name}</div><div className="table-path">{p.path}</div></td>
                                <td><Badge variant="tier" tier={p.tier} /></td>
                                <td><span style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)', fontWeight: 600, fontSize: 13 }}>{p.lane}</span></td>
                                <td><Badge variant="priority" priority={p.priority} /></td>
                                <td><Badge variant="health" score={p.health_score} /></td>
                                <td>{p.oss ? <Badge variant="oss" /> : '—'}</td>
                                <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{p.last_active || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
