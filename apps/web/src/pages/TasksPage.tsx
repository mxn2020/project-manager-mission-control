import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useIsMobile } from '../hooks/useMediaQuery';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import { PageHeader, GripIcon, FormInput, FormTextarea, EmptyState } from '../components/ui';
import type { Id } from '../lib/types';

// ─── Lineage Config ──────────────────────────────────────────────────────
const LINEAGE_CONFIG = {
    sprint: { icon: '🏃', label: 'Sprint', color: '#60a5fa', path: '/development' },
    feature: { icon: '✨', label: 'Feature', color: '#818cf8', path: '/roadmap' },
    campaign: { icon: '📢', label: 'Campaign', color: '#f472b6', path: '/marketing' },
} as const;

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
    const { orgId } = useAuth();
    const { data: projectData } = useProjects();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [urlFilters, setUrlFilter] = useUrlFilters({ view: 'kanban', priority: '', project: '', category: '' });
    const view = (urlFilters.view || 'kanban') as 'kanban' | 'list';
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState('');
    const filterPriority = urlFilters.priority;
    const filterProject = urlFilters.project;
    const filterCategory = urlFilters.category;

    // Convex queries & mutations
    const rawTasks = useQuery(api.tasks.list, orgId ? { orgId, status: undefined, priority: undefined, projectPath: undefined, category: filterCategory || undefined } : "skip");
    const stats = useQuery(api.tasks.getStats, orgId ? { orgId } : "skip");
    const createTask = useMutation(api.tasks.create);
    const updateTask = useMutation(api.tasks.update);
    const deleteTask = useMutation(api.tasks.remove);

    const tasks = rawTasks ? rawTasks.map(t => ({ ...t, id: t._id })) : null;
    const allTasks = tasks || [];

    // DnD state
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

    // Create form state
    const [newTitle, setNewTitle] = useState('');
    const [newProject, setNewProject] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [newEffort, setNewEffort] = useState('M');
    const [newDescription, setNewDescription] = useState('');
    const [newType, setNewType] = useState('feature');

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

    const filtered = allTasks.filter(t => {
        if (search) {
            const q = search.toLowerCase();
            if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
        }
        if (filterPriority && t.priority !== filterPriority) return false;
        if (filterProject && t.projectPath !== filterProject) return false;
        return true;
    });

    const handleCreate = async () => {
        if (!newTitle.trim() || !orgId) return;

        // Find if projectPath exists in projectData to get projectId
        const projMatch = projectData?.projects.find(p => p.path === newProject.trim());

        await createTask({
            orgId,
            title: newTitle.trim(),
            projectPath: newProject.trim() || '(general)',
            projectId: (projMatch?.path || newProject.trim()) as Id<"projects"> | undefined,
            priority: newPriority,
            effort: newEffort,
            description: newDescription.trim(),
            taskType: newType,
        });
        setNewTitle('');
        setNewProject('');
        setNewDescription('');
        setShowCreate(false);
    };

    const handleStatusChange = async (id: string, status: string) => {
        await updateTask({ taskId: id as Id<"tasks">, status });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this task?')) {
            await deleteTask({ taskId: id as Id<"tasks"> });
        }
    };

    // ─── DnD Handlers ───────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
        requestAnimationFrame(() => {
            const el = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
            if (el) el.classList.add('dragging');
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        document.querySelectorAll('.task-kanban-card.dragging').forEach(el => el.classList.remove('dragging'));
        setDraggedTaskId(null);
        setDragOverStatus(null);
    }, []);

    const handleColumnDragOver = useCallback((e: React.DragEvent, status: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverStatus(status);
    }, []);

    const handleColumnDragLeave = useCallback(() => {
        setDragOverStatus(null);
    }, []);

    const handleColumnDrop = useCallback(async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        setDragOverStatus(null);

        if (!draggedTaskId) return;

        // Find the task's current status
        const task = allTasks.find(t => t.id === draggedTaskId);
        if (!task || task.status === targetStatus) {
            setDraggedTaskId(null);
            return;
        }

        setDraggedTaskId(null);
        await handleStatusChange(draggedTaskId, targetStatus);
    }, [draggedTaskId, allTasks, handleStatusChange]);

    const renderKanban = () => (
        <div className="gap-16 mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {STATUS_COLS.map(col => {
                const colTasks = filtered.filter(t => t.status === col.key);
                return (
                    <div
                        key={col.key}
                        className={`task-kanban-column ${dragOverStatus === col.key ? 'drag-over' : ''}`}
                        style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, minHeight: 300, border: '1px solid var(--border)' }}
                        onDragOver={(e) => handleColumnDragOver(e, col.key)}
                        onDragLeave={handleColumnDragLeave}
                        onDrop={(e) => handleColumnDrop(e, col.key)}
                    >
                        <div className="flex-row gap-8 mb-16" style={{ paddingBottom: 12, borderBottom: `2px solid ${col.color}`, alignItems: 'center' }}>
                            <span>{col.icon}</span>
                            <span className="font-semibold">{col.label}</span>
                            <span className="text-sm font-semibold" style={{ background: col.color + '25', color: col.color, padding: '2px 8px', borderRadius: 10, marginLeft: 'auto' }}>
                                {colTasks.length}
                            </span>
                        </div>
                        <div className="flex-col gap-8">
                            {colTasks.map(task => (
                                <div
                                    key={task.id}
                                    className="task-kanban-card"
                                    data-task-id={task.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="flex-row gap-8" style={{ alignItems: 'flex-start' }}>
                                        <GripIcon size={14} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-md mb-6">{task.title}</div>
                                            <div className="flex-row flex-wrap gap-6">
                                                <span className="text-xs font-semibold" style={{
                                                    padding: '1px 6px', borderRadius: 4,
                                                    background: (PRIORITY_CONFIG[task.priority]?.color || '#6b7280') + '20',
                                                    color: PRIORITY_CONFIG[task.priority]?.color || '#6b7280',
                                                }}>{task.priority}</span>
                                                <span className="text-xs text-tertiary font-mono">{task.effort}</span>
                                                <span className="text-xs text-tertiary truncate" style={{ maxWidth: 120 }}>
                                                    {task.projectPath}
                                                </span>
                                            </div>
                                            {/* Lineage Breadcrumbs */}
                                            {(task.sprintId || task.featureId || task.campaignId) && (
                                                <div className="flex-row flex-wrap gap-4 mt-4">
                                                    {task.featureId && (
                                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.feature.color}15`, color: LINEAGE_CONFIG.feature.color, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); navigate(LINEAGE_CONFIG.feature.path); }} title="View Feature">{LINEAGE_CONFIG.feature.icon} Feature</span>
                                                    )}
                                                    {task.sprintId && (
                                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.sprint.color}15`, color: LINEAGE_CONFIG.sprint.color, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); navigate(LINEAGE_CONFIG.sprint.path); }} title="View Sprint">{LINEAGE_CONFIG.sprint.icon} Sprint</span>
                                                    )}
                                                    {task.campaignId && (
                                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.campaign.color}15`, color: LINEAGE_CONFIG.campaign.color, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); navigate(LINEAGE_CONFIG.campaign.path); }} title="View Campaign">{LINEAGE_CONFIG.campaign.icon} Campaign</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex-row gap-4 mt-8">
                                                {STATUS_COLS.filter(s => s.key !== task.status).map(s => (
                                                    <button
                                                        key={s.key}
                                                        onClick={() => handleStatusChange(task.id, s.key)}
                                                        className="text-xs" style={{
                                                            padding: '3px 8px', borderRadius: 4,
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
                                                    className="icon-btn text-xs" style={{
                                                        background: 'rgba(248,113,113,0.1)',
                                                        color: '#f87171', marginLeft: 'auto',
                                                    }}
                                                    title="Delete"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
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
        <div className="mt-16">
            {filtered.length === 0 ? (
                <EmptyState icon="📋" message="No tasks yet — create one to get started" />
            ) : (
                filtered.map(task => (
                    <div key={task.id} className="flex-row gap-12" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                        <div
                            className={`flex-center flex-shrink-0 ${task.status === 'done' ? 'done' : ''}`}
                            onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done')}
                            style={{
                                width: 20, height: 20, borderRadius: 4, cursor: 'pointer',
                                border: `2px solid ${task.status === 'done' ? '#34d399' : 'var(--border)'}`,
                                background: task.status === 'done' ? '#34d399' : 'transparent',
                                color: 'white', fontSize: 12,
                            }}
                        >
                            {task.status === 'done' && '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-md" style={{
                                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                opacity: task.status === 'done' ? 0.5 : 1,
                            }}>{task.title}</div>
                            <div className="text-sm text-tertiary mt-4">
                                {task.projectPath} · {task.taskType}
                            </div>
                            {/* Lineage Breadcrumbs */}
                            {(task.sprintId || task.featureId || task.campaignId) && (
                                <div className="flex-row flex-wrap gap-4 mt-4">
                                    {task.featureId && (
                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.feature.color}15`, color: LINEAGE_CONFIG.feature.color, cursor: 'pointer' }} onClick={() => navigate(LINEAGE_CONFIG.feature.path)} title="View Feature">{LINEAGE_CONFIG.feature.icon} Feature</span>
                                    )}
                                    {task.sprintId && (
                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.sprint.color}15`, color: LINEAGE_CONFIG.sprint.color, cursor: 'pointer' }} onClick={() => navigate(LINEAGE_CONFIG.sprint.path)} title="View Sprint">{LINEAGE_CONFIG.sprint.icon} Sprint</span>
                                    )}
                                    {task.campaignId && (
                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: `${LINEAGE_CONFIG.campaign.color}15`, color: LINEAGE_CONFIG.campaign.color, cursor: 'pointer' }} onClick={() => navigate(LINEAGE_CONFIG.campaign.path)} title="View Campaign">{LINEAGE_CONFIG.campaign.icon} Campaign</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-semibold" style={{
                            padding: '2px 8px', borderRadius: 4,
                            background: (PRIORITY_CONFIG[task.priority]?.color || '#6b7280') + '20',
                            color: PRIORITY_CONFIG[task.priority]?.color || '#6b7280',
                        }}>
                            {task.priority}
                        </span>
                        <span className="text-sm text-tertiary font-mono text-center" style={{ width: 24 }}>{task.effort}</span>
                        <button onClick={() => handleDelete(task.id)} className="icon-btn text-tertiary text-base">✕</button>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div>
            <PageHeader
                title="📋 Tasks"
                description="Cross-project task management · Powered by Convex"
                actions={
                    <button className="btn btn-primary flex-shrink-0" onClick={() => isMobile ? navigate('/tasks/new') : setShowCreate(!showCreate)}>
                        + New Task
                    </button>
                }
            />

            {/* Category Tabs */}
            <div className="flex-row gap-4 mb-16">
                {[{ key: '', label: 'All', icon: '📋' }, { key: 'development', label: 'Development', icon: '🏗️' }, { key: 'marketing', label: 'Marketing', icon: '📣' }, { key: 'general', label: 'General', icon: '📌' }].map(tab => (
                    <button
                        key={tab.key}
                        className={`btn text-sm ${filterCategory === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setUrlFilter('category', tab.key)}
                        style={{ padding: '6px 14px' }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="flex-row flex-wrap gap-12 mb-16">
                    {STATUS_COLS.map(col => (
                        <div key={col.key} className="flex-row gap-6 text-md" style={{
                            padding: '6px 12px', alignItems: 'center',
                            background: 'var(--bg-secondary)', borderRadius: 8,
                        }}>
                            <span>{col.icon}</span>
                            <span className="font-semibold">{stats.byStatus[col.key] || 0}</span>
                            <span className="text-sm text-tertiary">{col.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Search + Filters */}
            <div className="filter-bar flex-row flex-wrap gap-8 mb-16">
                <FormInput value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search tasks..."
                    inputSize="sm" style={{ width: 200, background: 'var(--bg-secondary)' }} />
                <span className="text-sm text-tertiary" style={{ lineHeight: '32px' }}>{filtered.length} tasks</span>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <div className="grid-2 gap-12 mb-12">
                        <FormInput
                            placeholder="Task title *"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
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
                    <FormTextarea
                        placeholder="Description (optional)"
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        className="mb-12" style={{ minHeight: 60 }}
                    />
                    <div className="flex-row gap-12">
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
                        <div className="flex-1" />
                        <button className="btn btn-secondary text-base" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary text-base" onClick={handleCreate} disabled={!newTitle.trim()}>Create</button>
                    </div>
                </div>
            )}

            {/* View Toggle & Filters */}
            <div className="filter-bar flex-row flex-wrap gap-8">
                <div className="flex-row" style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button className={view === 'kanban' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setUrlFilter('view', 'kanban')} style={{ borderRadius: 0, fontSize: 12 }}>⊞ Kanban</button>
                    <button className={view === 'list' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setUrlFilter('view', 'list')} style={{ borderRadius: 0, fontSize: 12 }}>☰ List</button>
                </div>
                <SearchableSelect
                    options={priorityOptions}
                    value={filterPriority}
                    onChange={(v) => setUrlFilter('priority', v)}
                    placeholder="All Priorities"
                    width="150px"
                />
                <SearchableSelect
                    options={projectOptions}
                    value={filterProject}
                    onChange={(v) => setUrlFilter('project', v)}
                    placeholder="All Projects"
                    grouped
                    width={isMobile ? '100%' : '350px'}
                />
                <span className="text-base text-tertiary" style={{ marginLeft: 'auto' }}>{filtered.length} tasks</span>
            </div>

            {tasks === null ? (
                <div className="loading"><div className="loading-spinner" /> Loading tasks...</div>
            ) : view === 'kanban' ? renderKanban() : renderList()}
        </div>
    );
}
