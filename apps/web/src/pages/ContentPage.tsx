import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import AIChatPanel, { CONTENT_PROFILES } from '../components/AIChatPanel';
import { PageHeader, StatCard, EmptyState, FormInput, FormTextarea } from '../components/ui';
import type { Id } from '../lib/types';

// ─── Constants ───────────────────────────────────────────────────────────

const TABS = [
    { id: 'pipeline', label: 'Pipeline', icon: '🔄' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'crossproject', label: 'Cross-Project', icon: '🎯' },
    { id: 'releases', label: 'Release Content', icon: '📢' },
] as const;

type TabId = typeof TABS[number]['id'];

const PIPELINE_STAGES = [
    { key: 'idea', label: 'Idea', icon: '💡', color: '#a78bfa' },
    { key: 'draft', label: 'Draft', icon: '📝', color: '#60a5fa' },
    { key: 'in-review', label: 'In Review', icon: '👀', color: '#fbbf24' },
    { key: 'scheduled', label: 'Scheduled', icon: '📅', color: '#f472b6' },
    { key: 'posted', label: 'Posted', icon: '✅', color: '#34d399' },
    { key: 'archived', label: 'Archived', icon: '📦', color: '#6b7280' },
];

const PLATFORM_META: Record<string, { icon: string; label: string; color: string }> = {
    tiktok: { icon: '🎵', label: 'TikTok', color: '#ff0050' },
    x: { icon: '𝕏', label: 'X / Twitter', color: '#1da1f2' },
    reddit: { icon: '🔴', label: 'Reddit', color: '#ff4500' },
    youtube: { icon: '▶️', label: 'YouTube', color: '#ff0000' },
    blog: { icon: '📝', label: 'Blog', color: '#34d399' },
    medium: { icon: '📰', label: 'Medium', color: '#00ab6c' },
    linkedin: { icon: '💼', label: 'LinkedIn', color: '#0a66c2' },
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
    slideshow: '🖼️', video: '🎬', post: '📮', article: '📄',
    thread: '🧵', vlog: '📹',
};

const TONE_BADGES: Record<string, { label: string; color: string }> = {
    controversy: { label: '🔥 Controversy', color: '#ef4444' },
    motivational: { label: '💪 Motivational', color: '#f59e0b' },
    educational: { label: '📚 Educational', color: '#3b82f6' },
    storytelling: { label: '📖 Storytelling', color: '#8b5cf6' },
    'how-to': { label: '🔧 How-To', color: '#10b981' },
};

const CATEGORY_LABELS: Record<string, string> = {
    'webapp': '🌐 Web App', 'fullstack-app': '🏗️ Full-Stack', 'monorepo-app': '📦 Monorepo',
    'oss-tool': '🔓 OSS Tool', 'ui-package': '🎨 UI Package', 'library': '📚 Library',
    'boilerplate': '🧩 Boilerplate', 'minion-toolbox': '🤖 Toolbox',
    'backend-service': '⚙️ Backend', 'client-project': '💼 Client',
};

const RELEASE_STATUS = [
    { key: 'draft', label: 'Draft', icon: '📝', color: '#a78bfa' },
    { key: 'planned', label: 'Planned', icon: '📅', color: '#60a5fa' },
    { key: 'in_progress', label: 'In Progress', icon: '⚡', color: '#fbbf24' },
    { key: 'published', label: 'Published', icon: '✅', color: '#34d399' },
    { key: 'skipped', label: 'Skipped', icon: '⏭️', color: '#6b7280' },
];

const PLATFORMS = ['twitter', 'reddit', 'youtube', 'linkedin', 'devto', 'github'];

// ─── Main Component ──────────────────────────────────────────────────────

