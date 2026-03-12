import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project } from '../lib/types';
import { LANE_COLORS } from '../lib/types';
import { groupByDimension } from '../lib/dimensions';
import { useDimensions } from '../hooks/useDimensions';
import { useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { PageHeader, Badge, GripIcon, DimensionPicker, FilterBar } from '../components/ui';
import { useUrlFilters } from '../hooks/useUrlFilters';

/** Pending change queued for batch save */
interface PendingChange {
    projectPath: string;
    field: string;
    newValue: string;
}

const SAVE_DEBOUNCE_MS = 1500;

export default function KanbanPage({ data, onRefresh }: { data: StatusData; onRefresh: () => void | Promise<void> }) {
    const navigate = useNavigate();
    const { dimensions } = useDimensions(data.projects);
    const [urlFilters, setUrlFilter] = useUrlFilters({ columns: localStorage.getItem('mc-kanban-dim') || 'tier' });
    const columnDimension = urlFilters.columns || 'tier';
    const setColumnDimension = (v: string) => { setUrlFilter('columns', v); localStorage.setItem('mc-kanban-dim', v); };
    const [search, setSearch] = useState('');
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    // ── Optimistic state: local overrides for project fields ─────────────
    const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const pendingRef = useRef<PendingChange[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ghostRef = useRef<HTMLDivElement | null>(null);

    // Apply overrides to project data for rendering
    const projects = useMemo(() => {
        return data.projects.map(p => {
            const o = overrides[p.path];
            if (!o) return p;
            return { ...p, ...o } as Project;
        });
    }, [data.projects, overrides]);

    // Filter by search
    const filteredProjects = useMemo(() => {
        if (!search) return projects;
        const q = search.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }, [projects, search]);

    const activeDimension = dimensions.find(d => d.id === columnDimension);

    const columns = useMemo(() => {
        if (!activeDimension) return [];
        return groupByDimension(filteredProjects, activeDimension);
    }, [filteredProjects, activeDimension]);

    const updateProject = useMutation(api.projects.updateByPath);

    // ── Debounced batch save ─────────────────────────────────────────────
    const flushSaves = useCallback(async () => {
        const changes = [...pendingRef.current];
        pendingRef.current = [];
        if (changes.length === 0) return;

        setSaving(true);
        setSaveError(null);
        try {
            // Deduplicate: keep last change per project
            const byProject = new Map<string, PendingChange>();
            for (const c of changes) byProject.set(c.projectPath, c);

            // Save each project
            for (const [, change] of byProject) {
                await updateProject({
                    path: change.projectPath,
                    [change.field]: change.newValue,
                });
            }

            // Refresh data from server (background, non-blocking)
            await onRefresh();
            // Clear overrides since server data is now fresh
            setOverrides({});
        } catch (err) {
            console.error('Failed to save changes:', err);
            setSaveError('Some changes failed to save');
        } finally {
            setSaving(false);
        }
    }, [onRefresh, updateProject]);

    const queueSave = useCallback((change: PendingChange) => {
        pendingRef.current.push(change);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushSaves, SAVE_DEBOUNCE_MS);
    }, [flushSaves]);

    // Flush on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (pendingRef.current.length > 0) flushSaves();
        };
    }, [flushSaves]);

    // ── Drag handlers ───────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, projectPath: string, projectName: string) => {
        e.dataTransfer.effectAllowed = 'move';
        // Use name::path composite for unique identification
        e.dataTransfer.setData('text/plain', `${projectName}::${projectPath}`);

        // Create rotated ghost
        const cardEl = e.currentTarget as HTMLElement;
        const ghost = cardEl.cloneNode(true) as HTMLDivElement;
        ghost.className = 'kanban-card kanban-drag-ghost';
        ghost.style.width = cardEl.offsetWidth + 'px';
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        e.dataTransfer.setDragImage(ghost, cardEl.offsetWidth / 2, 20);

        // Mark source as dragging
        requestAnimationFrame(() => {
            cardEl.classList.add('dragging');
        });
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        // Remove dragging class from source
        (e.currentTarget as HTMLElement).classList.remove('dragging');
        document.querySelectorAll('.kanban-card.dragging').forEach(el => el.classList.remove('dragging'));
        setDragOverCol(null);

        // Clean up ghost
        if (ghostRef.current) {
            ghostRef.current.remove();
            ghostRef.current = null;
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, col: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCol(col);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverCol(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetValue: string) => {
        e.preventDefault();
        setDragOverCol(null);

        if (!activeDimension || activeDimension.field === 'computed') return;

        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;

        // Parse composite identifier
        const sepIdx = dragData.indexOf('::');
        const projectName = sepIdx >= 0 ? dragData.substring(0, sepIdx) : '';
        const projectPath = sepIdx >= 0 ? dragData.substring(sepIdx + 2) : dragData;

        // Check if same column
        const project = projects.find(p => {
            if (projectPath) return p.path === projectPath;
            return p.name === projectName;
        });
        if (!project) return;
        const currentValue = (project[activeDimension.field]);
        if (currentValue === targetValue) return;

        // Optimistic update: apply override immediately
        setOverrides(prev => ({
            ...prev,
            [projectPath]: { ...prev[projectPath], [activeDimension.field]: targetValue },
        }));

        // Queue save
        queueSave({
            projectPath: project.path || project.name,
            field: activeDimension.field,
            newValue: targetValue,
        });
    }, [activeDimension, projects, queueSave]);

    const canDrag = activeDimension && activeDimension.field !== 'computed';
    const hasPending = pendingRef.current.length > 0;

    return (
        <div>
            <PageHeader
                title="Kanban Board"
                description={`Projects by ${activeDimension?.label || 'dimension'} · ${canDrag ? 'Drag to change' : 'Read only'}`}
            />
            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: 'Search projects...' }}
                resultCount={filteredProjects.length}
                filters={
                    <DimensionPicker dimensions={dimensions} selected={columnDimension} onChange={setColumnDimension} label="Columns" allowNone={false} />
                }
            />
            {(saving || saveError) && (
                <div className="kanban-saving-bar" style={saveError ? { color: 'var(--error)', borderColor: 'var(--error)' } : undefined}>
                    {saving ? '⏳ Saving changes...' : saveError ? `⚠️ ${saveError}` : ''}
                </div>
            )}
            <div className="kanban-board">
                {columns.map(col => (
                    <div
                        className={`kanban-column ${dragOverCol === col.key ? 'drag-over' : ''}`}
                        key={col.key}
                        onDragOver={(e) => handleDragOver(e, col.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.key)}
                    >
                        <div className="kanban-column-header">
                            <div className="kanban-column-title" style={{ color: col.sub.color || 'var(--text-primary)' }}>
                                {col.sub.icon && <span>{col.sub.icon}</span>} {col.sub.label}
                            </div>
                            <span className="kanban-count">{col.projects.length}</span>
                        </div>
                        <div className="kanban-cards">
                            {col.projects.map(p => (
                                <div
                                    key={p.id || p.path || p.name}
                                    className="kanban-card"
                                    data-project-path={p.path}
                                    draggable={!!canDrag}
                                    onDragStart={canDrag ? (e) => handleDragStart(e, p.path, p.name) : undefined}
                                    onDragEnd={canDrag ? handleDragEnd : undefined}
                                    style={{ borderLeft: `3px solid ${col.sub.color || 'var(--border)'}` }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        {canDrag && <GripIcon size={14} />}
                                        <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)}>
                                            <div className="kanban-card-name">{p.name}</div>
                                            <div className="kanban-card-lane" style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)' }}>{p.lane}</div>
                                            {(p.stack || []).length > 0 && (
                                                <div className="kanban-card-stack">
                                                    {(p.stack || []).slice(0, 3).map(s => <span key={s} className="stack-tag">{s}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {col.projects.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 12 }}>No projects</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
