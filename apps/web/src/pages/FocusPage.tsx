import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StatusData, Project, Tier } from '../lib/types';
import { TIER_CONFIG, LANE_COLORS } from '../lib/types';
import { groupByDimension } from '../lib/dimensions';
import { useDimensions } from '../hooks/useDimensions';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { PageHeader, Card, Badge, EmptyState, GripIcon, DimensionPicker } from '../components/ui';
import Dialog from '../components/Dialog';

// ─── Project Card (for grid view) ─────────────────────────────────────────────

function FocusCard({ project, onClick, onRemove }: { project: Project; onClick: () => void; onRemove?: () => void }) {
    const tc = TIER_CONFIG[project.tier as Tier] || TIER_CONFIG.idea;
    return (
        <Card onClick={onClick} accentColor={tc.color}>
            <div className="flex-between mb-6" style={{ alignItems: 'flex-start' }}>
                <div className="card-name">{project.name}</div>
                <div className="flex-row gap-6">
                    <Badge variant="tier" tier={project.tier} />
                    {onRemove && (
                        <button
                            onClick={e => { e.stopPropagation(); onRemove(); }}
                            title="Remove from focus"
                            className="icon-btn text-tertiary text-lg"
                        >✕</button>
                    )}
                </div>
            </div>
            <div className="card-description">{project.description}</div>
            <div className="flex-row gap-8 mt-8">
                <span className="text-base font-semibold" style={{ color: LANE_COLORS[project.lane] || 'var(--text-tertiary)' }}>{project.lane}</span>
                <Badge variant="health" score={project.health_score} />
                {project.oss && <Badge variant="oss" />}
            </div>
        </Card>
    );
}

// ─── Add To Focus Dialog ──────────────────────────────────────────────────────

