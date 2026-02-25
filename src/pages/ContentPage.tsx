import { useState } from 'react';

interface ContentPlan {
    id: string;
    projectPath: string;
    projectName: string;
    releaseTag: string;
    status: 'unprocessed' | 'planned' | 'published' | 'skipped';
    releaseDate: string;
}

const SAMPLE_PLANS: ContentPlan[] = [
    { id: '1', projectPath: 'minions-ecosystem/minions', projectName: 'minions-sdk', releaseTag: 'v0.2.3', status: 'unprocessed', releaseDate: '2026-02-25' },
    { id: '2', projectPath: 'mega-claw', projectName: 'mega-claw', releaseTag: 'v0.1.0', status: 'unprocessed', releaseDate: '2026-02-24' },
    { id: '3', projectPath: 'ai_claw_oss_projects/prompt-forge', projectName: 'prompt-forge', releaseTag: 'v0.1.0', status: 'planned', releaseDate: '2026-02-20' },
];

export default function ContentPage() {
    const [plans, setPlans] = useState(SAMPLE_PLANS);
    const [filter, setFilter] = useState('all');

    const filtered = plans.filter(p => filter === 'all' || p.status === filter);

    const updateStatus = (id: string, status: ContentPlan['status']) => {
        setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    };

    const statusIcons: Record<string, string> = { unprocessed: '⬜', planned: '📝', published: '✅', skipped: '⏭️' };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Content Planner</h1>
                <p className="page-description">Manage social media content for project releases (sync integration pending)</p>
            </div>
            <div className="filter-bar">
                {['all', 'unprocessed', 'planned', 'published', 'skipped'].map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {f === 'all' ? `All (${plans.length})` : `${statusIcons[f] || ''} ${f} (${plans.filter(p => p.status === f).length})`}
                    </button>
                ))}
            </div>
            <div className="content-inbox">
                {filtered.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon">🎉</div><div className="empty-state-text">No items in this category</div></div>
                ) : (
                    filtered.map(plan => (
                        <div key={plan.id} className="content-item">
                            <div className={`content-status ${plan.status}`}>{statusIcons[plan.status]}</div>
                            <div className="content-details">
                                <div className="content-release-tag">{plan.projectName} — {plan.releaseTag}</div>
                                <div className="content-project-name">{plan.projectPath} · {plan.releaseDate}</div>
                            </div>
                            <div className="content-actions">
                                {plan.status === 'unprocessed' && (
                                    <>
                                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => updateStatus(plan.id, 'planned')}>📝 Plan</button>
                                        <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => updateStatus(plan.id, 'skipped')}>Skip</button>
                                    </>
                                )}
                                {plan.status === 'planned' && (
                                    <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => updateStatus(plan.id, 'published')}>✅ Published</button>
                                )}
                                {plan.status === 'published' && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Done</span>}
                                {plan.status === 'skipped' && (
                                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => updateStatus(plan.id, 'unprocessed')}>Undo</button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
