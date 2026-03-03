import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import MultiSelect from '../components/MultiSelect';

const CATEGORIES = [
    { value: 'project-setup', label: 'Project Setup', icon: '🏗️' },
    { value: 'content-loop', label: 'Content Loop', icon: '🔄' },
    { value: 'daily-routine', label: 'Daily Routine', icon: '☀️' },
    { value: 'blog-posting', label: 'Blog Posting', icon: '📝' },
    { value: 'content-generation', label: 'Content Gen', icon: '✨' },
    { value: 'update-cycle', label: 'Update Cycle', icon: '🔃' },
    { value: 'custom', label: 'Custom', icon: '⚙️' },
];

const CAT_COLORS: Record<string, string> = {
    'project-setup': '#60a5fa', 'content-loop': '#a78bfa', 'daily-routine': '#fbbf24',
    'blog-posting': '#34d399', 'content-generation': '#f472b6', 'update-cycle': '#818cf8', 'custom': '#6b7280',
};

interface Step { id: string; title: string; description: string; order: number; done: boolean }

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[] | null>(null);
    const [filter, setFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const { data: projectData } = useProjects();

    // Create form
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newCat, setNewCat] = useState('custom');
    const [newProjects, setNewProjects] = useState<string[]>([]);
    const [newIsTemplate, setNewIsTemplate] = useState(false);

    const load = useCallback(async () => {
        try { setWorkflows(await api.workflows.list(filter ? { category: filter } : undefined)); }
        catch { setWorkflows([]); }
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const projectOptions: SelectOption[] = (projectData?.projects || []).map(p => {
        const segs = p.path.split('/');
        return { value: p.path, label: segs[segs.length - 1] || p.path, group: segs[0], icon: '📁' };
    });

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        await api.workflows.create({
            title: newTitle.trim(), description: newDesc.trim(),
            category: newCat, linkedProjects: newProjects, isTemplate: newIsTemplate,
            steps: [],
        });
        setShowCreate(false); setNewTitle(''); setNewDesc(''); setNewProjects([]);
        await load();
    };

    const handleAddStep = async (wfId: string, wf: any) => {
        const title = prompt('Step title:');
        if (!title) return;
        const steps: Step[] = [...(wf.steps || []), {
            id: `step_${Date.now()}`, title, description: '', order: (wf.steps || []).length, done: false,
        }];
        await api.workflows.update(wfId, { steps });
        await load();
    };

    const handleToggleStep = async (wfId: string, wf: any, stepId: string) => {
        const steps = (wf.steps || []).map((s: Step) => s.id === stepId ? { ...s, done: !s.done } : s);
        await api.workflows.update(wfId, { steps });
        await load();
    };

    const handleDeleteStep = async (wfId: string, wf: any, stepId: string) => {
        const steps = (wf.steps || []).filter((s: Step) => s.id !== stepId);
        await api.workflows.update(wfId, { steps });
        await load();
    };

    const handleDelete = async (id: string) => {
        await api.workflows.delete(id);
        if (expanded === id) setExpanded(null);
        await load();
    };

    const allWorkflows = workflows || [];
    const completedSteps = (wf: any) => (wf.steps || []).filter((s: Step) => s.done).length;
    const totalSteps = (wf: any) => (wf.steps || []).length;

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">🔄 Workflows</h1>
                        <p className="page-description">Reusable workflows for project setup, content loops, daily routines</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Workflow</button>
                </div>
            </div>

            {/* Category stats */}
            <div className="stats-row">
                <div className="stat-card" onClick={() => setFilter('')} style={{ cursor: 'pointer', border: !filter ? '1px solid var(--accent)' : undefined }}>
                    <div className="stat-value">{allWorkflows.length}</div>
                    <div className="stat-label">All</div>
                </div>
                {CATEGORIES.map(cat => {
                    const count = allWorkflows.filter(w => w.category === cat.value).length;
                    return count > 0 ? (
                        <div key={cat.value} className="stat-card" onClick={() => setFilter(filter === cat.value ? '' : cat.value)}
                            style={{ cursor: 'pointer', border: filter === cat.value ? `1px solid ${CAT_COLORS[cat.value]}` : undefined }}>
                            <div className="stat-value">{cat.icon} {count}</div>
                            <div className="stat-label">{cat.label}</div>
                        </div>
                    ) : null;
                })}
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Workflow title *"
                        className="form-input mb-12" />
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
                        className="form-textarea mb-12" style={{ minHeight: 50 }} />
                    <div className="mb-12">
                        <MultiSelect options={projectOptions} value={newProjects} onChange={setNewProjects} placeholder="Link projects..." grouped />
                    </div>
                    <div className="flex-row flex-wrap gap-12">
                        <SearchableSelect options={CATEGORIES} value={newCat} onChange={setNewCat} placeholder="Category" clearable={false} width="160px" />
                        <label className="flex-row gap-6 text-base" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={newIsTemplate} onChange={e => setNewIsTemplate(e.target.checked)} /> Template
                        </label>
                        <div className="flex-1" />
                        <button className="btn btn-secondary text-base" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary text-base" onClick={handleCreate} disabled={!newTitle.trim()}>Create</button>
                    </div>
                </div>
            )}

            {/* Workflow List */}
            <div className="mt-16">
                {workflows === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading workflows...</div>
                ) : allWorkflows.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔄</div>
                        <div className="empty-state-text">No workflows yet — create one to get started</div>
                    </div>
                ) : (
                    allWorkflows.map(wf => {
                        const done = completedSteps(wf);
                        const total = totalSteps(wf);
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                            <div key={wf.id} className="mb-8" style={{
                                background: 'var(--bg-secondary)', borderRadius: 10,
                                border: expanded === wf.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                                borderLeft: `3px solid ${CAT_COLORS[wf.category] || '#6b7280'}`,
                            }}>
                                <div className="flex-row gap-12" style={{ padding: '14px 16px', cursor: 'pointer', alignItems: 'center' }}
                                    onClick={() => setExpanded(expanded === wf.id ? null : wf.id)}>
                                    <span className="text-2xl">{CATEGORIES.find(c => c.value === wf.category)?.icon || '⚙️'}</span>
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg">
                                            {wf.title}
                                            {wf.isTemplate && <span className="tag" style={{ marginLeft: 8, fontSize: 9, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'none' }}>TEMPLATE</span>}
                                        </div>
                                        <div className="text-sm text-tertiary mt-4">
                                            {wf.category} · {done}/{total} steps · {(wf.linkedProjects || []).length} projects
                                        </div>
                                    </div>
                                    {total > 0 && (
                                        <div style={{ width: 80, height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34d399' : '#818cf8', borderRadius: 3, transition: 'width 0.3s' }} />
                                        </div>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); handleDelete(wf.id); }} className="icon-btn text-tertiary">✕</button>
                                </div>

                                {expanded === wf.id && (
                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                                        {wf.description && <div className="text-md text-muted" style={{ padding: '12px 0' }}>{wf.description}</div>}

                                        {/* Linked projects — inline edit */}
                                        <div className="mb-12">
                                            <MultiSelect
                                                options={projectOptions}
                                                value={wf.linkedProjects || []}
                                                onChange={async (newProjects) => {
                                                    await api.workflows.update(wf.id, { linkedProjects: newProjects });
                                                    await load();
                                                }}
                                                placeholder="Link projects..."
                                                grouped
                                            />
                                        </div>

                                        {/* Steps */}
                                        <div className="section-label mb-8">
                                            Steps ({total})
                                        </div>
                                        {(wf.steps || []).map((step: Step, i: number) => (
                                            <div key={step.id} className="flex-row gap-10 mb-4" style={{
                                                padding: '8px 12px', alignItems: 'center',
                                                background: 'var(--bg-primary)', borderRadius: 8,
                                                border: '1px solid var(--border)', opacity: step.done ? 0.5 : 1,
                                            }}>
                                                <div onClick={() => handleToggleStep(wf.id, wf, step.id)}
                                                    className="flex-center flex-shrink-0" style={{
                                                        width: 20, height: 20, borderRadius: 4, cursor: 'pointer',
                                                        border: `2px solid ${step.done ? '#34d399' : 'var(--border)'}`,
                                                        background: step.done ? '#34d399' : 'transparent',
                                                        color: 'white', fontSize: 12,
                                                    }}>
                                                    {step.done && '✓'}
                                                </div>
                                                <span className="text-sm text-tertiary font-mono" style={{ width: 20 }}>{i + 1}</span>
                                                <span className="text-md flex-1" style={{ textDecoration: step.done ? 'line-through' : 'none' }}>{step.title}</span>
                                                <button onClick={() => handleDeleteStep(wf.id, wf, step.id)} className="icon-btn text-tertiary text-xs">✕</button>
                                            </div>
                                        ))}
                                        <button onClick={() => handleAddStep(wf.id, wf)}
                                            className="btn btn-secondary text-sm mt-8" style={{ padding: '4px 12px' }}>
                                            + Add Step
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
