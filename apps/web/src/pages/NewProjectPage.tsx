import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders, API_BASE } from '../lib/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import { TIER_ORDER, PRIORITY_ORDER, TIER_CONFIG, PRIORITY_CONFIG } from '../lib/types';

const COMMON_STACKS = [
    'React', 'Next.js', 'Vite', 'TypeScript', 'JavaScript', 'Node.js', 'Express',
    'Python', 'FastAPI', 'Convex', 'Supabase', 'PostgreSQL', 'MongoDB',
    'TailwindCSS', 'CSS', 'Docker', 'Vercel', 'AWS', 'Stripe',
];

export default function NewProjectPage() {
    const navigate = useNavigate();
    const { data } = useProjects();

    const lanes = [...new Set((data?.projects ?? []).map(p => p.lane).filter(Boolean))].sort();
    const laneOptions: SelectOption[] = lanes.map(l => ({ value: l, label: l }));
    const tierOptions: SelectOption[] = TIER_ORDER.map(t => ({ value: t, label: TIER_CONFIG[t].label, icon: TIER_CONFIG[t].emoji }));
    const priorityOptions: SelectOption[] = PRIORITY_ORDER.map(p => ({ value: p, label: PRIORITY_CONFIG[p].label }));

    const [name, setName] = useState('');
    const [lane, setLane] = useState('');
    const [tier, setTier] = useState('idea');
    const [priority, setPriority] = useState('medium');
    const [description, setDescription] = useState('');
    const [stack, setStack] = useState<string[]>([]);
    const [stackInput, setStackInput] = useState('');
    const [oss, setOss] = useState(false);
    const [repo, setRepo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const previewPath = lane ? `${lane}/${safeName}` : safeName;

    const addStack = (tech: string) => {
        const t = tech.trim();
        if (t && !stack.includes(t)) setStack([...stack, t]);
        setStackInput('');
    };

    const handleSubmit = async () => {
        if (!name.trim() || !lane) { setError('Name and lane are required'); return; }
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/projects`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), lane, tier, priority, description: description.trim(), stack, oss, repo: repo.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create project');
            navigate('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="mobile-page-header">
                <button className="mobile-page-back" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <span className="mobile-page-title">New Project</span>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting || !name.trim() || !lane}
                    style={{ fontSize: 13, padding: '6px 14px' }}
                >
                    {submitting ? '⏳' : 'Create'}
                </button>
            </div>

            <div className="mobile-form">
                <div className="mobile-form-group">
                    <label className="mobile-form-label">Project Name *</label>
                    <input
                        className="mobile-form-input"
                        placeholder="my-awesome-project"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        autoFocus
                    />
                </div>

                {name && (
                    <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                        📁 {previewPath}/PROJECT.yaml
                    </div>
                )}

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Lane *</label>
                    <SearchableSelect options={laneOptions} value={lane} onChange={setLane} placeholder="Select lane..." allowCreate onCreateNew={setLane} clearable={false} />
                </div>

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Description</label>
                    <textarea
                        className="mobile-form-input mobile-form-textarea"
                        placeholder="What does this project do?"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="mobile-form-group">
                        <label className="mobile-form-label">Tier</label>
                        <SearchableSelect options={tierOptions} value={tier} onChange={setTier} clearable={false} />
                    </div>
                    <div className="mobile-form-group">
                        <label className="mobile-form-label">Priority</label>
                        <SearchableSelect options={priorityOptions} value={priority} onChange={setPriority} clearable={false} />
                    </div>
                </div>

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Tech Stack</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {stack.map(t => (
                            <span
                                key={t}
                                onClick={() => setStack(stack.filter(s => s !== t))}
                                style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
                            >
                                {t} ✕
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {COMMON_STACKS.filter(t => !stack.includes(t)).slice(0, 10).map(t => (
                            <button
                                key={t}
                                onClick={() => addStack(t)}
                                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
                            >
                                + {t}
                            </button>
                        ))}
                    </div>
                    <input
                        className="mobile-form-input"
                        value={stackInput}
                        onChange={e => setStackInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStack(stackInput); } }}
                        placeholder="Custom tech (press Enter)"
                        style={{ fontSize: 13, padding: '8px 12px' }}
                    />
                </div>

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Repository URL (optional)</label>
                    <input
                        className="mobile-form-input"
                        placeholder="https://github.com/..."
                        value={repo}
                        onChange={e => setRepo(e.target.value)}
                    />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={oss}
                        onChange={e => setOss(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                    />
                    Open Source (OSS)
                </label>

                {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: 8, color: 'var(--error)', fontSize: 13 }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
