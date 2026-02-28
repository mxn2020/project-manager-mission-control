import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useIsMobile } from '../hooks/useMediaQuery';
import { api } from '../lib/api';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

const STATUS_COLS = [
    { key: 'todo', label: 'To Do', icon: '📋', color: '#60a5fa' },
    { key: 'in_progress', label: 'In Progress', icon: '🔨', color: '#fbbf24' },
    { key: 'done', label: 'Done', icon: '✅', color: '#34d399' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: 'High', color: '#f87171' },
    medium: { label: 'Medium', color: '#fbbf24' },
    low: { label: 'Low', color: '#60a5fa' },
};

const EFFORT_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'];

export default function TasksPage() {
    const [tasks, setTasks] = useState<any[] | null>(null);
    const [stats, setStats] = useState<any>(null);
    const { data: projectData } = useProjects();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [showCreate, setShowCreate] = useState(false);
    const [filterPriority, setFilterPriority] = useState('');
    const [filterProject, setFilterProject] = useState('');

    // Create form state
    const [newTitle, setNewTitle] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [newEffort, setNewEffort] = useState('M');
    const [newDescription, setNewDescription] = useState('');
    const [newType, setNewType] = useState('feature');

    const loadTasks = useCallback(async () => {
        try {
            const [t, s] = await Promise.all([api.tasks.list(), api.tasks.stats()]);
            setTasks(t);
            setStats(s);
        } catch (err) {
            console.error('Failed to load tasks:', err);
            setTasks([]);
        }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const allTasks = tasks || [];

    // Build project options from ALL projects
    const projectOptions: SelectOption[] = useMemo(() => {
        const allPaths = new Set<string>();
        for (const p of (projectData?.projects || [])) allPaths.add(p.path);
        for (const t of allTasks) allPaths.add(t.projectPath);
        return [...allPaths].sort().map(p => {
            const segments = p.split('/');
            return {
                value: p,
                label: segments[segments.length - 1] || p,
                sublabel: segments.length > 1 ? segments.slice(0, -1).join('/') : undefined,
                group: segments[0] || 'root',
                icon: '📁',
            };
        });
    }, [projectData, allTasks]);

    // Priority options for filter
    const priorityOptions: SelectOption[] = [
        { value: 'high', label: 'High', icon: '🔴' },
        { value: 'medium', label: 'Medium', icon: '🟡' },
        { value: 'low', label: 'Low', icon: '🔵' },
    ];

    const filtered = allTasks.filter((t: any) => {
        if (filterPriority && t.priority !== filterPriority) return false;
        if (filterProject && t.projectPath !== filterProject) return false;
        return true;
    });

    const handleCreate = async () => {
        if (!newTitle.trim() || !newProject.trim()) return;
        await api.tasks.create({
            title: newTitle.trim(),
            projectPath: newProject.trim(),
            priority: newPriority,
            effort: newEffort,
            description: newDescription.trim(),
            taskType: newType,
        });
        setNewTitle('');
        setNewProject('');
        setNewDescription('');
        setShowCreate(false);
        await loadTasks();
    };

    const handleStatusChange = async (id: string, status: string) => {
        await api.tasks.update(id, { status });
        await loadTasks();
    };

    const handleDelete = async (id: string) => {
        await api.tasks.delete(id);
        await loadTasks();
    };

    const renderKanban = () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
            {STATUS_COLS.map(col => {
                const colTasks = filtered.filter((t: any) => t.status === col.key);
                return (
                    <div key={col.key} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, minHeight: 300 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${col.color}` }}>
                            <span>{col.icon}</span>
                            <span style={{ fontWeight: 600 }}>{col.label}</span>
                            <span style={{ background: col.color + '25', color: col.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, marginLeft: 'auto' }}>
                                {colTasks.length}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {colTasks.map((task: any) => (
                                <div key={task.id} style={{
                                    background: 'var(--bg-primary)', borderRadius: 8, padding: 12,
                                    border: '1px solid var(--border)', transition: 'transform 0.15s',
                                }}>
                                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{task.title}</div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            background: (PRIORITY_CONFIG[task.priority]?.color || '#6b7280') + '20',
                                            color: PRIORITY_CONFIG[task.priority]?.color || '#6b7280',
                                        }}>
                                            {task.priority}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{task.effort}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                            {task.projectPath}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                        {STATUS_COLS.filter(s => s.key !== task.status).map(s => (
                                            <button
                                                key={s.key}
                                                onClick={() => handleStatusChange(task.id, s.key)}
                                                style={{
                                                    padding: '3px 8px', fontSize: 10, borderRadius: 4,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                                }}
                                                title={`Move to ${s.label}`}
                                            >
                                                {s.icon} {s.label}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => handleDelete(task.id)}
                                            style={{
                                                padding: '3px 6px', fontSize: 10, borderRadius: 4,
                                                background: 'rgba(248,113,113,0.1)', border: 'none',
                                                color: '#f87171', cursor: 'pointer', marginLeft: 'auto',
                                            }}
                                            title="Delete"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderList = () => (
        <div className="task-list" style={{ marginTop: 16 }}>
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-text">No tasks yet — create one to get started</div>
                </div>
            ) : (
                filtered.map((task: any) => (
                    <div key={task.id} className="task-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div
                            className={`task-checkbox ${task.status === 'done' ? 'done' : ''}`}
                            onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done')}
                            style={{
                                width: 20, height: 20, borderRadius: 4, cursor: 'pointer',
                                border: `2px solid ${task.status === 'done' ? '#34d399' : 'var(--border)'}`,
                                background: task.status === 'done' ? '#34d399' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 12, flexShrink: 0,
                            }}
                        >
                            {task.status === 'done' && '✓'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontWeight: 500, fontSize: 13,
                                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                opacity: task.status === 'done' ? 0.5 : 1,
                            }}>{task.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {task.projectPath} · {task.taskType}
                            </div>
                        </div>
                        <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: (PRIORITY_CONFIG[task.priority]?.color || '#6b7280') + '20',
                            color: PRIORITY_CONFIG[task.priority]?.color || '#6b7280',
                        }}>
                            {task.priority}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', width: 24, textAlign: 'center' }}>{task.effort}</span>
                        <button
                            onClick={() => handleDelete(task.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}
                        >✕</button>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">📋 Tasks</h1>
                        <p className="page-description">Cross-project task management · Minions-backed</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => isMobile ? navigate('/tasks/new') : setShowCreate(!showCreate)} style={{ flexShrink: 0 }}>
                        + New Task
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            {stats && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    {STATUS_COLS.map(col => (
                        <div key={col.key} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13,
                        }}>
                            <span>{col.icon}</span>
                            <span style={{ fontWeight: 600 }}>{stats.byStatus[col.key] || 0}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{col.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <input
                            placeholder="Task title *"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }}
                        />
                        <SearchableSelect
                            options={projectOptions}
                            value={newProject}
                            onChange={setNewProject}
                            placeholder="Select project *"
                            grouped
                            allowCreate
                            onCreateNew={(v) => setNewProject(v)}
                        />
                    </div>
                    <textarea
                        placeholder="Description (optional)"
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, minHeight: 60, resize: 'vertical', marginBottom: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <SearchableSelect
                            options={priorityOptions}
                            value={newPriority}
                            onChange={setNewPriority}
                            placeholder="Priority"
                            clearable={false}
                            width="130px"
                        />
                        <SearchableSelect
                            options={EFFORT_OPTIONS.map(e => ({ value: e, label: e }))}
                            value={newEffort}
                            onChange={setNewEffort}
                            placeholder="Effort"
                            clearable={false}
                            width="80px"
                        />
                        <SearchableSelect
                            options={[
                                { value: 'feature', label: 'Feature', icon: '✨' },
                                { value: 'bug', label: 'Bug', icon: '🐛' },
                                { value: 'chore', label: 'Chore', icon: '🔧' },
                                { value: 'docs', label: 'Docs', icon: '📝' },
                            ]}
                            value={newType}
                            onChange={setNewType}
                            placeholder="Type"
                            clearable={false}
                            width="120px"
                        />
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: 12 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newTitle.trim() || !newProject.trim()} style={{ fontSize: 12 }}>Create</button>
                    </div>
                </div>
            )}

            {/* View Toggle & Filters */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button className={view === 'kanban' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('kanban')} style={{ borderRadius: 0, fontSize: 12 }}>⊞ Kanban</button>
                    <button className={view === 'list' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView('list')} style={{ borderRadius: 0, fontSize: 12 }}>☰ List</button>
                </div>
                <SearchableSelect
                    options={priorityOptions}
                    value={filterPriority}
                    onChange={setFilterPriority}
                    placeholder="All Priorities"
                    width="150px"
                />
                <SearchableSelect
                    options={projectOptions}
                    value={filterProject}
                    onChange={setFilterProject}
                    placeholder="All Projects"
                    grouped
                    width="200px"
                />
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} tasks</span>
            </div>

            {tasks === null ? (
                <div className="loading"><div className="loading-spinner" /> Loading tasks...</div>
            ) : view === 'kanban' ? renderKanban() : renderList()}
        </div>
    );
}
