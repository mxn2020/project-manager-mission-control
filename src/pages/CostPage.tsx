import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

const CATEGORIES = ['hosting', 'domain', 'api', 'database', 'monitoring', 'ai', 'cdn', 'email', 'other'];
const CATEGORY_ICONS: Record<string, string> = {
    hosting: '🖥️', domain: '🌐', api: '🔌', database: '🗄️',
    monitoring: '📊', ai: '🤖', cdn: '⚡', email: '📧', other: '📦',
};
const CATEGORY_COLORS: Record<string, string> = {
    hosting: '#60a5fa', domain: '#34d399', api: '#fbbf24', database: '#a78bfa',
    monitoring: '#f472b6', ai: '#818cf8', cdn: '#fb923c', email: '#f87171', other: '#6b7280',
};

export default function CostPage() {
    const { data: projectData } = useProjects();
    const costs = useQuery(api.costs.listCosts, {});
    const summary = useQuery(api.costs.getCostSummary);
    const createCost = useMutation(api.costs.createCost);
    const deleteCost = useMutation(api.costs.deleteCost);

    const [showCreate, setShowCreate] = useState(false);
    const [groupBy, setGroupBy] = useState<'project' | 'category'>('category');

    // Create form
    const [newProject, setNewProject] = useState('');
    const [newCategory, setNewCategory] = useState('hosting');
    const [newName, setNewName] = useState('');
    const [newCost, setNewCost] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const allCosts = costs || [];

    const projectOptions: SelectOption[] = useMemo(() => {
        const allPaths = new Set<string>();
        for (const p of (projectData?.projects || [])) allPaths.add(p.path);
        for (const c of allCosts) allPaths.add((c as any).projectPath);
        return [...allPaths].sort().map(path => {
            const segments = path.split('/');
            return { value: path, label: segments[segments.length - 1] || path, sublabel: segments.slice(0, -1).join('/'), group: segments[0], icon: '📁' };
        });
    }, [projectData, allCosts]);

    const categoryOptions: SelectOption[] = CATEGORIES.map(c => ({ value: c, label: c, icon: CATEGORY_ICONS[c] || '📦' }));

    const handleCreate = async () => {
        if (!newProject.trim() || !newName.trim() || !newCost) return;
        await createCost({
            projectPath: newProject.trim(),
            category: newCategory,
            name: newName.trim(),
            monthlyCost: parseFloat(newCost),
            notes: newNotes.trim() || undefined,
        });
        setNewName('');
        setNewCost('');
        setNewNotes('');
        setShowCreate(false);
    };

    // Group costs
    const grouped: Record<string, any[]> = {};
    for (const c of allCosts) {
        const key = groupBy === 'category' ? (c as any).category : (c as any).projectPath;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    }

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">💰 Cost Tracker</h1>
                        <p className="page-description">Track infrastructure and service costs across projects</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Add Cost</button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: '#f87171' }}>${summary.totalMonthly.toFixed(2)}</div>
                        <div className="stat-label">Monthly Total</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: '#fbbf24' }}>${summary.totalAnnual.toFixed(2)}</div>
                        <div className="stat-label">Annual Estimate</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{summary.entryCount}</div>
                        <div className="stat-label">Cost Entries</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{Object.keys(summary.byProject).length}</div>
                        <div className="stat-label">Projects</div>
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {summary && Object.keys(summary.byCategory).length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                        Cost Breakdown
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(summary.byCategory)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([cat, amount]) => (
                                <div key={cat} style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                    background: (CATEGORY_COLORS[cat] || '#6b7280') + '15',
                                    borderRadius: 8, border: `1px solid ${(CATEGORY_COLORS[cat] || '#6b7280')}30`,
                                }}>
                                    <span>{CATEGORY_ICONS[cat] || '📦'}</span>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>${(amount as number).toFixed(2)}</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{cat}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <input placeholder="Service name *" value={newName} onChange={e => setNewName(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                        <input placeholder="Monthly cost * ($)" type="number" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="Select project *" grouped allowCreate onCreateNew={(v) => setNewProject(v)} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 160 }}>
                            <SearchableSelect options={categoryOptions} value={newCategory} onChange={setNewCategory} placeholder="Category" clearable={false} />
                        </div>
                        <input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12 }} />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim() || !newCost || !newProject.trim()}>Add</button>
                    </div>
                </div>
            )}

            {/* Group By Toggle */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Group by:</span>
                <button className={`btn ${groupBy === 'category' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy('category')} style={{ fontSize: 12 }}>Category</button>
                <button className={`btn ${groupBy === 'project' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy('project')} style={{ fontSize: 12 }}>Project</button>
            </div>

            {/* Cost Entries */}
            {!costs ? (
                <div className="loading"><div className="loading-spinner" /> Loading costs...</div>
            ) : allCosts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">💰</div>
                    <div className="empty-state-text">No cost entries yet — add your first service cost</div>
                </div>
            ) : (
                Object.entries(grouped)
                    .sort(([, a], [, b]) => b.reduce((s: number, c: any) => s + c.monthlyCost, 0) - a.reduce((s: number, c: any) => s + c.monthlyCost, 0))
                    .map(([group, items]) => (
                        <div key={group} style={{ marginBottom: 12 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                background: 'var(--bg-secondary)', borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--border)',
                            }}>
                                <span>{groupBy === 'category' ? (CATEGORY_ICONS[group] || '📦') : '📂'}</span>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{group}</span>
                                <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#f87171', fontSize: 13 }}>
                                    ${items.reduce((s: number, c: any) => s + c.monthlyCost, 0).toFixed(2)}/mo
                                </span>
                            </div>
                            {items.map((cost: any) => (
                                <div key={cost._id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                                    background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 13,
                                }}>
                                    <span style={{ fontWeight: 500, flex: 1 }}>{cost.name}</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                                        {groupBy === 'category' ? cost.projectPath : cost.category}
                                    </span>
                                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>${cost.monthlyCost.toFixed(2)}</span>
                                    <button onClick={() => deleteCost({ id: cost._id })}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    ))
            )}
        </div>
    );
}
