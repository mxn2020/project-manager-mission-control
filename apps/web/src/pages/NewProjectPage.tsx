import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
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
    const { user } = useAuth();
    const orgId = (user as any)?.orgId;
    const createProject = useMutation(api.projects.create);

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
        if (!orgId) { setError('Organization ID not found. Ensure you are logged in correctly.'); return; }
        setSubmitting(true);
        setError('');
        try {
            await createProject({
                orgId: orgId as any,
                name: name.trim(),
                lane,
                tier,
                priority,
                description: description.trim(),
                stack,
                oss,
                repo: repo.trim() || undefined,
            });
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Failed to create project');
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
                    className="btn btn-primary text-md"
                    onClick={handleSubmit}
                    disabled={submitting || !name.trim() || !lane}
                    style={{ padding: '6px 14px' }}
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
                    <div className="font-mono text-sm text-tertiary" style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
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

                <div className="grid-2 gap-12">
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
                    <div className="flex-row flex-wrap gap-4 mb-8">
                        {stack.map(t => (
                            <span
                                key={t}
                                onClick={() => setStack(stack.filter(s => s !== t))}
                                className="tag text-base" style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
                            >
                                {t} ✕
                            </span>
                        ))}
                    </div>
                    <div className="flex-row flex-wrap gap-4 mb-8">
                        {COMMON_STACKS.filter(t => !stack.includes(t)).slice(0, 10).map(t => (
                            <button
                                key={t}
                                onClick={() => addStack(t)}
                                className="text-sm" style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
                            >
                                + {t}
                            </button>
                        ))}
                    </div>
                    <input
                        className="mobile-form-input text-md"
                        value={stackInput}
                        onChange={e => setStackInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStack(stackInput); } }}
                        placeholder="Custom tech (press Enter)"
                        style={{ padding: '8px 12px' }}
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

                <label className="flex-row gap-10 text-lg" style={{ cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={oss}
                        onChange={e => setOss(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                    />
                    Open Source (OSS)
                </label>

                {error && (
                    <div className="text-md" style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: 8, color: 'var(--error)' }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
