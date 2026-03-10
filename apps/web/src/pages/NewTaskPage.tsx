import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

const PRIORITY_OPTIONS: SelectOption[] = [
    { value: 'high', label: 'High', icon: '🔴' },
    { value: 'medium', label: 'Medium', icon: '🟡' },
    { value: 'low', label: 'Low', icon: '🔵' },
];

const EFFORT_OPTIONS: SelectOption[] = [
    { value: 'XS', label: 'XS – Tiny' },
    { value: 'S', label: 'S – Small' },
    { value: 'M', label: 'M – Medium' },
    { value: 'L', label: 'L – Large' },
    { value: 'XL', label: 'XL – Epic' },
];

const TYPE_OPTIONS: SelectOption[] = [
    { value: 'feature', label: 'Feature', icon: '✨' },
    { value: 'bug', label: 'Bug', icon: '🐛' },
    { value: 'chore', label: 'Chore', icon: '🔧' },
    { value: 'docs', label: 'Docs', icon: '📝' },
];

export default function NewTaskPage() {
    const navigate = useNavigate();
    const { data: projectData } = useProjects();
    const { user } = useAuth();
    const orgId = (user as any)?.orgId;
    const createTask = useMutation(api.tasks.create);

    const [title, setTitle] = useState('');
    const [project, setProject] = useState('');
    const [priority, setPriority] = useState('medium');
    const [effort, setEffort] = useState('M');
    const [type, setType] = useState('feature');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const projectOptions: SelectOption[] = useMemo(() => {
        return (projectData?.projects ?? []).map(p => {
            const segs = p.path ? p.path.split('/') : [(p as any).name || 'Unknown'];
            return {
                value: (p as any).id || p.path,
                label: segs[segs.length - 1] || p.path,
                sublabel: segs.length > 1 ? segs.slice(0, -1).join('/') : undefined,
                group: segs[0] || 'root',
                icon: '📁',
            };
        });
    }, [projectData]);

    const handleSubmit = async () => {
        if (!title.trim()) { setError('Title is required'); return; }
        if (!orgId) { setError('Organization ID not found'); return; }
        setSubmitting(true);
        setError('');
        try {
            await createTask({
                orgId: orgId as any,
                projectId: project.trim() ? (project as any) : undefined,
                title: title.trim(),
                priority,
                effort,
                description: description.trim(),
                type: type,
                status: 'todo',
            });
            navigate('/tasks');
        } catch (err: any) {
            setError(err.message || 'Failed to create task');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="mobile-page-header">
                <button className="mobile-page-back" onClick={() => navigate('/tasks')}>
                    ← Back
                </button>
                <span className="mobile-page-title">New Task</span>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting || !title.trim()}
                    style={{ fontSize: 13, padding: '6px 14px' }}
                >
                    {submitting ? '⏳' : 'Create'}
                </button>
            </div>

            <div className="mobile-form">
                <div className="mobile-form-group">
                    <label className="mobile-form-label">Title *</label>
                    <input
                        className="mobile-form-input"
                        placeholder="What needs to be done?"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Project</label>
                    <SearchableSelect
                        options={projectOptions}
                        value={project}
                        onChange={setProject}
                        placeholder="Select or type project path"
                        grouped
                        allowCreate
                        onCreateNew={v => setProject(v)}
                    />
                </div>

                <div className="mobile-form-group">
                    <label className="mobile-form-label">Description</label>
                    <textarea
                        className="mobile-form-input mobile-form-textarea"
                        placeholder="Optional description..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="mobile-form-group">
                        <label className="mobile-form-label">Priority</label>
                        <SearchableSelect
                            options={PRIORITY_OPTIONS}
                            value={priority}
                            onChange={setPriority}
                            clearable={false}
                        />
                    </div>
                    <div className="mobile-form-group">
                        <label className="mobile-form-label">Effort</label>
                        <SearchableSelect
                            options={EFFORT_OPTIONS}
                            value={effort}
                            onChange={setEffort}
                            clearable={false}
                        />
                    </div>
                    <div className="mobile-form-group">
                        <label className="mobile-form-label">Type</label>
                        <SearchableSelect
                            options={TYPE_OPTIONS}
                            value={type}
                            onChange={setType}
                            clearable={false}
                        />
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: 8, color: 'var(--error)', fontSize: 13 }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
