import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';
import SearchableSelect, { type SelectOption } from './SearchableSelect';
import { TIER_ORDER, PRIORITY_ORDER, TIER_CONFIG, PRIORITY_CONFIG } from '../lib/types';

const CATEGORY_OPTIONS: SelectOption[] = [
    { value: 'webapp', label: 'Web App', icon: '🌐' },
    { value: 'fullstack-app', label: 'Full-Stack App', icon: '🏗️' },
    { value: 'monorepo-app', label: 'Monorepo App', icon: '📦' },
    { value: 'oss-tool', label: 'Open Source Tool', icon: '🔓' },
    { value: 'ui-package', label: 'UI Package', icon: '🎨' },
    { value: 'library', label: 'Library / Package', icon: '📚' },
    { value: 'boilerplate', label: 'Boilerplate / Template', icon: '🧩' },
    { value: 'minion-toolbox', label: 'Minion Toolbox', icon: '🤖' },
    { value: 'backend-service', label: 'Backend Service', icon: '⚙️' },
    { value: 'client-project', label: 'Client Project', icon: '💼' },
];

interface CreateProjectModalProps {
    onClose: () => void;
    onCreated: (path: string) => void;
    lanes: string[];
}

const COMMON_STACKS = [
    'React', 'Next.js', 'Vite', 'TypeScript', 'JavaScript', 'Node.js', 'Express',
    'Python', 'FastAPI', 'Convex', 'Supabase', 'PostgreSQL', 'MongoDB',
    'TailwindCSS', 'CSS', 'Docker', 'Vercel', 'AWS', 'Stripe',
];

export default function CreateProjectModal({ onClose, onCreated, lanes }: CreateProjectModalProps) {
    const [name, setName] = useState('');
    const [lane, setLane] = useState('');
    const [tier, setTier] = useState('idea');
    const [priority, setPriority] = useState('medium');
    const [description, setDescription] = useState('');
    const [stack, setStack] = useState<string[]>([]);
    const [stackInput, setStackInput] = useState('');
    const [oss, setOss] = useState(false);
    const [repo, setRepo] = useState('');
    const [projectCategory, setProjectCategory] = useState('webapp');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const laneOptions: SelectOption[] = [...new Set(lanes)].sort().map(l => ({ value: l, label: l }));
    const tierOptions: SelectOption[] = TIER_ORDER.map(t => ({
        value: t, label: TIER_CONFIG[t].label, icon: TIER_CONFIG[t].emoji,
    }));
    const priorityOptions: SelectOption[] = PRIORITY_ORDER.map(p => ({
        value: p, label: PRIORITY_CONFIG[p].label,
    }));

    const addStack = (tech: string) => {
        const t = tech.trim();
        if (t && !stack.includes(t)) setStack([...stack, t]);
        setStackInput('');
    };

    const { user } = useAuth();
    const orgId = user?.orgId;
    const createProject = useMutation(api.projects.create);

    const handleSubmit = async () => {
        if (!name.trim() || !lane) { setError('Name and lane are required'); return; }
        if (!orgId) { setError('Organization ID not found'); return; }
        setSubmitting(true);
        setError('');
        try {
            const newProjectId = await createProject({
                orgId: orgId as Id<"organizations">,
                name: name.trim(),
                lane,
                tier,
                priority,
                description: description.trim(),
                stack,
                oss,
                repo: repo.trim() || undefined,
                projectCategory,
            });
            onCreated(newProjectId as string);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const previewPath = lane ? `${lane}/${safeName}` : safeName;

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-content" style={{ maxWidth: 560 }}>
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">✨ Create New Project</h2>
                    <button onClick={onClose} className="icon-btn text-tertiary text-2xl">✕</button>
                </div>

                {/* Form */}
                <div className="modal-body flex-col gap-16">
                    {/* Name + Lane */}
                    <div className="grid-2 gap-12">
                        <div>
                            <label className="form-label">Project Name *</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-awesome-project"
                                className="form-input" />
                        </div>
                        <div>
                            <label className="form-label">Lane *</label>
                            <SearchableSelect options={laneOptions} value={lane} onChange={setLane} placeholder="Select lane..." allowCreate onCreateNew={setLane} clearable={false} />
                        </div>
                    </div>

                    {/* Path Preview */}
                    {name && (
                        <div className="font-mono text-sm text-tertiary" style={{ padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 6 }}>
                            📁 {previewPath}/PROJECT.yaml
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="form-label">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this project do?"
                            rows={2} className="form-textarea" />
                    </div>

                    {/* Tier + Priority + OSS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        <div>
                            <label className="form-label">Tier</label>
                            <SearchableSelect options={tierOptions} value={tier} onChange={setTier} placeholder="Tier" clearable={false} />
                        </div>
                        <div>
                            <label className="form-label">Priority</label>
                            <SearchableSelect options={priorityOptions} value={priority} onChange={setPriority} placeholder="Priority" clearable={false} />
                        </div>
                        <label className="flex-row gap-6 text-base" style={{ cursor: 'pointer', padding: '8px 0' }}>
                            <input type="checkbox" checked={oss} onChange={e => setOss(e.target.checked)} />
                            OSS
                        </label>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="form-label">Project Category</label>
                        <SearchableSelect options={CATEGORY_OPTIONS} value={projectCategory} onChange={setProjectCategory} placeholder="Select category..." clearable={false} />
                    </div>

                    {/* Stack */}
                    <div>
                        <label className="form-label">Tech Stack</label>
                        <div className="flex-row flex-wrap gap-4 mb-6">
                            {stack.map(t => (
                                <span key={t} onClick={() => setStack(stack.filter(s => s !== t))}
                                    className="tag text-sm" style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                                    {t} ✕
                                </span>
                            ))}
                        </div>
                        <div className="flex-row flex-wrap gap-4">
                            {COMMON_STACKS.filter(t => !stack.includes(t)).slice(0, 12).map(t => (
                                <button key={t} onClick={() => addStack(t)}
                                    className="text-xs" style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                    + {t}
                                </button>
                            ))}
                        </div>
                        <input value={stackInput} onChange={e => setStackInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStack(stackInput); } }}
                            placeholder="Custom tech..."
                            className="form-input-sm mt-6" />
                    </div>

                    {/* Repo URL */}
                    <div>
                        <label className="form-label">Repository URL (optional)</label>
                        <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/..."
                            className="form-input" />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-base" style={{ padding: '8px 12px', background: '#f8717115', borderRadius: 6, color: '#f87171' }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !name.trim() || !lane}>
                        {submitting ? '⏳ Creating...' : '✨ Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}
