import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input type="checkbox" checked={selected} onChange={onToggleSelect}
                    style={{ marginTop: 3, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: compact ? 12 : 14 }}>{idea.title}</div>
                    {!compact && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: cat.color + '20', color: cat.color }}>{cat.icon} {cat.label}</span>
                            {(idea.linkedProjects || []).map((p: string) => (
                                <span key={p} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>📁 {p.split('/').pop()}</span>
                            ))}
                        </div>
                    )}
                </div>
                <span style={{
                    fontSize: 12, fontWeight: 700, minWidth: 20, textAlign: 'center',
                    color: (idea.score || 5) >= 8 ? '#34d399' : (idea.score || 5) >= 5 ? '#fbbf24' : '#f87171',
                }}>{idea.score || 5}</span>
            </div>

            {!compact && !editing && idea.body && (
                <div onClick={() => { setEditing(true); setEditBody(idea.body || ''); }}
                    style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', cursor: 'pointer', maxHeight: 60, overflow: 'hidden' }}>
                    {idea.body}
                </div>
            )}

            {editing && (
                <div style={{ marginTop: 8 }}>
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, minHeight: 60, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button className="btn btn-primary" onClick={() => { onUpdate({ body: editBody }); setEditing(false); }} style={{ fontSize: 10, padding: '3px 8px' }}>Save</button>
                        <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ fontSize: 10, padding: '3px 8px' }}>Cancel</button>
                    </div>
                </div>
            )}

            {!compact && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <input type="range" min={1} max={10} value={idea.score || 5}
                        onChange={e => onUpdate({ score: +e.target.value })} style={{ flex: 1, height: 4 }} />
                </div>
            )}

            {!compact && (idea.tags || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {idea.tags.map((t: string) => (
                        <span key={t} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>{t}</span>
                    ))}
                </div>
            )}

            {/* Action buttons — show on hover */}
            {showActions && (
                <div style={{
                    position: 'absolute', top: compact ? 4 : 8, right: compact ? 4 : 8,
                    display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 6, padding: '2px 4px',
                    border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                    <button onClick={onPromote} title="Promote to Task" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>📋</button>
                    <button onClick={onArchive} title={idea.archived ? 'Unarchive' : 'Archive'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>{idea.archived ? '📤' : '📥'}</button>
                    <button onClick={onDelete} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                </div>
            )}

            {/* Link project inline */}
            {!compact && showActions && (
                <div style={{ marginTop: 6 }}>
                    <SearchableSelect options={projectOptions} value={(idea.linkedProjects || [])[0] || ''}
                        onChange={v => onLinkProject(v)} placeholder="📁 Link project..." width="100%" />
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function IdeasPage() {
    const [ideas, setIdeas] = useState<any[] | null>(null);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [view, setView] = useState<IdeaView>('cards');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'score' | 'date' | 'title'>('date');
    const { data: projectData } = useProjects();

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

    const load = useCallback(async () => {
        try {
            setIdeas(await api.ideas.list({
                category: filterCat || undefined,
                search: search || undefined,
                archived: showArchived ? 'all' : undefined,
            }));
        } catch { setIdeas([]); }
    }, [filterCat, search, showArchived]);

    useEffect(() => { load(); }, [load]);

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
        if (!newTitle.trim()) return;
        await api.ideas.create({
            title: newTitle.trim(), body: newBody.trim(), category: newCat, score: newScore,
            tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
            linkedProjects: newProject ? [newProject] : [],
        });
        setShowCreate(false); setNewTitle(''); setNewBody(''); setNewTags(''); setNewScore(5); setNewProject('');
        await load();
    };

    const handleUpdate = async (id: string, data: any) => { await api.ideas.update(id, data); await load(); };
    const handleArchive = async (id: string, archived: boolean) => { await api.ideas.update(id, { archived }); await load(); };
    const handleDelete = async (id: string) => { await api.ideas.delete(id); selected.delete(id); setSelected(new Set(selected)); await load(); };

    const handlePromote = async (id: string) => {
        await api.ideas.promote(id);
        selected.delete(id); setSelected(new Set(selected));
        await load();
    };

    const handleCombine = async () => {
        const ids = [...selected];
        if (ids.length < 2) return;
        const title = prompt('Title for combined idea:', 'Combined Idea');
        if (title === null) return;
        await api.ideas.combine(ids, title || undefined);
        setSelected(new Set());
        await load();
    };

    const handleArchiveSelected = async () => {
        for (const id of selected) await api.ideas.update(id, { archived: true });
        setSelected(new Set());
        await load();
    };

    const handleLinkProject = async (id: string, project: string) => {
        const idea = allIdeas.find(i => i.id === id);
        const existing = idea?.linkedProjects || [];
        const projects = project ? [...new Set([...existing, project])] : existing;
        await api.ideas.update(id, { linkedProjects: projects });
        await load();
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {allIdeas.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} />)}
        </div>
    );

    const renderPipeline = () => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CATEGORIES.length}, minmax(180px, 1fr))`, gap: 8, overflowX: 'auto' }}>
            {CATEGORIES.map(cat => {
                const items = allIdeas.filter(i => i.category === cat.value);
                return (
                    <div key={cat.value}>
                        <div style={{ padding: '8px 12px', background: cat.color + '15', borderRadius: '8px 8px 0 0', borderBottom: `2px solid ${cat.color}`, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                            {cat.icon} {cat.label} <span style={{ opacity: 0.5 }}>({items.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, minHeight: 100, background: 'var(--bg-primary)', borderRadius: '0 0 8px 8px' }}>
                            {items.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} compact />)}
                            {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>Empty</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderList = () => (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 60px 120px 100px 60px', gap: 8, padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                <span><input type="checkbox" checked={selected.size === allIdeas.length && allIdeas.length > 0} onChange={() => selected.size === allIdeas.length ? selectNone() : selectAll()} /></span>
                <span>Title</span><span>Category</span><span>Score</span><span>Tags</span><span>Updated</span><span>Actions</span>
            </div>
            {allIdeas.map(idea => {
                const cat = CAT_MAP[idea.category] || CAT_MAP.other;
                return (
                    <div key={idea.id} style={{
                        display: 'grid', gridTemplateColumns: '30px 1fr 80px 60px 120px 100px 60px', gap: 8,
                        padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)',
                        background: selected.has(idea.id) ? 'var(--accent-bg)' : 'transparent', opacity: idea.archived ? 0.5 : 1,
                    }}>
                        <span><input type="checkbox" checked={selected.has(idea.id)} onChange={() => toggleSelect(idea.id)} /></span>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
                        <span style={{ fontSize: 10, color: cat.color }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontWeight: 700, color: (idea.score || 5) >= 8 ? '#34d399' : (idea.score || 5) >= 5 ? '#fbbf24' : '#f87171' }}>{idea.score || 5}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(idea.tags || []).join(', ')}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{idea.updatedAt ? new Date(idea.updatedAt).toLocaleDateString() : ''}</span>
                        <span style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => handlePromote(idea.id)} title="Promote" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>📋</button>
                            <button onClick={() => handleArchive(idea.id, !idea.archived)} title="Archive" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>{idea.archived ? '📤' : '📥'}</button>
                            <button onClick={() => handleDelete(idea.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                        </span>
                    </div>
                );
            })}
        </div>
    );

    const renderKanban = () => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SCORE_BUCKETS.length}, 1fr)`, gap: 12 }}>
            {SCORE_BUCKETS.map(bucket => {
                const items = allIdeas.filter(i => (i.score || 5) >= bucket.min && (i.score || 5) <= bucket.max);
                return (
                    <div key={bucket.key}>
                        <div style={{ padding: '10px 14px', background: bucket.color + '15', borderRadius: '10px 10px 0 0', borderBottom: `2px solid ${bucket.color}`, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                            {bucket.label} <span style={{ opacity: 0.5 }}>({items.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, minHeight: 150, background: 'var(--bg-primary)', borderRadius: '0 0 10px 10px' }}>
                            {items.map(idea => <IdeaCard key={idea.id} {...cardProps(idea)} />)}
                            {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>No ideas</div>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">💡 Ideas & Brainstorming</h1>
                        <p className="page-description">Capture, score, combine, and promote ideas</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Idea</button>
                </div>
            </div>

            {/* View Switcher + Filters */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                {/* Views */}
                <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 8, padding: 2 }}>
                    {VIEW_OPTIONS.map(v => (
                        <button key={v.value} onClick={() => setView(v.value)}
                            className={`btn ${view === v.value ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}>
                            {v.icon} {v.label}
                        </button>
                    ))}
                </div>

                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..."
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12, width: 150 }} />

                {/* Category filter */}
                <div style={{ display: 'flex', gap: 2 }}>
                    <button className={`btn ${!filterCat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterCat('')} style={{ fontSize: 10, padding: '3px 8px' }}>All</button>
                    {CATEGORIES.map(c => (
                        <button key={c.value} className={`btn ${filterCat === c.value ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
                            style={{ fontSize: 10, padding: '3px 8px' }} title={c.label}>{c.icon}</button>
                    ))}
                </div>

                {/* Project filter */}
                <SearchableSelect options={projectOptions} value={filterProject} onChange={setFilterProject} placeholder="📁 Project" width="140px" grouped />

                {/* Sort */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 11 }}>
                    <option value="date">Newest</option>
                    <option value="score">Score ↓</option>
                    <option value="title">A-Z</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Archived
                </label>

                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{allIdeas.length} ideas</span>
            </div>

            {/* Multiselect Toolbar */}
            {selected.size > 0 && (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', marginBottom: 12,
                    background: 'var(--accent-bg)', borderRadius: 8, border: '1px solid var(--accent)',
                }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
                    <div style={{ flex: 1 }} />
                    {selected.size >= 2 && (
                        <button className="btn btn-primary" onClick={handleCombine} style={{ fontSize: 11, padding: '4px 12px' }}>🔗 Combine</button>
                    )}
                    <button className="btn btn-secondary" onClick={handleArchiveSelected} style={{ fontSize: 11, padding: '4px 12px' }}>📥 Archive All</button>
                    <button className="btn btn-secondary" onClick={selectNone} style={{ fontSize: 11, padding: '4px 10px' }}>✕ Clear</button>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Idea title *"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, marginBottom: 12 }} />
                    <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Describe the idea..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, minHeight: 80, resize: 'vertical', marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={newCat} onChange={e => setNewCat(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12 }}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Score:</span>
                            <input type="range" min={1} max={10} value={newScore} onChange={e => setNewScore(+e.target.value)} style={{ width: 80 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20 }}>{newScore}</span>
                        </div>
                        <SearchableSelect options={projectOptions} value={newProject} onChange={setNewProject} placeholder="📁 Project" width="160px" grouped />
                        <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)"
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, minWidth: 100 }} />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: 12 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newTitle.trim()} style={{ fontSize: 12 }}>Save</button>
                    </div>
                </div>
            )}

            {/* View Content */}
            <div style={{ marginTop: 8 }}>
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
        </div>
    );
}
