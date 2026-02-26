import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

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

export default function IdeasPage() {
    const [ideas, setIdeas] = useState<any[] | null>(null);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [editBody, setEditBody] = useState('');

    // Create form
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newCat, setNewCat] = useState('other');
    const [newScore, setNewScore] = useState(5);
    const [newTags, setNewTags] = useState('');

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

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        await api.ideas.create({
            title: newTitle.trim(), body: newBody.trim(),
            category: newCat, score: newScore,
            tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        });
        setShowCreate(false); setNewTitle(''); setNewBody(''); setNewTags(''); setNewScore(5);
        await load();
    };

    const handleUpdateScore = async (id: string, score: number) => {
        await api.ideas.update(id, { score });
        await load();
    };

    const handleArchive = async (id: string, archived: boolean) => {
        await api.ideas.update(id, { archived });
        await load();
    };

    const handleSaveEdit = async (id: string) => {
        await api.ideas.update(id, { body: editBody });
        setEditing(null);
        await load();
    };

    const handleDelete = async (id: string) => {
        await api.ideas.delete(id);
        await load();
    };

    const allIdeas = ideas || [];

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">💡 Ideas & Brainstorming</h1>
                        <p className="page-description">Capture, score, and combine ideas across your portfolio</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Idea</button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Search ideas..."
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12, flex: 1, minWidth: 150 }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className={`btn ${!filterCat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterCat('')} style={{ fontSize: 11, padding: '4px 10px' }}>All</button>
                    {CATEGORIES.map(c => (
                        <button key={c.value} className={`btn ${filterCat === c.value ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
                            style={{ fontSize: 11, padding: '4px 10px' }}>
                            {c.icon}
                        </button>
                    ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Archived
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{allIdeas.length} ideas</span>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginTop: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
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
                            <input type="range" min={1} max={10} value={newScore} onChange={e => setNewScore(+e.target.value)} style={{ width: 100 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20 }}>{newScore}</span>
                        </div>
                        <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)"
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, minWidth: 120 }} />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: 12 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newTitle.trim()} style={{ fontSize: 12 }}>Save</button>
                    </div>
                </div>
            )}

            {/* Ideas Grid */}
            <div style={{ marginTop: 16 }}>
                {ideas === null ? (
                    <div className="loading"><div className="loading-spinner" /> Loading ideas...</div>
                ) : allIdeas.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💡</div>
                        <div className="empty-state-text">No ideas yet — capture your first thought!</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                        {allIdeas.map(idea => {
                            const cat = CAT_MAP[idea.category] || CAT_MAP.other;
                            return (
                                <div key={idea.id} style={{
                                    background: 'var(--bg-secondary)', borderRadius: 10, padding: 16,
                                    border: '1px solid var(--border)', borderTop: `3px solid ${cat.color}`,
                                    opacity: idea.archived ? 0.5 : 1, position: 'relative',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{idea.title}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => handleArchive(idea.id, !idea.archived)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}
                                                title={idea.archived ? 'Unarchive' : 'Archive'}>
                                                {idea.archived ? '📤' : '📥'}
                                            </button>
                                            <button onClick={() => handleDelete(idea.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}>✕</button>
                                        </div>
                                    </div>
                                    <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: cat.color + '20', color: cat.color }}>{cat.icon} {cat.label}</span>

                                    {editing === idea.id ? (
                                        <div style={{ marginTop: 10 }}>
                                            <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                                                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, minHeight: 80, resize: 'vertical' }} />
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                <button className="btn btn-primary" onClick={() => handleSaveEdit(idea.id)} style={{ fontSize: 10, padding: '3px 8px' }}>Save</button>
                                                <button className="btn btn-secondary" onClick={() => setEditing(null)} style={{ fontSize: 10, padding: '3px 8px' }}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div onClick={() => { setEditing(idea.id); setEditBody(idea.body || ''); }}
                                            style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', cursor: 'pointer', minHeight: 20 }}>
                                            {idea.body || <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Click to add details...</span>}
                                        </div>
                                    )}

                                    {/* Score slider */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Potential:</span>
                                        <input type="range" min={1} max={10} value={idea.score || 5}
                                            onChange={e => handleUpdateScore(idea.id, +e.target.value)}
                                            style={{ flex: 1, height: 4 }} />
                                        <span style={{
                                            fontSize: 12, fontWeight: 700, minWidth: 20, textAlign: 'center',
                                            color: (idea.score || 5) >= 8 ? '#34d399' : (idea.score || 5) >= 5 ? '#fbbf24' : '#f87171',
                                        }}>{idea.score || 5}</span>
                                    </div>

                                    {/* Tags */}
                                    {(idea.tags || []).length > 0 && (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                                            {idea.tags.map((t: string) => (
                                                <span key={t} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>{t}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
