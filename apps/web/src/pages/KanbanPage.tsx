import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project } from '../lib/types';
import { LANE_COLORS } from '../lib/types';
import { groupByDimension } from '../lib/dimensions';
import { useDimensions } from '../hooks/useDimensions';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { PageHeader, Badge, GripIcon, DimensionPicker } from '../components/ui';

/** Pending change queued for batch save */
interface PendingChange {
    projectPath: string;
    field: string;
    newValue: string;
}

const SAVE_DEBOUNCE_MS = 1500;

export default function KanbanPage({ data, onRefresh }: { data: StatusData; onRefresh: () => Promise<void> }) {
    const navigate = useNavigate();
    const { dimensions } = useDimensions(data.projects);
    const [columnDimension, setColumnDimension] = useState('tier');
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

    const activeDimension = dimensions.find(d => d.id === columnDimension);

    const columns = useMemo(() => {
        if (!activeDimension) return [];
        return groupByDimension(projects, activeDimension);
    }, [projects, activeDimension]);

    const updateProject = useMutation(api.projects.update);

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
                    projectId: change.projectPath as any,
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
    const handleDragStart = useCallback((e: React.DragEvent, projectPath: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', projectPath);

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

        const projectPath = e.dataTransfer.getData('text/plain');
        if (!projectPath) return;

        // Check if same column
        const project = projects.find(p => p.path === projectPath);
        if (!project) return;
        const currentValue = (project as any)[activeDimension.field];
        if (currentValue === targetValue) return;

        // Optimistic update: apply override immediately
        setOverrides(prev => ({
            ...prev,
            [projectPath]: { ...prev[projectPath], [activeDimension.field]: targetValue },
        }));

        // Queue save
        queueSave({
            projectPath,
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
                actions={
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
                                    key={p.path}
                                    className="kanban-card"
                                    data-project-path={p.path}
                                    draggable={!!canDrag}
                                    onDragStart={canDrag ? (e) => handleDragStart(e, p.path) : undefined}
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
