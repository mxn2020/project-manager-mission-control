import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PageHeader, EmptyState, StatCard, FormInput, FormTextarea } from '../components/ui';
import { GripIcon } from '../components/ui';
import AIChatPanel, { DEV_PROFILES } from '../components/AIChatPanel';
import SearchableSelect from '../components/SearchableSelect';
import type { Id } from '../lib/types';

// ─── Constants ───────────────────────────────────────────────────────────

const SPRINT_STATUS_COLS = [
    { key: 'planning', label: 'Planning', icon: '📋', color: '#60a5fa' },
    { key: 'active', label: 'Active', icon: '🏃', color: '#fbbf24' },
    { key: 'completed', label: 'Completed', icon: '✅', color: '#34d399' },
];

const DEV_TASK_COLS = [
    { key: 'todo', label: 'To Do', icon: '📋', color: '#60a5fa' },
    { key: 'in_progress', label: 'In Progress', icon: '🔨', color: '#fbbf24' },
    { key: 'in_review', label: 'In Review', icon: '👀', color: '#a78bfa' },
    { key: 'done', label: 'Done', icon: '✅', color: '#34d399' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: '#ef4444' },
    high: { label: 'High', color: '#f87171' },
    medium: { label: 'Medium', color: '#fbbf24' },
    low: { label: 'Low', color: '#60a5fa' },
};

// ─── Component ───────────────────────────────────────────────────────────

