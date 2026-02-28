import { useState } from 'react';
import { getAuthHeaders, API_BASE } from '../lib/api';
import SearchableSelect, { type SelectOption } from './SearchableSelect';
import { TIER_ORDER, PRIORITY_ORDER, TIER_CONFIG, PRIORITY_CONFIG } from '../lib/types';

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

    const handleSubmit = async () => {
        if (!name.trim() || !lane) { setError('Name and lane are required'); return; }
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/projects`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(), lane, tier, priority, description: description.trim(),
                    stack, oss, repo: repo.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create project');
            onCreated(data.path);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const previewPath = lane ? `${lane}/${safeName}` : safeName;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)',
                width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>✨ Create New Project</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>

                {/* Form */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Name + Lane */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Project Name *</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-awesome-project"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Lane *</label>
                            <SearchableSelect options={laneOptions} value={lane} onChange={setLane} placeholder="Select lane..." allowCreate onCreateNew={setLane} clearable={false} />
                        </div>
                    </div>

                    {/* Path Preview */}
                    {name && (
                        <div style={{ padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                            📁 {previewPath}/PROJECT.yaml
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this project do?"
                            rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    {/* Tier + Priority + OSS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Tier</label>
                            <SearchableSelect options={tierOptions} value={tier} onChange={setTier} placeholder="Tier" clearable={false} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Priority</label>
                            <SearchableSelect options={priorityOptions} value={priority} onChange={setPriority} placeholder="Priority" clearable={false} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, padding: '8px 0' }}>
                            <input type="checkbox" checked={oss} onChange={e => setOss(e.target.checked)} />
                            OSS
                        </label>
                    </div>

                    {/* Stack */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Tech Stack</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {stack.map(t => (
                                <span key={t} onClick={() => setStack(stack.filter(s => s !== t))}
                                    style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                                    {t} ✕
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {COMMON_STACKS.filter(t => !stack.includes(t)).slice(0, 12).map(t => (
                                <button key={t} onClick={() => addStack(t)}
                                    style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                    + {t}
                                </button>
                            ))}
                        </div>
                        <input value={stackInput} onChange={e => setStackInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStack(stackInput); } }}
                            placeholder="Custom tech..."
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, marginTop: 6, boxSizing: 'border-box' }} />
                    </div>

                    {/* Repo URL */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Repository URL (optional)</label>
                        <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/..."
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '8px 12px', background: '#f8717115', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !name.trim() || !lane}>
                        {submitting ? '⏳ Creating...' : '✨ Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}
