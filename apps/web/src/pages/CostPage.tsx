import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';

import { PageHeader } from '../components/ui';

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
    const { orgId } = useAuth();

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
        for (const c of allCosts) allPaths.add(c.projectPath);
        return [...allPaths].sort().map(path => {
            const segments = path.split('/');
            return { value: path, label: segments[segments.length - 1] || path, sublabel: segments.slice(0, -1).join('/'), group: segments[0], icon: '📁' };
        });
    }, [projectData, allCosts]);

    const categoryOptions: SelectOption[] = CATEGORIES.map(c => ({ value: c, label: c, icon: CATEGORY_ICONS[c] || '📦' }));

    const handleCreate = async () => {
        if (!newProject.trim() || !newName.trim() || !newCost || !orgId) return;
        await createCost({
            orgId: orgId as Id<"organizations">,
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
    const grouped: Record<string, typeof allCosts> = {};
    for (const c of allCosts) {
        const key = groupBy === 'category' ? c.category : c.projectPath;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    }

    return (
        <div>
            <PageHeader
                title="💰 Cost Tracker"
                description="Track infrastructure and service costs across projects"
                actions={
                    <button className="btn btn-primary text-base" onClick={() => setShowCreate(!showCreate)}>+ Add Cost</button>
                }
            />

            {/* Summary Cards */}
            {summary && (
                <div className="grid-auto gap-12 mb-20">
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
                <div className="section-card-sm mb-16">
                    <div className="section-label" style={{ marginBottom: 12 }}>
                        Cost Breakdown
                    </div>
                    <div className="flex-row flex-wrap gap-8">
                        {Object.entries(summary.byCategory)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([cat, amount]) => (
                                <div key={cat} className="flex-row gap-6" style={{
                                    padding: '6px 12px',
                                    background: (CATEGORY_COLORS[cat] || '#6b7280') + '15',
                                    borderRadius: 8, border: `1px solid ${(CATEGORY_COLORS[cat] || '#6b7280')}30`,
                                }}>
                                    <span>{CATEGORY_ICONS[cat] || '📦'}</span>
                                    <span className="font-semibold text-md">${(amount as number).toFixed(2)}</span>
                                    <span className="text-tertiary text-sm">{cat}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <div className="grid-3 gap-12 mb-12">
                        <input placeholder="Service name *" value={newName} onChange={e => setNewName(e.target.value)}
                            className="form-input" />
                        <input placeholder="Monthly cost * ($)" type="number" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)}
                            className="form-input" />
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="Select project *" grouped allowCreate onCreateNew={(v) => setNewProject(v)} />
                    </div>
                    <div className="flex-row gap-12">
                        <div style={{ width: 160 }}>
                            <SearchableSelect options={categoryOptions} value={newCategory} onChange={setNewCategory} placeholder="Category" clearable={false} />
                        </div>
                        <input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                            className="form-input-sm flex-1" />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim() || !newCost || !newProject.trim()}>Add</button>
                    </div>
                </div>
            )}

            {/* Group By Toggle */}
            <div className="filter-bar flex-row gap-8 mb-16">
                <span className="text-base text-tertiary">Group by:</span>
                <button className={`btn ${groupBy === 'category' ? 'btn-primary' : 'btn-secondary'} text-base`} onClick={() => setGroupBy('category')}>Category</button>
                <button className={`btn ${groupBy === 'project' ? 'btn-primary' : 'btn-secondary'} text-base`} onClick={() => setGroupBy('project')}>Project</button>
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
                    .sort(([, a], [, b]) => b.reduce((s: number, c: { monthlyCost: number }) => s + c.monthlyCost, 0) - a.reduce((s: number, c: { monthlyCost: number }) => s + c.monthlyCost, 0))
                    .map(([group, items]) => (
                        <div key={group} className="mb-12">
                            <div className="list-group-header" style={{ borderRadius: '8px 8px 0 0' }}>
                                <span>{groupBy === 'category' ? (CATEGORY_ICONS[group] || '📦') : '📂'}</span>
                                <span className="font-semibold text-md">{group}</span>
                                <span className="font-semibold text-md" style={{ marginLeft: 'auto', color: '#f87171' }}>
                                    ${items.reduce((s: number, c: { monthlyCost: number }) => s + c.monthlyCost, 0).toFixed(2)}/mo
                                </span>
                            </div>
                            {items.map(cost => (
                                <div key={cost._id} className="list-row-bordered">
                                    <span className="font-medium flex-1">{cost.name}</span>
                                    <span className="text-tertiary text-sm">
                                        {groupBy === 'category' ? cost.projectPath : cost.category}
                                    </span>
                                    <span className="font-semibold font-mono">${cost.monthlyCost.toFixed(2)}</span>
                                    <button onClick={() => deleteCost({ id: cost._id })} className="icon-btn">✕</button>
                                </div>
                            ))}
                        </div>
                    ))
            )}
        </div>
    );
}