function AddToFocusDialog({
    onClose, allProjects, focusGroup, onAdd,
}: {
    onClose: () => void; allProjects: Project[]; focusGroup: string[]; onAdd: (path: string) => void;
}) {
    const [search, setSearch] = useState('');
    const focusSet = useMemo(() => new Set(focusGroup), [focusGroup]);
    const filtered = allProjects.filter(p => {
        if (focusSet.has(p.path)) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <Dialog open={true} onClose={onClose} title="Add to Focus Group">
            <div style={{ padding: 16, minWidth: 400 }}>
                <input
                    className="search-input mb-12"
                    placeholder="Search projects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%' }}
                />
                <div className="flex-col gap-4" style={{ maxHeight: 400, overflow: 'auto' }}>
                    {filtered.length === 0 ? (
                        <div className="text-center text-tertiary text-md" style={{ padding: 24 }}>
                            {search ? 'No matching projects' : 'All projects are already in focus'}
                        </div>
                    ) : (
                        filtered.map(p => {
                            const tc = TIER_CONFIG[p.tier as Tier] || TIER_CONFIG.idea;
                            return (
                                <div key={p.path} className="flex-row gap-10" style={{
                                    padding: '8px 12px', alignItems: 'center',
                                    background: 'var(--bg-glass)', borderRadius: 6, cursor: 'pointer',
                                    border: '1px solid var(--border)', transition: 'all 0.15s',
                                }} onClick={() => { onAdd(p.path); }}>
                                    <span className="text-lg">{tc.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-md">{p.name}</div>
                                        <div className="text-sm text-tertiary">{p.lane} · {p.tier}</div>
                                    </div>
                                    <button className="btn btn-primary text-sm" style={{ padding: '3px 10px' }}>+ Add</button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Dialog>
    );
}

// ─── Focus Page ───────────────────────────────────────────────────────────────

export default function FocusPage({ data, onRefresh }: { data: StatusData; onRefresh: () => Promise<void> }) {
    const navigate = useNavigate();
    const { dimensions, focusGroup, loaded, addToFocus, removeFromFocus, togglePin, isPinned, saveFocusGroup } = useDimensions(data.projects);
    const [view, setView] = useState<'list' | 'grid' | 'kanban'>('list');
    const [groupDimension, setGroupDimension] = useState('priority');
    const [showAddDialog, setShowAddDialog] = useState(false);

    // DnD state for kanban (optimistic + debounced)
    const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const pendingRef = useRef<{ projectPath: string; field: string; newValue: string }[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ghostRef = useRef<HTMLDivElement | null>(null);

    const SAVE_DEBOUNCE = 1500;

    const updateProject = useMutation(api.projects.updateByPath);

    const flushSaves = useCallback(async () => {
        const changes = [...pendingRef.current];
        pendingRef.current = [];
        if (changes.length === 0) return;
        setSaving(true);
        try {
            const byProject = new Map<string, typeof changes[0]>();
            for (const c of changes) byProject.set(c.projectPath, c);
            for (const [, change] of byProject) {
                await updateProject({
                    path: change.projectPath,
                    [change.field]: change.newValue,
                });
            }
            await onRefresh();
            setOverrides({});
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    }, [onRefresh, updateProject]);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (pendingRef.current.length > 0) flushSaves();
    }, [flushSaves]);

    // Auto-clean stale focus entries (old Convex IDs or paths that no longer match any project)
    const allPaths = useMemo(() => new Set(data.projects.map(p => p.path)), [data.projects]);
    useEffect(() => {
        if (!loaded || focusGroup.length === 0) return;
        const stale = focusGroup.filter(id => !allPaths.has(id));
        if (stale.length > 0) {
            const clean = focusGroup.filter(id => allPaths.has(id));
            saveFocusGroup(clean);
        }
    }, [loaded, focusGroup, allPaths, saveFocusGroup]);

    // Focus projects = only manually added projects
    const focusProjects = useMemo(() => {
        const pinned = new Set(focusGroup);
        const allProjects = data.projects.map(p => {
            const o = overrides[p.path];
            return o ? { ...p, ...o } as Project : p;
        });
        return allProjects.filter(p => pinned.has(p.path));
    }, [data.projects, focusGroup, overrides]);



    const activeDimension = dimensions.find((d: any) => d.id === groupDimension);
    const groups = useMemo(() => {
        if (!activeDimension) return null;
        return groupByDimension(focusProjects, activeDimension);
    }, [focusProjects, activeDimension]);

    const goToProject = useCallback((path: string) => navigate(`/project/${encodeURIComponent(path)}`), [navigate]);

    // ─── DnD Handlers for Kanban ────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, projectPath: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', projectPath);
        const cardEl = e.currentTarget as HTMLElement;
        const ghost = cardEl.cloneNode(true) as HTMLDivElement;
        ghost.className = 'kanban-card kanban-drag-ghost';
        ghost.style.width = cardEl.offsetWidth + 'px';
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        e.dataTransfer.setDragImage(ghost, cardEl.offsetWidth / 2, 20);
        requestAnimationFrame(() => { cardEl.classList.add('dragging'); });
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('dragging');
        document.querySelectorAll('.kanban-card.dragging').forEach(el => el.classList.remove('dragging'));
        setDragOverCol(null);
        if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, col: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCol(col);
    }, []);

    const handleDragLeave = useCallback(() => { setDragOverCol(null); }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetValue: string) => {
        e.preventDefault();
        setDragOverCol(null);
        if (!activeDimension || activeDimension.field === 'computed') return;
        const projectPath = e.dataTransfer.getData('text/plain');
        if (!projectPath) return;
        const project = focusProjects.find(p => p.path === projectPath);
        if (!project || (project as any)[activeDimension.field] === targetValue) return;
        setOverrides(prev => ({ ...prev, [projectPath]: { ...prev[projectPath], [activeDimension.field]: targetValue } }));
        pendingRef.current.push({ projectPath, field: activeDimension.field, newValue: targetValue });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushSaves, SAVE_DEBOUNCE);
    }, [activeDimension, focusProjects, flushSaves]);

    const canDrag = activeDimension && activeDimension.field !== 'computed';

    // ─── List View ──────────────────────────────────────────────────────────
    const pinnedList = useMemo(() => focusProjects.filter(p => isPinned(p.path)), [focusProjects, isPinned]);
    const unpinnedList = useMemo(() => focusProjects.filter(p => !isPinned(p.path)), [focusProjects, isPinned]);
    const hasPinned = pinnedList.length > 0;

    const renderListCard = (p: typeof focusProjects[0]) => {
        const pinned = isPinned(p.path);
        return (
            <div key={p.path} className="focus-card" onClick={() => goToProject(p.path)}
                style={pinned ? { borderLeft: '3px solid var(--accent)' } : undefined}>
                <div className="flex-between mb-6" style={{ alignItems: 'flex-start' }}>
                    <div className="focus-card-name">{p.name}</div>
                    <div className="flex-row gap-6">
                        <Badge variant="tier" tier={p.tier} />
                        <button
                            onClick={e => { e.stopPropagation(); togglePin(p.path); }}
                            title={pinned ? 'Unpin' : 'Pin to top'}
                            className="icon-btn text-lg"
                            style={{ color: pinned ? 'var(--accent)' : 'var(--text-tertiary)', opacity: pinned ? 1 : 0.4 }}
                        >📌</button>
                        <button onClick={e => { e.stopPropagation(); removeFromFocus(p.path); }}
                            title="Remove from focus" className="icon-btn text-tertiary text-lg">
                            ✕
                        </button>
                    </div>
                </div>
                <div className="focus-card-description">{p.description}</div>
                <div className="flex-row gap-8">
                    <span className="text-base font-semibold" style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)' }}>{p.lane}</span>
                    <Badge variant="health" score={p.health_score} />
                    {p.oss && <Badge variant="oss" />}
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="flex-col gap-10">
            {hasPinned && (
                <>
                    <div className="dimension-group-header">📌 Pinned</div>
                    {pinnedList.map(renderListCard)}
                    {unpinnedList.length > 0 && (
                        <div className="dimension-group-header" style={{ marginTop: 8 }}>Others</div>
                    )}
                </>
            )}
            {unpinnedList.map(renderListCard)}
        </div>
    );

    // ─── Grid View ──────────────────────────────────────────────────────────
    const renderGridItems = (projects: Project[]) => (
        <div className="project-grid">
            {projects.map(p => (
                <FocusCard
                    key={p.path}
                    project={p}
                    onClick={() => goToProject(p.path)}
                    onRemove={() => removeFromFocus(p.path)}
                />
            ))}
        </div>
    );

    const renderGrid = () => {
        if (groups) {
            return groups.filter(g => g.projects.length > 0).map(g => (
                <div key={g.key} className="dimension-group">
                    <div className="dimension-group-header" style={{ borderColor: g.sub.color || 'var(--border)' }}>
                        {g.sub.icon && <span className="dimension-group-icon">{g.sub.icon}</span>}
                        <span className="dimension-group-label" style={{ color: g.sub.color }}>{g.sub.label}</span>
                        <span className="dimension-group-count">{g.projects.length}</span>
                    </div>
                    {renderGridItems(g.projects)}
                </div>
            ));
        }
        return renderGridItems(focusProjects);
    };

    // ─── Kanban View (with DnD) ─────────────────────────────────────────────
    const renderKanban = () => {
        const cols = groups || groupByDimension(focusProjects, dimensions.find((d: any) => d.id === 'priority') || dimensions[0]);
        return (
            <>
                {saving && (
                    <div className="kanban-saving-bar">
                        ⏳ Saving changes...
                    </div>
                )}
                <div className="kanban-board">
                    {cols.map(col => (
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
                                    <div key={p.path} className="kanban-card"
                                        data-focus-path={p.path}
                                        draggable={!!canDrag}
                                        onDragStart={canDrag ? (e) => handleDragStart(e, p.path) : undefined}
                                        onDragEnd={canDrag ? handleDragEnd : undefined}
                                        style={{ borderLeft: `3px solid ${col.sub.color || 'var(--border)'}` }}>
                                        <div className="flex-row gap-8" style={{ alignItems: 'flex-start' }}>
                                            {canDrag && <GripIcon size={14} />}
                                            <div className="flex-1 min-w-0" onClick={() => goToProject(p.path)}>
                                                <div className="kanban-card-name">{p.name}</div>
                                                <div className="kanban-card-lane" style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)' }}>{p.lane}</div>
                                                <div className="flex-row gap-6 mt-6">
                                                    <Badge variant="health" score={p.health_score} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {col.projects.length === 0 && (
                                    <div className="text-center text-tertiary text-base" style={{ padding: 30 }}>No projects</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // Wait for dimensions/focus group to load before rendering to avoid staggered display
    if (!loaded) {
        return (
            <div className="loading"><div className="loading-spinner" /> Loading focus data...</div>
        );
    }

    return (
        <div>
            <PageHeader
                title="🎯 Focus Mode"
                description="Your highest-priority projects. Pin additional projects to keep them here."
                actions={
                    <button className="btn btn-primary text-base" onClick={() => setShowAddDialog(true)}>
                        + Add Project
                    </button>
                }
            />

            {/* View Toggle + Dimension Picker */}
            <div className="flex-row flex-wrap gap-12 mb-20">
                <div className="view-toggle">
                    <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('list')}>☰ List</button>
                    <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('grid')}>⊞ Grid</button>
                    <button className={`btn ${view === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('kanban')}>▥ Kanban</button>
                </div>
                {(view === 'grid' || view === 'kanban') && (
                    <DimensionPicker
                        dimensions={dimensions}
                        selected={groupDimension}
                        onChange={setGroupDimension}
                        allowNone={view === 'grid'}
                    />
                )}
                <span className="text-base text-tertiary" style={{ marginLeft: 'auto' }}>
                    {focusProjects.length} projects · {focusGroup.length} pinned
                </span>
            </div>

            {focusProjects.length === 0 ? (
                <EmptyState icon="✨" message='No focused projects yet. Pin projects or set them to "building" tier / "high" priority.' />
            ) : view === 'list' ? (
                renderList()
            ) : view === 'grid' ? (
                renderGrid()
            ) : (
                renderKanban()
            )}

            {showAddDialog && (
                <AddToFocusDialog
                    onClose={() => setShowAddDialog(false)}
                    allProjects={data.projects}
                    focusGroup={focusGroup}
                    onAdd={(path) => { addToFocus(path); }}
                />
            )}
        </div>
    );
}
