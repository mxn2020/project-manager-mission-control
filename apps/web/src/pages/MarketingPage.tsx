import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import MultiSelect from '../components/MultiSelect';

const CATEGORIES = [
    { value: 'product-launch', label: 'Product Launch', icon: '🚀' },
    { value: 'content-campaign', label: 'Content Campaign', icon: '📝' },
    { value: 'social-media', label: 'Social Media', icon: '📱' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'seo', label: 'SEO', icon: '🔍' },
    { value: 'paid-ads', label: 'Paid Ads', icon: '💰' },
    { value: 'event', label: 'Event', icon: '🎪' },
    { value: 'custom', label: 'Custom', icon: '⚙️' },
];

const CAT_COLORS: Record<string, string> = {
    'product-launch': '#f472b6', 'content-campaign': '#a78bfa', 'social-media': '#60a5fa',
    'email': '#fbbf24', 'seo': '#34d399', 'paid-ads': '#fb923c', 'event': '#818cf8', 'custom': '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
    draft: '#6b7280', active: '#34d399', completed: '#60a5fa', archived: '#4b5563',
};

const CHANNEL_OPTIONS: SelectOption[] = [
    { value: 'twitter', label: 'Twitter/X', icon: '🐦' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { value: 'blog', label: 'Blog', icon: '📝' },
    { value: 'youtube', label: 'YouTube', icon: '📺' },
    { value: 'instagram', label: 'Instagram', icon: '📸' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
    { value: 'email', label: 'Email/Newsletter', icon: '📧' },
    { value: 'reddit', label: 'Reddit', icon: '🤖' },
    { value: 'producthunt', label: 'Product Hunt', icon: '🏆' },
    { value: 'discord', label: 'Discord', icon: '💬' },
];

interface Goal { id: string; title: string; done: boolean }

export default function MarketingPage() {
    const [plans, setPlans] = useState<any[] | null>(null);
    const [filter, setFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const { data: projectData } = useProjects();

    // Create form state
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newCat, setNewCat] = useState('custom');
    const [newBudget, setNewBudget] = useState('');
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [newProjects, setNewProjects] = useState<string[]>([]);
    const [newChannels, setNewChannels] = useState<string[]>([]);

    const load = useCallback(async () => {
        try { setPlans(await api.marketing.list(filter ? { category: filter } : undefined)); }
        catch { setPlans([]); }
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const projectOptions: SelectOption[] = (projectData?.projects || []).map(p => {
        const segs = p.path.split('/');
        return { value: p.path, label: segs[segs.length - 1] || p.path, group: segs[0], icon: '📁' };
    });

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        await api.marketing.create({
            title: newTitle.trim(), description: newDesc.trim(),
            category: newCat, budget: newBudget.trim(),
            startDate: newStart, endDate: newEnd,
            linkedProjects: newProjects, channels: newChannels,
            goals: [],
        });
        setShowCreate(false); setNewTitle(''); setNewDesc(''); setNewBudget('');
        setNewStart(''); setNewEnd(''); setNewProjects([]); setNewChannels([]);
        await load();
    };

    const handleAddGoal = async (planId: string, plan: any) => {
        const title = prompt('Goal:');
        if (!title) return;
        const goals: Goal[] = [...(plan.goals || []), {
            id: `goal_${Date.now()}`, title, done: false,
        }];
        await api.marketing.update(planId, { goals });
        await load();
    };

    const handleToggleGoal = async (planId: string, plan: any, goalId: string) => {
        const goals = (plan.goals || []).map((g: Goal) => g.id === goalId ? { ...g, done: !g.done } : g);
        await api.marketing.update(planId, { goals });
        await load();
    };

    const handleDeleteGoal = async (planId: string, plan: any, goalId: string) => {
        const goals = (plan.goals || []).filter((g: Goal) => g.id !== goalId);
        await api.marketing.update(planId, { goals });
        await load();
    };

    const handleUpdateStatus = async (planId: string, status: string) => {
        await api.marketing.update(planId, { status });
        await load();
    };

    const handleDelete = async (id: string) => {
        await api.marketing.delete(id);
        if (expanded === id) setExpanded(null);
        await load();
    };

    const allPlans = plans || [];
    const completedGoals = (p: any) => (p.goals || []).filter((g: Goal) => g.done).length;
    const totalGoals = (p: any) => (p.goals || []).length;

    const formatDate = (d: string) => {
        if (!d) return '';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
        catch { return d; }
    };

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">📣 Marketing Plans</h1>
                        <p className="page-description">Manage marketing strategies, campaigns, and launch plans across projects</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Plan</button>
                </div>
            </div>

            {/* Category stats */}
            <div className="stats-row">
                <div className="stat-card" onClick={() => setFilter('')} style={{ cursor: 'pointer', border: !filter ? '1px solid var(--accent)' : undefined }}>
                    <div className="stat-value">{allPlans.length}</div>
                    <div className="stat-label">All</div>
                </div>
                {CATEGORIES.map(cat => {
                    const count = allPlans.filter(p => p.category === cat.value).length;
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
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Plan title *"
                        className="form-input mb-12" />
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
                        className="form-textarea mb-12" style={{ minHeight: 50 }} />

                    <div className="grid-2 gap-12 mb-12">
                        <MultiSelect options={projectOptions} value={newProjects} onChange={setNewProjects} placeholder="Link projects..." grouped />
                        <MultiSelect options={CHANNEL_OPTIONS} value={newChannels} onChange={setNewChannels} placeholder="Channels..." />
                    </div>

                    <div className="flex-row flex-wrap gap-12">
                        <SearchableSelect options={CATEGORIES} value={newCat} onChange={setNewCat} placeholder="Category" clearable={false} width="160px" />
                        <input type="text" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="Budget (optional)"
                            className="form-input-sm" style={{ width: 120 }} />
                        <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                            className="form-input-sm" />
                        <span className="text-sm text-tertiary">to</span>
                        <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                            className="form-input-sm" />
                        <div className="flex-1" />
                        <button className="btn btn-secondary text-base" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary text-base" onClick={handleCreate} disabled={!newTitle.trim()}>Create</button>
                    </div>
                </div>
            )}

            {/* Plans List */}
            <div className="mt-16">
                {plans === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading marketing plans...</div>
                ) : allPlans.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📣</div>
                        <div className="empty-state-text">No marketing plans yet — create one to get started</div>
                    </div>
                ) : (
                    allPlans.map(plan => {
                        const done = completedGoals(plan);
                        const total = totalGoals(plan);
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                            <div key={plan.id} className="mb-8" style={{
                                background: 'var(--bg-secondary)', borderRadius: 10,
                                border: expanded === plan.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                                borderLeft: `3px solid ${CAT_COLORS[plan.category] || '#6b7280'}`,
                            }}>
                                <div className="flex-row gap-12" style={{ padding: '14px 16px', cursor: 'pointer', alignItems: 'center' }}
                                    onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}>
                                    <span className="text-2xl">{CATEGORIES.find(c => c.value === plan.category)?.icon || '⚙️'}</span>
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg flex-row gap-8">
                                            {plan.title}
                                            <span className="text-xs font-medium" style={{
                                                padding: '1px 8px', borderRadius: 4,
                                                background: `${STATUS_COLORS[plan.status] || '#6b7280'}20`,
                                                color: STATUS_COLORS[plan.status] || '#6b7280',
                                                textTransform: 'uppercase',
                                            }}>{plan.status}</span>
                                        </div>
                                        <div className="text-sm text-tertiary mt-4 flex-row flex-wrap gap-8">
                                            <span>{plan.category}</span>
                                            <span>· {done}/{total} goals</span>
                                            <span>· {(plan.linkedProjects || []).length} projects</span>
                                            {plan.budget && <span>· 💰 {plan.budget}</span>}
                                            {(plan.startDate || plan.endDate) && (
                                                <span>· {formatDate(plan.startDate)}{plan.endDate ? ` – ${formatDate(plan.endDate)}` : ''}</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Channels */}
                                    {(plan.channels || []).length > 0 && (
                                        <div className="flex-row gap-4 flex-shrink-0">
                                            {(plan.channels as string[]).slice(0, 5).map(ch => {
                                                const chOpt = CHANNEL_OPTIONS.find(o => o.value === ch);
                                                return <span key={ch} title={chOpt?.label || ch} className="text-lg">{chOpt?.icon || '📢'}</span>;
                                            })}
                                            {(plan.channels as string[]).length > 5 && <span className="text-xs text-tertiary">+{(plan.channels as string[]).length - 5}</span>}
                                        </div>
                                    )}
                                    {total > 0 && (
                                        <div style={{ width: 80, height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34d399' : '#818cf8', borderRadius: 3, transition: 'width 0.3s' }} />
                                        </div>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); handleDelete(plan.id); }} className="icon-btn text-tertiary">✕</button>
                                </div>

                                {expanded === plan.id && (
                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                                        {plan.description && <div className="text-md text-muted" style={{ padding: '12px 0' }}>{plan.description}</div>}

                                        {/* Status selector */}
                                        <div className="flex-row flex-wrap gap-6 mb-12">
                                            {['draft', 'active', 'completed', 'archived'].map(s => (
                                                <button key={s} onClick={() => handleUpdateStatus(plan.id, s)}
                                                    className="text-xs font-medium" style={{
                                                        padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                                                        textTransform: 'uppercase', border: 'none',
                                                        background: plan.status === s ? `${STATUS_COLORS[s]}30` : 'var(--bg-primary)',
                                                        color: plan.status === s ? STATUS_COLORS[s] : 'var(--text-tertiary)',
                                                    }}>{s}</button>
                                            ))}
                                        </div>

                                        {/* Linked projects — inline edit */}
                                        <div className="mb-12">
                                            <MultiSelect
                                                options={projectOptions}
                                                value={plan.linkedProjects || []}
                                                onChange={async (newProjects) => {
                                                    await api.marketing.update(plan.id, { linkedProjects: newProjects });
                                                    await load();
                                                }}
                                                placeholder="Link projects..."
                                                grouped
                                            />
                                        </div>

                                        {/* Channels — inline edit */}
                                        <div className="mb-12">
                                            <MultiSelect
                                                options={CHANNEL_OPTIONS}
                                                value={plan.channels || []}
                                                onChange={async (newChannels) => {
                                                    await api.marketing.update(plan.id, { channels: newChannels });
                                                    await load();
                                                }}
                                                placeholder="Channels..."
                                            />
                                        </div>

                                        {/* Goals */}
                                        <div className="section-label mb-8">
                                            Goals ({total})
                                        </div>
                                        {(plan.goals || []).map((goal: Goal, i: number) => (
                                            <div key={goal.id} className="flex-row gap-10 mb-4" style={{
                                                padding: '8px 12px', alignItems: 'center',
                                                background: 'var(--bg-primary)', borderRadius: 8,
                                                border: '1px solid var(--border)', opacity: goal.done ? 0.5 : 1,
                                            }}>
                                                <div onClick={() => handleToggleGoal(plan.id, plan, goal.id)}
                                                    className="flex-center flex-shrink-0" style={{
                                                        width: 20, height: 20, borderRadius: 4, cursor: 'pointer',
                                                        border: `2px solid ${goal.done ? '#34d399' : 'var(--border)'}`,
                                                        background: goal.done ? '#34d399' : 'transparent',
                                                        color: 'white', fontSize: 12,
                                                    }}>
                                                    {goal.done && '✓'}
                                                </div>
                                                <span className="text-sm text-tertiary font-mono" style={{ width: 20 }}>{i + 1}</span>
                                                <span className="text-md flex-1" style={{ textDecoration: goal.done ? 'line-through' : 'none' }}>{goal.title}</span>
                                                <button onClick={() => handleDeleteGoal(plan.id, plan, goal.id)} className="icon-btn text-tertiary text-xs">✕</button>
                                            </div>
                                        ))}
                                        <button onClick={() => handleAddGoal(plan.id, plan)}
                                            className="btn btn-secondary text-sm mt-8" style={{ padding: '4px 12px' }}>
                                            + Add Goal
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