export default function ContentPage() {
    const { orgId } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('pipeline');
    const [showAIChat, setShowAIChat] = useState(false);

    return (
        <div>
            <PageHeader
                title="📢 Content Hub"
                description="Content pipeline · Calendar · Cross-project analytics · Release announcements"
                actions={
                    <button className="btn btn-secondary" onClick={() => setShowAIChat(!showAIChat)} title="AI Assistant">🤖 AI</button>
                }
            />

            {/* Tab Navigation */}
            <div className="flex-row gap-4 mb-16" style={{
                borderBottom: '1px solid var(--border)', paddingBottom: 0,
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="text-md font-medium"
                        style={{
                            padding: '10px 16px', border: 'none', cursor: 'pointer',
                            background: 'none',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'pipeline' && <PipelineTab orgId={orgId} />}
            {activeTab === 'calendar' && <CalendarTab orgId={orgId} />}
            {activeTab === 'crossproject' && <CrossProjectTab orgId={orgId} />}
            {activeTab === 'releases' && <ReleaseContentTab orgId={orgId} />}

            <AIChatPanel
                pageContext="Content"
                profiles={CONTENT_PROFILES}
                isOpen={showAIChat}
                onToggle={() => setShowAIChat(false)}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── PIPELINE TAB (Kanban) ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function PipelineTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const rawTasks = useQuery(api.marketingTasks.list, orgId ? { orgId } : "skip");
    const stats = useQuery(api.marketingTasks.getStats, orgId ? { orgId } : "skip");
    const updateTask = useMutation(api.marketingTasks.update);
    const removeTask = useMutation(api.marketingTasks.remove);
    const createTask = useMutation(api.marketingTasks.create);
    const { data: projectData } = useProjects();

    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPlatform, setNewPlatform] = useState('tiktok');
    const [newContentType, setNewContentType] = useState('video');
    const [newTone, setNewTone] = useState('educational');
    const [newProject, setNewProject] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [editingTask, setEditingTask] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');

    const tasks = rawTasks || [];

    const projectOptions: SelectOption[] = useMemo(() =>
        (projectData?.projects || []).filter(p => p.name).map(p => ({
            value: p.id as string,
            label: p.name,
            sublabel: p.tier,
            icon: '📁',
        })), [projectData]);

    const activeStages = PIPELINE_STAGES.filter(s => s.key !== 'archived');

    const handleCreate = async () => {
        if (!newTitle.trim() || !orgId || !newProject) return;
        const project = (projectData?.projects || []).find(p => (p.id as string) === newProject);
        await createTask({
            orgId,
            projectPath: project?.name || newProject,
            projectId: project?.id,
            title: newTitle.trim(),
            platform: newPlatform,
            contentType: newContentType,
            tone: newTone,
            priority: newPriority,
        });
        setNewTitle('');
        setShowCreate(false);
    };

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        await updateTask({ taskId: taskId as Id<"marketingTasks">, status: newStatus });
    };

    const handleDelete = async (taskId: string) => {
        await removeTask({ taskId: taskId as Id<"marketingTasks"> });
    };

    const handleSaveDraft = async (taskId: string) => {
        await updateTask({ taskId: taskId as Id<"marketingTasks">, contentDraft: editDraft });
        setEditingTask(null);
        setEditDraft('');
    };

    return (
        <div>
            {/* Stats Banner */}
            {stats && (
                <div className="flex-row flex-wrap gap-12 mb-16">
                    <StatCard label="Total Tasks" value={stats.total} />
                    <StatCard label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? '#ef4444' : undefined} />
                    <StatCard label="Due This Week" value={stats.upcoming} color={stats.upcoming > 0 ? '#f59e0b' : undefined} />
                    {Object.entries(stats.byPlatform).map(([platform, count]) => (
                        <StatCard key={platform} label={PLATFORM_META[platform]?.label || platform} value={count as number} sub={PLATFORM_META[platform]?.icon} />
                    ))}
                </div>
            )}

            {/* Create Task Button */}
            <div className="flex-row gap-8 mb-16">
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
                    + New Task
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <FormInput
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Task title — e.g. 'TikTok slideshow for ChatIQ launch' *"
                        className="mb-12"
                    />
                    <div className="grid-2 gap-12 mb-12">
                        <SearchableSelect
                            options={projectOptions}
                            value={newProject}
                            onChange={setNewProject}
                            placeholder="Project *"
                            grouped
                        />
                        <SearchableSelect
                            options={Object.entries(PLATFORM_META).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))}
                            value={newPlatform}
                            onChange={setNewPlatform}
                            placeholder="Platform"
                            clearable={false}
                        />
                    </div>
                    <div className="flex-row flex-wrap gap-12 mb-12">
                        <SearchableSelect
                            options={Object.entries(CONTENT_TYPE_ICONS).map(([k, icon]) => ({ value: k, label: `${icon} ${k}` }))}
                            value={newContentType}
                            onChange={setNewContentType}
                            placeholder="Content Type"
                            clearable={false}
                            width="160px"
                        />
                        <SearchableSelect
                            options={Object.entries(TONE_BADGES).map(([k, v]) => ({ value: k, label: v.label }))}
                            value={newTone}
                            onChange={setNewTone}
                            placeholder="Tone"
                            clearable={false}
                            width="180px"
                        />
                        <SearchableSelect
                            options={[
                                { value: 'high', label: '🔴 High' },
                                { value: 'medium', label: '🟡 Medium' },
                                { value: 'low', label: '🟢 Low' },
                            ]}
                            value={newPriority}
                            onChange={setNewPriority}
                            placeholder="Priority"
                            clearable={false}
                            width="140px"
                        />
                        <div className="flex-1" />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newTitle.trim() || !newProject}>Create</button>
                    </div>
                </div>
            )}

            {/* Kanban Columns */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${activeStages.length}, 1fr)`,
                gap: 12,
                minHeight: 400,
            }}>
                {activeStages.map(stage => {
                    const stageTasks = tasks.filter(t => t.status === stage.key);
                    return (
                        <div key={stage.key} style={{
                            background: `${stage.color}08`,
                            borderRadius: 12, padding: 12,
                            border: `1px solid ${stage.color}20`,
                            minWidth: 0,
                        }}>
                            <div className="flex-row gap-6 mb-12" style={{ alignItems: 'center' }}>
                                <span>{stage.icon}</span>
                                <span className="text-sm font-semibold">{stage.label}</span>
                                <span className="text-xs" style={{
                                    padding: '1px 6px', borderRadius: 10,
                                    background: `${stage.color}20`, color: stage.color,
                                    fontWeight: 600,
                                }}>{stageTasks.length}</span>
                            </div>

                            <div className="flex-col gap-6">
                                {stageTasks.map(task => (
                                    <TaskCard
                                        key={task._id}
                                        task={task}
                                        stages={activeStages}
                                        onStatusChange={handleStatusChange}
                                        onDelete={handleDelete}
                                        editingTask={editingTask}
                                        editDraft={editDraft}
                                        setEditingTask={setEditingTask}
                                        setEditDraft={setEditDraft}
                                        onSaveDraft={handleSaveDraft}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Task Card ───────────────────────────────────────────────────────────

interface TaskCardProps {
    task: {
        _id: string;
        title: string;
        description?: string;
        platform: string;
        contentType: string;
        tone?: string;
        priority: string;
        projectPath: string;
        status: string;
        dueDate?: number;
        contentDraft?: string;
        aiGenerated?: boolean;
    };
    stages: typeof PIPELINE_STAGES;
    onStatusChange: (id: string, status: string) => void;
    onDelete: (id: string) => void;
    editingTask: string | null;
    editDraft: string;
    setEditingTask: (id: string | null) => void;
    setEditDraft: (draft: string) => void;
    onSaveDraft: (id: string) => void;
}

function TaskCard({ task, stages, onStatusChange, onDelete, editingTask, editDraft, setEditingTask, setEditDraft, onSaveDraft }: TaskCardProps) {
    const projectName = task.projectPath.split('/').pop() || task.projectPath;
    const priorityColors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const isEditing = editingTask === task._id;

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 8,
            border: '1px solid var(--border)', padding: '10px 12px',
            borderLeft: `3px solid ${priorityColors[task.priority] || '#6b7280'}`,
        }}>
            <div className="flex-row gap-6 mb-6" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-lg">{PLATFORM_META[task.platform]?.icon || '📢'}</span>
                <span className="text-xs" style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                    {CONTENT_TYPE_ICONS[task.contentType] || '📄'} {task.contentType}
                </span>
                {task.tone && (
                    <span className="text-xs" style={{
                        padding: '1px 5px', borderRadius: 3,
                        background: `${TONE_BADGES[task.tone]?.color || '#6b7280'}15`,
                        color: TONE_BADGES[task.tone]?.color || '#6b7280',
                    }}>{TONE_BADGES[task.tone]?.label || task.tone}</span>
                )}
                {task.aiGenerated && <span className="text-xs" title="AI Generated">🤖</span>}
                <div className="flex-1" />
                <button onClick={() => onDelete(task._id)} className="text-xs" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px' }}>✕</button>
            </div>
            <div className="text-sm font-medium mb-4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.title}</div>
            <div className="text-xs text-tertiary mb-6">📁 {projectName}</div>
            {task.dueDate && (
                <div className="text-xs mb-6" style={{ color: task.dueDate < Date.now() ? '#ef4444' : 'var(--text-tertiary)' }}>
                    📅 {new Date(task.dueDate).toLocaleDateString()}
                    {task.dueDate < Date.now() && ' ⚠️ overdue'}
                </div>
            )}
            {isEditing ? (
                <div className="mb-6">
                    <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} className="form-textarea text-xs" style={{ minHeight: 60, padding: 8 }} placeholder="Write your content draft..." />
                    <div className="flex-row gap-4 mt-4">
                        <button className="btn btn-primary text-xs" style={{ padding: '3px 8px' }} onClick={() => onSaveDraft(task._id)}>Save</button>
                        <button className="btn btn-secondary text-xs" style={{ padding: '3px 8px' }} onClick={() => setEditingTask(null)}>Cancel</button>
                    </div>
                </div>
            ) : task.contentDraft ? (
                <div className="text-xs text-muted mb-6" style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                    onClick={() => { setEditingTask(task._id); setEditDraft(task.contentDraft || ''); }} title="Click to edit"
                >{task.contentDraft}</div>
            ) : (
                <button className="text-xs text-tertiary mb-6" style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    onClick={() => { setEditingTask(task._id); setEditDraft(''); }}
                >✏️ Write draft...</button>
            )}
            <div className="flex-row gap-4 flex-wrap">
                {stages.map(s => (
                    s.key !== task.status && s.key !== 'archived' ? (
                        <button key={s.key} onClick={() => onStatusChange(task._id, s.key)} className="text-xs"
                            style={{ padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                            title={`Move to ${s.label}`}
                        >{s.icon}</button>
                    ) : null
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CALENDAR TAB ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function CalendarTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const rawTasks = useQuery(api.marketingTasks.list, orgId ? { orgId } : "skip");
    const tasks = rawTasks || [];
    const updateTask = useMutation(api.marketingTasks.update);

    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const dayKey = (d: Date) => d.toISOString().split('T')[0];
    const isToday = (d: Date) => dayKey(d) === dayKey(today);

    const tasksByDay = useMemo(() => {
        const map: Record<string, typeof tasks> = {};
        for (const task of tasks) {
            const date = task.scheduledDate || task.dueDate;
            if (!date) continue;
            const key = dayKey(new Date(date));
            if (!map[key]) map[key] = [];
            map[key].push(task);
        }
        return map;
    }, [tasks]);

    const unscheduled = tasks.filter(t =>
        !t.scheduledDate && !t.dueDate && t.status !== 'posted' && t.status !== 'archived'
    );

    const handleSchedule = async (taskId: string, date: Date) => {
        await updateTask({ taskId: taskId as Id<"marketingTasks">, scheduledDate: date.getTime() });
    };

    const [dragTask, setDragTask] = useState<string | null>(null);

    return (
        <div>
            <div className="flex-row gap-12 mb-16" style={{ alignItems: 'center' }}>
                <button className="btn btn-secondary text-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
                <button className="btn btn-secondary text-sm" onClick={() => setWeekOffset(0)}>Today</button>
                <button className="btn btn-secondary text-sm" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
                <span className="text-md font-medium">
                    {startOfWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, minHeight: 300 }}>
                {days.map(day => {
                    const key = dayKey(day);
                    const dayTasks = tasksByDay[key] || [];
                    return (
                        <div key={key} style={{
                            background: isToday(day) ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                            borderRadius: 10, padding: 10,
                            border: isToday(day) ? '1px solid var(--accent)' : '1px solid var(--border)',
                            minHeight: 120,
                        }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => { if (dragTask) { handleSchedule(dragTask, day); setDragTask(null); } }}
                        >
                            <div className="text-xs font-semibold mb-6" style={{ color: isToday(day) ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                                {day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                            </div>
                            <div className="flex-col gap-4">
                                {dayTasks.map(task => (
                                    <div key={task._id} style={{
                                        padding: '4px 6px', borderRadius: 4,
                                        background: `${PLATFORM_META[task.platform]?.color || '#6b7280'}18`,
                                        borderLeft: `2px solid ${PLATFORM_META[task.platform]?.color || '#6b7280'}`,
                                        fontSize: 11, cursor: 'default',
                                    }}>
                                        <span>{PLATFORM_META[task.platform]?.icon || '📢'} </span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {task.title.length > 30 ? task.title.slice(0, 30) + '…' : task.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {unscheduled.length > 0 && (
                <div className="mt-16">
                    <div className="section-label mb-8">📌 Unscheduled ({unscheduled.length})</div>
                    <div className="flex-row flex-wrap gap-6">
                        {unscheduled.slice(0, 20).map(task => (
                            <div key={task._id} draggable onDragStart={() => setDragTask(task._id)} onDragEnd={() => setDragTask(null)}
                                style={{
                                    padding: '6px 10px', borderRadius: 6,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    cursor: 'grab', fontSize: 12,
                                    borderLeft: `3px solid ${PLATFORM_META[task.platform]?.color || '#6b7280'}`,
                                }}
                            >
                                {PLATFORM_META[task.platform]?.icon || '📢'} {task.title.length > 40 ? task.title.slice(0, 40) + '…' : task.title}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CROSS-PROJECT TAB ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function CrossProjectTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const rawTasks = useQuery(api.marketingTasks.list, orgId ? { orgId } : "skip");
    const { data: projectData } = useProjects();
    const updateTask = useMutation(api.marketingTasks.update);
    const removeTask = useMutation(api.marketingTasks.remove);

    const tasks = rawTasks || [];

    const [filterPlatform, setFilterPlatform] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [groupBy, setGroupBy] = useState<'project' | 'platform' | 'status'>('project');

    const projectCategoryMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of (projectData?.projects || [])) {
            const cat = p.projectCategory as string | undefined;
            if (cat) map[p.path] = cat;
        }
        return map;
    }, [projectData]);

    const projectOptions: SelectOption[] = useMemo(() => {
        const paths = [...new Set(tasks.map(t => t.projectPath))];
        return paths.map(p => {
            const segs = p.split('/');
            return { value: p, label: segs[segs.length - 1] || p };
        });
    }, [tasks]);

    const filtered = tasks.filter(t => {
        if (filterPlatform && t.platform !== filterPlatform) return false;
        if (filterStatus && t.status !== filterStatus) return false;
        if (filterProject && t.projectPath !== filterProject) return false;
        return true;
    }).filter(t => t.status !== 'archived');

    const grouped = useMemo(() => {
        const map: Record<string, typeof filtered> = {};
        for (const t of filtered) {
            let key = '';
            if (groupBy === 'project') {
                const segs = t.projectPath.split('/');
                key = segs[segs.length - 1] || t.projectPath;
            } else if (groupBy === 'platform') {
                key = PLATFORM_META[t.platform]?.label || t.platform;
            } else {
                key = PIPELINE_STAGES.find(s => s.key === t.status)?.label || t.status;
            }
            if (!map[key]) map[key] = [];
            map[key].push(t);
        }
        return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    }, [filtered, groupBy]);

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        await updateTask({ taskId: taskId as Id<"marketingTasks">, status: newStatus });
    };

    const handleDelete = async (taskId: string) => {
        await removeTask({ taskId: taskId as Id<"marketingTasks"> });
    };

    return (
        <div>
            <div className="flex-row flex-wrap gap-8 mb-16" style={{ alignItems: 'center' }}>
                <SearchableSelect
                    options={Object.entries(PLATFORM_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
                    value={filterPlatform} onChange={setFilterPlatform} placeholder="All Platforms" width="170px"
                />
                <SearchableSelect
                    options={PIPELINE_STAGES.map(s => ({ value: s.key, label: `${s.icon} ${s.label}` }))}
                    value={filterStatus} onChange={setFilterStatus} placeholder="All Statuses" width="160px"
                />
                <SearchableSelect
                    options={projectOptions}
                    value={filterProject} onChange={setFilterProject} placeholder="All Projects" width="180px"
                />
                <div className="flex-1" />
                <div className="flex-row gap-4">
                    <span className="text-xs text-tertiary">Group:</span>
                    {(['project', 'platform', 'status'] as const).map(g => (
                        <button key={g} className={`text-xs ${groupBy === g ? 'font-semibold' : ''}`}
                            style={{
                                padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                                border: groupBy === g ? '1px solid var(--accent)' : '1px solid var(--border)',
                                background: groupBy === g ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                                color: groupBy === g ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                            onClick={() => setGroupBy(g)}
                        >{g === 'project' ? '📁' : g === 'platform' ? '📡' : '🔄'} {g}</button>
                    ))}
                </div>
            </div>

            <div className="text-sm text-tertiary mb-12">
                {filtered.length} tasks {filterPlatform || filterStatus || filterProject ? '(filtered)' : ''}
            </div>

            {filtered.length === 0 ? (
                <EmptyState icon="🎯" message="No tasks match your filters" />
            ) : (
                <div className="flex-col gap-16">
                    {grouped.map(([group, groupTasks]) => (
                        <div key={group}>
                            <div className="flex-row gap-8 mb-8" style={{ alignItems: 'center' }}>
                                <span className="font-semibold text-md">{group}</span>
                                <span className="text-xs text-tertiary">({groupTasks.length})</span>
                            </div>
                            <div className="flex-col gap-4">
                                {groupTasks.map(task => {
                                    const projectName = task.projectPath.split('/').pop() || task.projectPath;
                                    const stageInfo = PIPELINE_STAGES.find(s => s.key === task.status);
                                    const category = projectCategoryMap[task.projectPath];
                                    return (
                                        <div key={task._id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 14px', borderRadius: 8,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        }}>
                                            <div onClick={() => {
                                                const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === task.status);
                                                const nextIdx = Math.min(currentIdx + 1, PIPELINE_STAGES.length - 2);
                                                handleStatusChange(task._id, PIPELINE_STAGES[nextIdx].key);
                                            }}
                                                className="flex-center flex-shrink-0"
                                                style={{
                                                    width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                                                    border: `2px solid ${stageInfo?.color || '#6b7280'}`,
                                                    background: task.status === 'posted' ? '#34d399' : 'transparent',
                                                    color: '#fff', fontSize: 12,
                                                }}
                                            >{task.status === 'posted' && '✓'}</div>
                                            <span className="text-lg flex-shrink-0">{PLATFORM_META[task.platform]?.icon || '📢'}</span>
                                            <span className="text-xs flex-shrink-0" style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>{CONTENT_TYPE_ICONS[task.contentType] || '📄'}</span>
                                            <div className="flex-1" style={{ minWidth: 0 }}>
                                                <div className="text-sm" style={{
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    textDecoration: task.status === 'posted' ? 'line-through' : 'none',
                                                    opacity: task.status === 'posted' ? 0.5 : 1,
                                                }}>{task.title}</div>
                                            </div>
                                            {category && groupBy !== 'project' && (
                                                <span className="text-xs flex-shrink-0" style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>{CATEGORY_LABELS[category] || category}</span>
                                            )}
                                            {groupBy !== 'project' && (
                                                <span className="text-xs text-tertiary flex-shrink-0">📁 {projectName}</span>
                                            )}
                                            <span className="text-xs flex-shrink-0" style={{
                                                padding: '2px 8px', borderRadius: 4,
                                                background: `${stageInfo?.color || '#6b7280'}15`,
                                                color: stageInfo?.color || '#6b7280', fontWeight: 600,
                                            }}>{stageInfo?.icon} {stageInfo?.label || task.status}</span>
                                            <select value={task.status} onChange={e => handleStatusChange(task._id, e.target.value)} className="text-xs"
                                                style={{ padding: '3px 6px', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', width: 100 }}
                                            >
                                                {PIPELINE_STAGES.map(s => (
                                                    <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => handleDelete(task._id)} className="text-xs"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px' }}
                                            >✕</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── RELEASE CONTENT TAB ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function ReleaseContentTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const { data: projectData } = useProjects();

    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
    const [newItemContent, setNewItemContent] = useState('');
    const [newItemPlatform, setNewItemPlatform] = useState('twitter');
    const [newProject, setNewProject] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const rawPlans = useQuery(api.content.listPlans, orgId ? {} : "skip");
    const stats = useQuery(api.content.getContentStats, orgId ? {} : "skip");
    const createPlan = useMutation(api.content.createPlan);
    const updatePlan = useMutation(api.content.updatePlan);
    const deletePlan = useMutation(api.content.deletePlan);
    const addItem = useMutation(api.content.addItem);
    const updateItem = useMutation(api.content.updateItem);

    const plans = rawPlans ? rawPlans.map(p => ({ ...p, id: p._id })) : null;
    const rawExpandedDetail = useQuery(api.content.getPlan, expandedPlan ? { id: expandedPlan as Id<"contentPlans"> } : "skip");
    const expandedDetail = rawExpandedDetail ? { ...rawExpandedDetail, id: rawExpandedDetail._id } : null;

    const allPlans = plans || [];
    const filtered = allPlans.filter((p: typeof allPlans[0]) => {
        if (filter !== 'all' && p.status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!p.releaseTag.toLowerCase().includes(q) && !p.projectPath.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const projectOptions: SelectOption[] = useMemo(() => {
        const allPaths = new Set<string>();
        for (const p of (projectData?.projects || [])) allPaths.add(p.path);
        for (const p of allPlans) allPaths.add(p.projectPath);
        return [...allPaths].sort().map(path => {
            const segments = path.split('/');
            return { value: path, label: segments[segments.length - 1] || path, sublabel: segments.slice(0, -1).join('/'), group: segments[0], icon: '📁' };
        });
    }, [projectData, allPlans]);

    const platformIcons: Record<string, string> = {
        twitter: '🐦', reddit: '🔴', youtube: '▶️', linkedin: '💼', devto: '📰', github: '🐙'
    };

    const platformOptions: SelectOption[] = PLATFORMS.map(p => ({ value: p, label: p, icon: platformIcons[p] || '📄' }));

    const handleCreate = async () => {
        if (!newProject.trim() || !newTag.trim() || !orgId) return;
        const planId = await createPlan({
            orgId, projectPath: newProject.trim(), releaseTag: newTag.trim(),
            releaseTitle: newTitle.trim() || undefined, releaseNotes: newNotes.trim() || undefined,
        });
        setShowCreate(false); setNewProject(''); setNewTag(''); setNewTitle(''); setNewNotes('');
        setExpandedPlan(planId as string);
    };

    const handleUpdatePlan = async (id: string, updates: Record<string, unknown>) => {
        await updatePlan({ id: id as Id<"contentPlans">, ...updates });
    };

    const handleDeletePlan = async (id: string) => {
        if (confirm("Delete this content plan?")) {
            await deletePlan({ id: id as Id<"contentPlans"> });
            if (expandedPlan === id) setExpandedPlan(null);
        }
    };

    const handleAddItem = async () => {
        if (!expandedPlan || !newItemContent.trim()) return;
        await addItem({ planId: expandedPlan as Id<"contentPlans">, platform: newItemPlatform, content: newItemContent.trim() });
        setNewItemContent('');
    };

    const handleUpdateItem = async (itemId: string, updates: Record<string, unknown>) => {
        await updateItem({ id: itemId as Id<"contentItems">, ...updates });
    };

    return (
        <div>
            {/* Stats */}
            {stats && (
                <div className="flex-row flex-wrap gap-12 mb-16">
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span className="font-semibold">{stats.totalPlans}</span>
                        <span className="text-sm text-tertiary" style={{ marginLeft: 6 }}>Plans</span>
                    </div>
                    <div className="stat-card" style={{ padding: '8px 16px' }}>
                        <span className="font-semibold">{stats.totalItems}</span>
                        <span className="text-sm text-tertiary" style={{ marginLeft: 6 }}>Content Items</span>
                    </div>
                    {Object.entries(stats.byPlatform).map(([platform, count]) => (
                        <div key={platform} className="stat-card" style={{ padding: '8px 16px' }}>
                            <span>{platformIcons[platform] || '📄'}</span>
                            <span className="font-semibold" style={{ marginLeft: 4 }}>{count as number}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="flex-row gap-8 mb-16">
                <button className="btn btn-primary text-base" onClick={() => setShowCreate(!showCreate)}>+ New Plan</button>
                <FormInput value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search plans..."
                    inputSize="sm" style={{ width: 220, background: 'var(--bg-secondary)' }} />
                <span className="text-sm text-tertiary" style={{ lineHeight: '32px' }}>{filtered.length} plans</span>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <div className="grid-2 gap-12 mb-12">
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="Select project *" grouped allowCreate onCreateNew={(v) => setNewProject(v)} />
                        <FormInput placeholder="Release tag * (e.g. v1.0.0)" value={newTag} onChange={e => setNewTag(e.target.value)} />
                    </div>
                    <FormInput placeholder="Release title (optional)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="mb-12" />
                    <FormTextarea placeholder="Release notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="mb-12" />
                    <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newProject.trim() || !newTag.trim()}>Create Plan</button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="filter-bar flex-row flex-wrap gap-8 mb-16">
                {[{ key: 'all', label: `All (${allPlans.length})` }, ...RELEASE_STATUS].map(f => (
                    <button key={f.key} className={`btn text-base ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f.key)}
                    >{'icon' in f ? `${f.icon} ` : ''}{f.label}</button>
                ))}
            </div>

            {/* Plans List */}
            <div className="mt-16">
                {plans === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading plans...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon="📢" message="No content plans yet" />
                ) : (
                    filtered.map((plan: typeof allPlans[0]) => (
                        <div key={plan.id} className="section-card-sm mb-8" style={{ borderColor: expandedPlan === plan.id ? 'var(--accent)' : undefined }}>
                            <div className="flex-row gap-12" style={{ cursor: 'pointer' }} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                                <span className="text-2xl">{RELEASE_STATUS.find(s => s.key === plan.status)?.icon || '📝'}</span>
                                <div className="flex-1">
                                    <div className="font-semibold text-lg">{plan.releaseTitle || `${plan.projectPath} ${plan.releaseTag}`}</div>
                                    <div className="text-sm text-tertiary mt-4">
                                        {plan.projectPath} · {plan.releaseTag} · {new Date(plan.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div onClick={e => e.stopPropagation()} style={{ width: 140 }}>
                                    <SearchableSelect
                                        options={RELEASE_STATUS.map(s => ({ value: s.key, label: `${s.icon} ${s.label}` }))}
                                        value={plan.status}
                                        onChange={v => handleUpdatePlan(plan.id, { status: v })}
                                        placeholder="Status" clearable={false} width="140px" />
                                </div>
                                <button onClick={e => { e.stopPropagation(); handleDeletePlan(plan.id); }} className="icon-btn">✕</button>
                            </div>

                            {expandedPlan === plan.id && expandedDetail && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                                    {expandedDetail.releaseNotes && (
                                        <div className="text-md text-muted whitespace-pre" style={{ padding: '12px 0' }}>
                                            {expandedDetail.releaseNotes}
                                        </div>
                                    )}
                                    <div className="mt-12">
                                        <div className="section-label mb-8">Content Items ({expandedDetail.items?.length || 0})</div>
                                        {(expandedDetail.items || []).map(item => (
                                            <div key={item._id} className="flex-row gap-8 mb-6" style={{
                                                alignItems: 'flex-start', padding: '8px 12px',
                                                background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)',
                                            }}>
                                                <span className="text-xl">{platformIcons[item.platform] || '📄'}</span>
                                                <div className="flex-1">
                                                    <div className="text-base whitespace-pre">{item.content}</div>
                                                    <div className="text-xs text-tertiary mt-4">{item.platform} · {item.status}</div>
                                                </div>
                                                <div style={{ width: 120 }}>
                                                    <SearchableSelect
                                                        options={[{ value: 'draft', label: 'Draft' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'posted', label: 'Posted' }]}
                                                        value={item.status}
                                                        onChange={v => handleUpdateItem(item._id, { status: v })}
                                                        placeholder="Status" clearable={false} width="120px" />
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex-row gap-8 mt-8">
                                            <div style={{ width: 140 }}>
                                                <SearchableSelect options={platformOptions} value={newItemPlatform} onChange={setNewItemPlatform} placeholder="Platform" clearable={false} />
                                            </div>
                                            <FormInput placeholder="Content draft..." value={newItemContent} onChange={e => setNewItemContent(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddItem()} inputSize="sm" className="flex-1" />
                                            <button className="btn btn-primary text-base" onClick={handleAddItem} disabled={!newItemContent.trim()} style={{ padding: '6px 12px' }}>Add</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
