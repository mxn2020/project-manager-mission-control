import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { useUrlFilters } from '../hooks/useUrlFilters';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import PromptDialog from '../components/PromptDialog';

type IdeaView = 'cards' | 'pipeline' | 'list' | 'kanban' | 'canvas';

const CATEGORIES = [
    { value: 'product', label: 'Product', icon: '📦', color: '#60a5fa' },
    { value: 'feature', label: 'Feature', icon: '✨', color: '#a78bfa' },
    { value: 'content', label: 'Content', icon: '📝', color: '#34d399' },
    { value: 'business', label: 'Business', icon: '💼', color: '#fbbf24' },
    { value: 'research', label: 'Research', icon: '🔬', color: '#f472b6' },
    { value: 'experiment', label: 'Experiment', icon: '🧪', color: '#818cf8' },
    { value: 'other', label: 'Other', icon: '💡', color: '#6b7280' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const SCORE_BUCKETS = [
    { key: 'high', label: '🔥 High (8-10)', min: 8, max: 10, color: '#34d399' },
    { key: 'medium', label: '⚡ Medium (4-7)', min: 4, max: 7, color: '#fbbf24' },
    { key: 'low', label: '💤 Low (1-3)', min: 1, max: 3, color: '#f87171' },
];

const VIEW_OPTIONS: { value: IdeaView; label: string; icon: string }[] = [
    { value: 'cards', label: 'Cards', icon: '🔲' },
    { value: 'pipeline', label: 'Pipeline', icon: '📊' },
    { value: 'list', label: 'List', icon: '📋' },
    { value: 'kanban', label: 'Kanban', icon: '📌' },
    { value: 'canvas', label: 'Canvas', icon: '🎨' },
];

const CANVAS_STORAGE_KEY = 'mc-ideas-canvas';

function getCanvasKey(filterCat: string, filterProject: string) {
    return `cat:${filterCat || '*'}|proj:${filterProject || '*'}`;
}

function loadCanvasPositions(key: string): Record<string, { x: number; y: number }> {
    try {
        const all = JSON.parse(localStorage.getItem(CANVAS_STORAGE_KEY) || '{}');
        return all[key] || {};
    } catch { return {}; }
}

function saveCanvasPositions(key: string, positions: Record<string, { x: number; y: number }>) {
    try {
        const all = JSON.parse(localStorage.getItem(CANVAS_STORAGE_KEY) || '{}');
        all[key] = positions;
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
}

// ─── IdeaCard (shared across views) ────────────────────────────────────────

function IdeaCard({ idea, selected, onToggleSelect, onUpdate, onArchive, onDelete, onPromote, onLinkProject, projectOptions, compact }: {
    idea: any; selected: boolean; onToggleSelect: () => void; onUpdate: (data: any) => void;
    onArchive: () => void; onDelete: () => void; onPromote: () => void;
    onLinkProject: (proj: string) => void; projectOptions: SelectOption[]; compact?: boolean;
}) {
    const cat = CAT_MAP[idea.category] || CAT_MAP.other;
    const [editing, setEditing] = useState(false);
    const [editBody, setEditBody] = useState('');
    const [showActions, setShowActions] = useState(false);

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: compact ? 6 : 10, padding: compact ? 10 : 16,
            border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderTop: compact ? undefined : `3px solid ${cat.color}`,
            opacity: idea.archived ? 0.5 : 1, position: 'relative', transition: 'border 0.1s',
        }}
            onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex-row gap-8" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={selected} onChange={onToggleSelect}
                    style={{ marginTop: 3, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ fontSize: compact ? 12 : 14 }}>{idea.title}</div>
                    {!compact && (
                        <div className="flex-row flex-wrap gap-4 mt-4">
                            <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: cat.color + '20', color: cat.color }}>{cat.icon} {cat.label}</span>
                            {(idea.linkedProjects || []).map((p: string) => (
                                <span key={p} className="tag" style={{ fontSize: 9 }}>📁 {p.split('/').pop()}</span>
                            ))}
                        </div>
                    )}
                </div>
                <span className="text-base font-bold text-center" style={{
                    minWidth: 20,
                    color: (idea.score || 5) >= 8 ? '#34d399' : (idea.score || 5) >= 5 ? '#fbbf24' : '#f87171',
                }}>{idea.score || 5}</span>
            </div>

            {!compact && !editing && idea.body && (
                <div onClick={() => { setEditing(true); setEditBody(idea.body || ''); }}
                    className="text-base text-muted whitespace-pre mt-8" style={{ cursor: 'pointer', maxHeight: 60, overflow: 'hidden' }}>
                    {idea.body}
                </div>
            )}

            {editing && (
                <div className="mt-8">
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                        className="form-textarea text-base" style={{ minHeight: 60 }} />
                    <div className="flex-row gap-6 mt-4">
                        <button className="btn btn-primary text-xs" onClick={() => { onUpdate({ body: editBody }); setEditing(false); }} style={{ padding: '3px 8px' }}>Save</button>
                        <button className="btn btn-secondary text-xs" onClick={() => setEditing(false)} style={{ padding: '3px 8px' }}>Cancel</button>
                    </div>
                </div>
            )}

            {!compact && (
                <div className="flex-row gap-6 mt-8">
                    <input type="range" min={1} max={10} value={idea.score || 5}
                        onChange={e => onUpdate({ score: +e.target.value })} className="flex-1" style={{ height: 4 }} />
                </div>
            )}

            {!compact && (idea.tags || []).length > 0 && (
                <div className="flex-row flex-wrap gap-4 mt-8">
                    {idea.tags.map((t: string) => (
                        <span key={t} className="tag" style={{ fontSize: 9 }}>{t}</span>
                    ))}
                </div>
            )}

            {/* Action buttons — show on hover */}
            {showActions && (
                <div className="flex-row gap-2" style={{
                    position: 'absolute', top: compact ? 4 : 8, right: compact ? 4 : 8,
                    background: 'var(--bg-secondary)', borderRadius: 6, padding: '2px 4px',
                    border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                    <button onClick={onPromote} title="Promote to Task" className="icon-btn">📋</button>
                    <button onClick={onArchive} title={idea.archived ? 'Unarchive' : 'Archive'} className="icon-btn">{idea.archived ? '📤' : '📥'}</button>
                    <button onClick={onDelete} title="Delete" className="icon-btn">🗑️</button>
                </div>
            )}

            {/* Link project inline */}
            {!compact && showActions && (
                <div className="mt-8">
                    <SearchableSelect options={projectOptions} value={(idea.linkedProjects || [])[0] || ''}
                        onChange={v => onLinkProject(v)} placeholder="📁 Link project..." width="100%" />
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function IdeasPage() {
    const { orgId } = useAuth() as any;

    const [search, setSearch] = useState('');
    const [urlFilters, setUrlFilter] = useUrlFilters({ view: 'cards', category: '', project: '', sort: 'date', archived: '' });
    const filterCat = urlFilters.category;
    const filterProject = urlFilters.project;
    const showArchived = urlFilters.archived === 'true';
    const view = (urlFilters.view || 'cards') as IdeaView;
    const sortBy = (urlFilters.sort || 'date') as 'score' | 'date' | 'title';
    const [showCreate, setShowCreate] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const { data: projectData } = useProjects();

    // Prompt dialog for combining ideas
    const [combinePromptOpen, setCombinePromptOpen] = useState(false);

    // Create form
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newCat, setNewCat] = useState('other');
    const [newScore, setNewScore] = useState(5);
    const [newTags, setNewTags] = useState('');
    const [newProject, setNewProject] = useState('');

    // Canvas
    const canvasRef = useRef<HTMLDivElement>(null);
    const [canvasPositions, setCanvasPositions] = useState<Record<string, { x: number; y: number }>>({});
    const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

    // Convex hooks
    const rawIdeas = useQuery(api.ideas.list, orgId ? {
        orgId,
        category: filterCat || undefined,
        search: search || undefined,
        archived: showArchived ? 'all' : undefined,
    } : "skip");

    const createIdea = useMutation(api.ideas.create);
    const updateIdea = useMutation(api.ideas.update);
    const deleteIdea = useMutation(api.ideas.remove);
    const promoteIdea = useMutation(api.ideas.promote);
    const combineIdeas = useMutation(api.ideas.combine);

    const ideas = rawIdeas ? rawIdeas.map(i => ({ ...i, id: i._id })) : null;

    // Load canvas positions when filter changes
    useEffect(() => {
        setCanvasPositions(loadCanvasPositions(getCanvasKey(filterCat, filterProject)));
    }, [filterCat, filterProject]);

    const projectOptions: SelectOption[] = useMemo(() =>
        (projectData?.projects || []).map(p => {
            const segs = p.path.split('/');
            return { value: p.path, label: segs[segs.length - 1] || p.path, group: segs[0], icon: '📁' };
        }), [projectData]);

    const allIdeas = useMemo(() => {
        let list = [...(ideas || [])];
        if (filterProject) list = list.filter(i => (i.linkedProjects || []).includes(filterProject));
        if (sortBy === 'score') list.sort((a, b) => (b.score || 5) - (a.score || 5));
        else if (sortBy === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        else list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        return list;
    }, [ideas, filterProject, sortBy]);

    // ─── Handlers ────────────────────────────────
    const handleCreate = async () => {
        if (!newTitle.trim() || !orgId) return;
        await createIdea({
            orgId,
            title: newTitle.trim(), body: newBody.trim(), category: newCat, score: newScore,
            tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
            linkedProjects: newProject ? [newProject] : [],
        });
        setShowCreate(false); setNewTitle(''); setNewBody(''); setNewTags(''); setNewScore(5); setNewProject('');
    };

    const handleUpdate = async (id: string, data: any) => { await updateIdea({ ideaId: id as any, ...data }); };
    const handleArchive = async (id: string, archived: boolean) => { await updateIdea({ ideaId: id as any, archived }); };
    const handleDelete = async (id: string) => {
        if (confirm("Delete this idea?")) {
            await deleteIdea({ ideaId: id as any });
            selected.delete(id); setSelected(new Set(selected));
        }
    };

    const handlePromote = async (id: string) => {
        await promoteIdea({ ideaId: id as any });
        selected.delete(id); setSelected(new Set(selected));
    };

    const handleCombineClick = () => {
        if (selected.size < 2) return;
        setCombinePromptOpen(true);
    };

    const handleCombineSubmit = async (title: string) => {
        const ids = [...selected] as any[];
        await combineIdeas({ ideaIds: ids, title: title || undefined });
        setSelected(new Set());
    };

    const handleArchiveSelected = async () => {
        for (const id of selected) await updateIdea({ ideaId: id as any, archived: true });
        setSelected(new Set());
    };

    const handleLinkProject = async (id: string, project: string) => {
        const idea = allIdeas.find(i => i.id === id);
        const existing = idea?.linkedProjects || [];
        const projects = project ? [...new Set([...existing, project])] : existing;
        await updateIdea({ ideaId: id as any, linkedProjects: projects });
    };

    const toggleSelect = (id: string) => {
        const s = new Set(selected);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelected(s);
    };

    const selectAll = () => setSelected(new Set(allIdeas.map(i => i.id)));
    const selectNone = () => setSelected(new Set());

    // Canvas drag handlers
    const handleCanvasMouseDown = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        const pos = canvasPositions[id] || { x: 0, y: 0 };
        dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    };

    const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
        if (!dragRef.current) return;
        const { id, startX, startY, origX, origY } = dragRef.current;
        setCanvasPositions(prev => ({
            ...prev,
            [id]: { x: origX + e.clientX - startX, y: origY + e.clientY - startY },
        }));
    }, []);

    const handleCanvasMouseUp = useCallback(() => {
        if (!dragRef.current) return;
        dragRef.current = null;
        const key = getCanvasKey(filterCat, filterProject);
        setCanvasPositions(prev => { saveCanvasPositions(key, prev); return prev; });
    }, [filterCat, filterProject]);

    useEffect(() => {
        window.addEventListener('mousemove', handleCanvasMouseMove);
        window.addEventListener('mouseup', handleCanvasMouseUp);
        return () => { window.removeEventListener('mousemove', handleCanvasMouseMove); window.removeEventListener('mouseup', handleCanvasMouseUp); };
    }, [handleCanvasMouseMove, handleCanvasMouseUp]);

    // ─── Render Helpers ──────────────────────────

    const cardProps = (idea: any) => ({
        idea, selected: selected.has(idea.id), onToggleSelect: () => toggleSelect(idea.id),
        onUpdate: (d: any) => handleUpdate(idea.id, d), onArchive: () => handleArchive(idea.id, !idea.archived),
        onDelete: () => handleDelete(idea.id), onPromote: () => handlePromote(idea.id),
        onLinkProject: (p: string) => handleLinkProject(idea.id, p), projectOptions,
    });

    const renderCards = () => (
        <div className="gap-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {allIdeas.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} />)}
        </div>
    );

    const renderPipeline = () => (
        <div className="gap-8" style={{ display: 'grid', gridTemplateColumns: `repeat(${CATEGORIES.length}, minmax(180px, 1fr))`, overflowX: 'auto' }}>
            {CATEGORIES.map(cat => {
                const items = allIdeas.filter(i => i.category === cat.value);
                return (
                    <div key={cat.value}>
                        <div className="text-base font-semibold text-center" style={{ padding: '8px 12px', background: cat.color + '15', borderRadius: '8px 8px 0 0', borderBottom: `2px solid ${cat.color}` }}>
                            {cat.icon} {cat.label} <span className="opacity-50">({items.length})</span>
                        </div>
                        <div className="flex-col gap-6" style={{ padding: 6, minHeight: 100, background: 'var(--bg-primary)', borderRadius: '0 0 8px 8px' }}>
                            {items.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} compact />)}
                            {items.length === 0 && <div className="text-sm text-tertiary text-center" style={{ padding: 20 }}>Empty</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderList = () => (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="section-label" style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 60px 120px 100px 60px', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                <span><input type="checkbox" checked={selected.size === allIdeas.length && allIdeas.length > 0} onChange={() => selected.size === allIdeas.length ? selectNone() : selectAll()} /></span>
                <span>Title</span><span>Category</span><span>Score</span><span>Tags</span><span>Updated</span><span>Actions</span>
            </div>
            {allIdeas.map(idea => {
                const cat = CAT_MAP[idea.category] || CAT_MAP.other;
                return (
                    <div key={idea.id} className="text-base" style={{
                        display: 'grid', gridTemplateColumns: '30px 1fr 80px 60px 120px 100px 60px', gap: 8,
                        padding: '8px 12px', borderBottom: '1px solid var(--border)',
                        background: selected.has(idea.id) ? 'var(--accent-bg)' : 'transparent', opacity: idea.archived ? 0.5 : 1,
                    }}>
                        <span><input type="checkbox" checked={selected.has(idea.id)} onChange={() => toggleSelect(idea.id)} /></span>
                        <span className="font-medium truncate">{idea.title}</span>
                        <span className="text-xs" style={{ color: cat.color }}>{cat.icon} {cat.label}</span>
                        <span className="font-bold" style={{ color: (idea.score || 5) >= 8 ? '#34d399' : (idea.score || 5) >= 5 ? '#fbbf24' : '#f87171' }}>{idea.score || 5}</span>
                        <span className="text-xs text-tertiary truncate">{(idea.tags || []).join(', ')}</span>
                        <span className="text-xs text-tertiary">{idea.updatedAt ? new Date(idea.updatedAt).toLocaleDateString() : ''}</span>
                        <span className="flex-row gap-2">
                            <button onClick={() => handlePromote(idea.id)} title="Promote" className="icon-btn">📋</button>
                            <button onClick={() => handleArchive(idea.id, !idea.archived)} title="Archive" className="icon-btn">{idea.archived ? '📤' : '📥'}</button>
                            <button onClick={() => handleDelete(idea.id)} title="Delete" className="icon-btn">🗑️</button>
                        </span>
                    </div>
                );
            })}
        </div>
    );

    const renderKanban = () => (
        <div className="gap-12" style={{ display: 'grid', gridTemplateColumns: `repeat(${SCORE_BUCKETS.length}, 1fr)` }}>
            {SCORE_BUCKETS.map(bucket => {
                const items = allIdeas.filter(i => (i.score || 5) >= bucket.min && (i.score || 5) <= bucket.max);
                return (
                    <div key={bucket.key}>
                        <div className="text-md font-semibold text-center" style={{ padding: '10px 14px', background: bucket.color + '15', borderRadius: '10px 10px 0 0', borderBottom: `2px solid ${bucket.color}` }}>
                            {bucket.label} <span className="opacity-50">({items.length})</span>
                        </div>
                        <div className="flex-col gap-8" style={{ padding: 8, minHeight: 150, background: 'var(--bg-primary)', borderRadius: '0 0 10px 10px' }}>
                            {items.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} />)}
                            {items.length === 0 && <div className="text-base text-tertiary text-center" style={{ padding: 40 }}>No ideas</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderCanvas = () => {
        // Assign default positions in a grid for ideas without saved positions
        const positioned = allIdeas.map((idea, i) => {
            const saved = canvasPositions[idea.id];
            const cols = 4;
            const x = saved?.x ?? (i % cols) * 320 + 20;
            const y = saved?.y ?? Math.floor(i / cols) * 200 + 20;
            return { ...idea, _x: x, _y: y };
        });
        const maxY = Math.max(600, ...positioned.map(p => p._y + 200));

        return (
            <div ref={canvasRef} style={{
                position: 'relative', height: maxY, background: 'var(--bg-primary)',
                borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto',
                backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
            }}>
                {positioned.map(idea => (
                    <div key={idea.id}
                        onMouseDown={e => handleCanvasMouseDown(idea.id, e)}
                        style={{
                            position: 'absolute', left: idea._x, top: idea._y, width: 280,
                            cursor: 'grab', userSelect: 'none',
                        }}>
                        <IdeaCard {...cardProps(idea)} />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">💡 Ideas & Brainstorming</h1>
                        <p className="page-description">Capture, score, combine, and promote ideas</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Idea</button>
                </div>
            </div>

            {/* View Switcher + Filters */}
            <div className="flex-row flex-wrap gap-8 mb-12">
                {/* Views */}
                <div className="flex-row gap-2" style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 2 }}>
                    {VIEW_OPTIONS.map(v => (
                        <button key={v.value} onClick={() => setUrlFilter('view', v.value)}
                            className={`btn ${view === v.value ? 'btn-primary' : 'btn-secondary'} text-sm`}
                            style={{ padding: '4px 10px', borderRadius: 6 }}>
                            {v.icon} {v.label}
                        </button>
                    ))}
                </div>

                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..."
                    className="form-input-sm" style={{ width: 150, background: 'var(--bg-secondary)' }} />

                {/* Category filter */}
                <div className="flex-row gap-2">
                    <button className={`btn ${!filterCat ? 'btn-primary' : 'btn-secondary'} text-xs`} onClick={() => setUrlFilter('category', '')} style={{ padding: '3px 8px' }}>All</button>
                    {CATEGORIES.map(c => (
                        <button key={c.value} className={`btn ${filterCat === c.value ? 'btn-primary' : 'btn-secondary'} text-xs`}
                            onClick={() => setUrlFilter('category', filterCat === c.value ? '' : c.value)}
                            style={{ padding: '3px 8px' }} title={c.label}>{c.icon}</button>
                    ))}
                </div>

                {/* Project filter */}
                <SearchableSelect options={projectOptions} value={filterProject} onChange={(v) => setUrlFilter('project', v)} placeholder="📁 Project" width="140px" grouped />

                {/* Sort */}
                <SearchableSelect
                    options={[{ value: 'date', label: 'Newest' }, { value: 'score', label: 'Score ↓' }, { value: 'title', label: 'A-Z' }]}
                    value={sortBy} onChange={v => setUrlFilter('sort', v)} placeholder="Sort" clearable={false} width="110px" />

                <label className="flex-row gap-4 text-sm text-tertiary">
                    <input type="checkbox" checked={showArchived} onChange={e => setUrlFilter('archived', e.target.checked ? 'true' : '')} /> Archived
                </label>

                <span className="text-sm text-tertiary" style={{ marginLeft: 'auto' }}>{allIdeas.length} ideas</span>
            </div>

            {/* Multiselect Toolbar */}
            {selected.size > 0 && (
                <div className="flex-row gap-8 mb-12" style={{
                    padding: '8px 14px',
                    background: 'var(--accent-bg)', borderRadius: 8, border: '1px solid var(--accent)',
                }}>
                    <span className="text-base font-semibold">{selected.size} selected</span>
                    <div className="flex-1" />
                    {selected.size >= 2 && (
                        <button className="btn btn-primary text-sm" onClick={handleCombineClick} style={{ padding: '4px 12px' }}>🔗 Combine</button>
                    )}
                    <button className="btn btn-secondary text-sm" onClick={handleArchiveSelected} style={{ padding: '4px 12px' }}>📥 Archive All</button>
                    <button className="btn btn-secondary text-sm" onClick={selectNone} style={{ padding: '4px 10px' }}>✕ Clear</button>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Idea title *"
                        className="form-input mb-12" />
                    <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Describe the idea..."
                        className="form-textarea mb-12" style={{ minHeight: 80 }} />
                    <div className="flex-row flex-wrap gap-12">
                        <SearchableSelect
                            options={CATEGORIES.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))}
                            value={newCat} onChange={setNewCat} placeholder="Category" clearable={false} width="160px" />
                        <div className="flex-row gap-6">
                            <span className="text-sm text-tertiary">Score:</span>
                            <input type="range" min={1} max={10} value={newScore} onChange={e => setNewScore(+e.target.value)} style={{ width: 80 }} />
                            <span className="text-md font-semibold" style={{ minWidth: 20 }}>{newScore}</span>
                        </div>
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="📁 Project" width="160px" grouped />
                        <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)"
                            className="form-input-sm flex-1" style={{ minWidth: 100 }} />
                        <button className="btn btn-secondary text-base" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary text-base" onClick={handleCreate} disabled={!newTitle.trim()}>Save</button>
                    </div>
                </div>
            )}

            {/* View Content */}
            <div className="mt-8">
                {ideas === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading ideas...</div>
                ) : allIdeas.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💡</div>
                        <div className="empty-state-text">No ideas yet — capture your first thought!</div>
                    </div>
                ) : (
                    <>
                        {view === 'cards' && renderCards()}
                        {view === 'pipeline' && renderPipeline()}
                        {view === 'list' && renderList()}
                        {view === 'kanban' && renderKanban()}
                        {view === 'canvas' && renderCanvas()}
                    </>
                )}
            </div>
            <PromptDialog
                open={combinePromptOpen}
                onClose={() => setCombinePromptOpen(false)}
                onSubmit={handleCombineSubmit}
                title="Combine Ideas"
                placeholder="Title for combined idea…"
                defaultValue="Combined Idea"
            />
        </div>
    );
}