export default function DevelopmentPage() {
    const { orgId } = useAuth();
    const { data: projectData } = useProjects();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'sprints' | 'board' | 'timeline' | 'metrics'>('sprints');
    const [showCreateSprint, setShowCreateSprint] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);

    // ─── Queries ─────────────────────────────────────────────────────────
    const sprints = useQuery(api.devSprints.list, orgId ? { orgId } : 'skip');
    const sprintStats = useQuery(api.devSprints.getStats, orgId ? { orgId } : 'skip');
    const features = useQuery(api.features.list, orgId ? { orgId } : 'skip');
    const featureStats = useQuery(api.features.getStats, orgId ? { orgId } : 'skip');
    const devTasks = useQuery(api.tasks.list, orgId ? { orgId, category: 'development' } : 'skip');

    // ─── Mutations ───────────────────────────────────────────────────────
    const createSprint = useMutation(api.devSprints.create);
    const updateSprint = useMutation(api.devSprints.update);
    const deleteSprint = useMutation(api.devSprints.remove);
    const generateDevTasks = useMutation(api.devSprints.generateDevTasks);
    const updateTask = useMutation(api.tasks.update);

    // ─── Create Sprint Form State ────────────────────────────────────────
    const [newSprintName, setNewSprintName] = useState('');
    const [newSprintDesc, setNewSprintDesc] = useState('');
    const [newSprintProject, setNewSprintProject] = useState('');
    const [newSprintFeatures, setNewSprintFeatures] = useState<string[]>([]);

    // ─── DnD State ───────────────────────────────────────────────────────
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    const projectOptions = useMemo(() => {
        return (projectData?.projects || []).map(p => ({
            value: p.id,
            label: p.name,
            sublabel: p.path,
            group: p.lane || 'other',
            icon: '📁',
        }));
    }, [projectData]);

    const featureOptions = useMemo(() => {
        return (features || []).map(f => ({
            value: f._id,
            label: f.title,
            sublabel: f.status,
            icon: '✨',
        }));
    }, [features]);

    // ─── Handlers ────────────────────────────────────────────────────────

    const handleCreateSprint = async () => {
        if (!newSprintName.trim() || !orgId) return;
        await createSprint({
            orgId,
            name: newSprintName.trim(),
            description: newSprintDesc.trim(),
            projectId: newSprintProject ? newSprintProject as Id<"projects"> : undefined,
            featureIds: newSprintFeatures as Id<"features">[],
        });
        setNewSprintName('');
        setNewSprintDesc('');
        setNewSprintProject('');
        setNewSprintFeatures([]);
        setShowCreateSprint(false);
    };

    const handleGenerateTasks = async (sprintId: string) => {
        if (!orgId) return;
        const result = await generateDevTasks({ sprintId: sprintId as Id<"devSprints">, orgId });
        alert(`Generated ${result.created} dev tasks!`);
    };

    const handleSprintStatusChange = async (sprintId: string, status: string) => {
        await updateSprint({ sprintId: sprintId as Id<"devSprints">, status });
    };

    const handleTaskStatusChange = async (taskId: string, status: string) => {
        await updateTask({ taskId: taskId as Id<"tasks">, status });
    };

    // ─── DnD Handlers ────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedId(null);
        setDragOverCol(null);
    }, []);

    const handleColDragOver = useCallback((e: React.DragEvent, col: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCol(col);
    }, []);

    const handleColDragLeave = useCallback(() => setDragOverCol(null), []);

    // ─── Tab: Sprints ────────────────────────────────────────────────────

    const renderSprintsTab = () => {
        const allSprints = sprints || [];
        return (
            <div>
                {/* Create Sprint Form */}
                {showCreateSprint && (
                    <div className="section-card mb-16">
                        <div className="grid-2 gap-12 mb-12">
                            <FormInput value={newSprintName} onChange={e => setNewSprintName(e.target.value)} placeholder="Sprint name *" />
                            <SearchableSelect
                                options={projectOptions}
                                value={newSprintProject}
                                onChange={setNewSprintProject}
                                placeholder="Select project"
                                grouped
                            />
                        </div>
                        <FormTextarea value={newSprintDesc} onChange={e => setNewSprintDesc(e.target.value)} placeholder="Description (optional)" style={{ minHeight: 60 }} />
                        <div className="flex-row gap-12 mt-12">
                            <div className="flex-1" />
                            <button className="btn btn-secondary text-base" onClick={() => setShowCreateSprint(false)}>Cancel</button>
                            <button className="btn btn-primary text-base" onClick={handleCreateSprint} disabled={!newSprintName.trim()}>Create Sprint</button>
                        </div>
                    </div>
                )}

                {/* Sprints Kanban */}
                <div className="gap-16 mt-16" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' }}>
                    {SPRINT_STATUS_COLS.map(col => {
                        const colSprints = allSprints.filter(s => s.status === col.key);
                        return (
                            <div key={col.key} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, minHeight: 300, border: '1px solid var(--border)' }}>
                                <div className="flex-row gap-8 mb-16" style={{ paddingBottom: 12, borderBottom: `2px solid ${col.color}`, alignItems: 'center' }}>
                                    <span>{col.icon}</span>
                                    <span className="font-semibold">{col.label}</span>
                                    <span className="text-sm font-semibold" style={{ background: col.color + '25', color: col.color, padding: '2px 8px', borderRadius: 10, marginLeft: 'auto' }}>
                                        {colSprints.length}
                                    </span>
                                </div>
                                <div className="flex-col gap-8">
                                    {colSprints.map(sprint => (
                                        <div key={sprint._id} className="task-kanban-card">
                                            <div className="font-medium text-md mb-6">{sprint.name}</div>
                                            {sprint.description && <div className="text-sm text-secondary mb-8">{sprint.description}</div>}
                                            <div className="flex-row flex-wrap gap-6 mb-8">
                                                <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
                                                    {sprint.featureIds.length} features
                                                </span>
                                                {sprint.startDate && (
                                                    <span className="text-xs text-tertiary">
                                                        {new Date(sprint.startDate).toLocaleDateString()}
                                                        {sprint.endDate && ` → ${new Date(sprint.endDate).toLocaleDateString()}`}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-row gap-4">
                                                {sprint.status === 'planning' && (
                                                    <>
                                                        <button className="btn btn-secondary text-xs" onClick={() => handleSprintStatusChange(sprint._id, 'active')}>▶ Start</button>
                                                        <button className="btn btn-secondary text-xs" onClick={() => handleGenerateTasks(sprint._id)} title="Generate dev tasks from features">⚡ Generate Tasks</button>
                                                    </>
                                                )}
                                                {sprint.status === 'active' && (
                                                    <button className="btn btn-secondary text-xs" onClick={() => handleSprintStatusChange(sprint._id, 'completed')}>✅ Complete</button>
                                                )}
                                                <button onClick={() => deleteSprint({ sprintId: sprint._id })} className="icon-btn text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', marginLeft: 'auto' }} title="Delete">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {colSprints.length === 0 && (
                                        <div className="text-sm text-tertiary text-center" style={{ padding: 24, opacity: 0.5 }}>No sprints</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ─── Tab: Board (Dev Tasks Kanban) ────────────────────────────────────

    const renderBoardTab = () => {
        const tasks = (devTasks || []).map(t => ({ ...t, id: t._id }));

        const handleBoardDrop = async (e: React.DragEvent, targetStatus: string) => {
            e.preventDefault();
            setDragOverCol(null);
            if (!draggedId) return;
            const task = tasks.find(t => t.id === draggedId);
            if (!task || task.status === targetStatus) { setDraggedId(null); return; }
            setDraggedId(null);
            await handleTaskStatusChange(draggedId, targetStatus);
        };

        return (
            <div className="gap-16 mt-16" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}>
                {DEV_TASK_COLS.map(col => {
                    const colTasks = tasks.filter(t => t.status === col.key);
                    return (
                        <div
                            key={col.key}
                            className={`task-kanban-column ${dragOverCol === col.key ? 'drag-over' : ''}`}
                            style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, minHeight: 300, border: '1px solid var(--border)' }}
                            onDragOver={(e) => handleColDragOver(e, col.key)}
                            onDragLeave={handleColDragLeave}
                            onDrop={(e) => handleBoardDrop(e, col.key)}
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
                                    <div key={task.id} className="task-kanban-card" draggable onDragStart={(e) => handleDragStart(e, task.id)} onDragEnd={handleDragEnd}>
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
                                                    {task.effort && <span className="text-xs text-tertiary font-mono">{task.effort}</span>}
                                                <span className="text-xs text-tertiary">{task.taskType}</span>
                                            </div>
                                            {/* Lineage Breadcrumbs */}
                                            {(task.sprintId || task.featureId) && (
                                                <div className="flex-row flex-wrap gap-4 mt-4">
                                                    {task.featureId && (
                                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(129,140,248,0.15)', color: '#818cf8', cursor: 'pointer' }} onClick={() => navigate('/roadmap')} title="View Feature">✨ Feature</span>
                                                    )}
                                                    {task.sprintId && (
                                                        <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', cursor: 'pointer' }} onClick={() => navigate('/development')} title="View Sprint">🏃 Sprint</span>
                                                    )}
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {colTasks.length === 0 && (
                                    <div className="text-sm text-tertiary text-center" style={{ padding: 24, opacity: 0.5 }}>No tasks</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ─── Tab: Timeline ───────────────────────────────────────────────────

    const renderTimelineTab = () => {
        const allSprints = sprints || [];
        if (allSprints.length === 0) {
            return <EmptyState icon="📅" message="No sprints to show on the timeline — create a sprint first" />;
        }

        const now = Date.now();
        const minDate = Math.min(...allSprints.map(s => s.startDate || now)) - 7 * 86400000;
        const maxDate = Math.max(...allSprints.map(s => s.endDate || now)) + 7 * 86400000;
        const range = maxDate - minDate || 1;

        const statusColors: Record<string, string> = {
            planning: '#60a5fa',
            active: '#fbbf24',
            completed: '#34d399',
            cancelled: '#6b7280',
        };

        return (
            <div className="mt-16">
                {/* Timeline Header */}
                <div style={{ position: 'relative', height: 30, marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const d = new Date(minDate + range * pct);
                        return (
                            <span key={pct} className="text-xs text-tertiary" style={{ position: 'absolute', left: `${pct * 100}%`, transform: 'translateX(-50%)' }}>
                                {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        );
                    })}
                    {/* Today marker */}
                    <div style={{ position: 'absolute', left: `${((now - minDate) / range) * 100}%`, top: 0, bottom: 0, width: 2, background: '#f87171', opacity: 0.6 }} />
                </div>

                {/* Sprint Bars */}
                {allSprints.map(sprint => {
                    const start = sprint.startDate || now;
                    const end = sprint.endDate || now + 14 * 86400000;
                    const leftPct = ((start - minDate) / range) * 100;
                    const widthPct = ((end - start) / range) * 100;

                    return (
                        <div key={sprint._id} style={{ position: 'relative', height: 48, marginBottom: 4 }}>
                            <div style={{
                                position: 'absolute', left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%`,
                                top: 8, height: 32, borderRadius: 6, overflow: 'hidden',
                                background: (statusColors[sprint.status] || '#818cf8') + '30',
                                border: `1px solid ${statusColors[sprint.status] || '#818cf8'}50`,
                                display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 8,
                            }}>
                                <span className="text-xs font-medium truncate" style={{ color: statusColors[sprint.status] || '#818cf8' }}>
                                    {sprint.name}
                                </span>
                                <span className="text-xs text-tertiary" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                    {sprint.featureIds.length}f
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ─── Tab: Metrics ────────────────────────────────────────────────────

    const renderMetricsTab = () => {
        const tasks = devTasks || [];
        const allSprints = sprints || [];

        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'done').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const completedSprints = allSprints.filter(s => s.status === 'completed').length;
        const activeSprints = allSprints.filter(s => s.status === 'active').length;
        const totalFeatures = features?.length || 0;
        const shippedFeatures = features?.filter(f => f.status === 'shipped').length || 0;

        return (
            <div className="mt-16">
                <div className="grid-4 gap-12 mb-24">
                    <StatCard label="Total Dev Tasks" value={totalTasks} color="#818cf8" />
                    <StatCard label="Completed" value={doneTasks} sub={totalTasks ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%'} color="#34d399" />
                    <StatCard label="In Progress" value={inProgress} color="#fbbf24" />
                    <StatCard label="Active Sprints" value={activeSprints} sub={`${completedSprints} completed`} color="#60a5fa" />
                </div>

                <div className="grid-2 gap-16">
                    {/* Feature Completion */}
                    <div className="section-card">
                        <h3 className="text-lg font-semibold mb-12">Feature Completion</h3>
                        <div className="flex-row gap-8 mb-8">
                            <span className="text-sm text-secondary">{shippedFeatures} / {totalFeatures} features shipped</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: totalFeatures ? `${(shippedFeatures / totalFeatures) * 100}%` : '0%',
                                background: 'linear-gradient(90deg, #34d399, #818cf8)', borderRadius: 4, transition: 'width 0.3s',
                            }} />
                        </div>
                    </div>

                    {/* Task Burndown */}
                    <div className="section-card">
                        <h3 className="text-lg font-semibold mb-12">Task Status Breakdown</h3>
                        {['todo', 'in_progress', 'in_review', 'done'].map(status => {
                            const count = tasks.filter(t => t.status === status).length;
                            const col = DEV_TASK_COLS.find(c => c.key === status);
                            return (
                                <div key={status} className="flex-row gap-8 mb-8" style={{ alignItems: 'center' }}>
                                    <span className="text-sm" style={{ width: 90 }}>{col?.icon} {col?.label}</span>
                                    <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: totalTasks ? `${(count / totalTasks) * 100}%` : '0%',
                                            background: col?.color || '#6b7280', borderRadius: 3, transition: 'width 0.3s',
                                        }} />
                                    </div>
                                    <span className="text-sm font-mono text-tertiary" style={{ width: 30, textAlign: 'right' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────

    const tabs = [
        { key: 'sprints' as const, label: 'Sprints', icon: '🏃' },
        { key: 'board' as const, label: 'Board', icon: '📋' },
        { key: 'timeline' as const, label: 'Timeline', icon: '📅' },
        { key: 'metrics' as const, label: 'Metrics', icon: '📊' },
    ];

    return (
        <div>
            <PageHeader
                title="🏗️ Development"
                description="Sprint management, task tracking & development metrics"
                actions={
                    <div className="flex-row gap-8">
                        <button className="btn btn-secondary" onClick={() => setShowAIChat(!showAIChat)} title="AI Assistant">🤖 AI</button>
                        {activeTab === 'sprints' && (
                            <button className="btn btn-primary flex-shrink-0" onClick={() => setShowCreateSprint(!showCreateSprint)}>
                                + New Sprint
                            </button>
                        )}
                    </div>
                }
            />

            {/* Stats Row */}
            {sprintStats && featureStats && (
                <div className="flex-row flex-wrap gap-12 mb-16">
                    <div className="flex-row gap-6 text-md" style={{ padding: '6px 12px', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <span>🏃</span>
                        <span className="font-semibold">{sprintStats.total}</span>
                        <span className="text-sm text-tertiary">Sprints</span>
                    </div>
                    <div className="flex-row gap-6 text-md" style={{ padding: '6px 12px', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <span>✨</span>
                        <span className="font-semibold">{featureStats.total}</span>
                        <span className="text-sm text-tertiary">Features</span>
                    </div>
                    <div className="flex-row gap-6 text-md" style={{ padding: '6px 12px', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <span>📋</span>
                        <span className="font-semibold">{devTasks?.length || 0}</span>
                        <span className="text-sm text-tertiary">Dev Tasks</span>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex-row" style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content', marginBottom: 16 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={activeTab === tab.key ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ borderRadius: 0, fontSize: 12 }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {sprints === undefined || devTasks === undefined ? (
                <div className="loading"><div className="loading-spinner" /> Loading development data...</div>
            ) : (
                <>
                    {activeTab === 'sprints' && renderSprintsTab()}
                    {activeTab === 'board' && renderBoardTab()}
                    {activeTab === 'timeline' && renderTimelineTab()}
                    {activeTab === 'metrics' && renderMetricsTab()}
                </>
            )}

            <AIChatPanel
                pageContext="Development"
                profiles={DEV_PROFILES}
                isOpen={showAIChat}
                onToggle={() => setShowAIChat(false)}
            />
        </div>
    );
}
