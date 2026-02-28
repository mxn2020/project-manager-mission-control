import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const CATEGORIES = [
    { value: 'standard', label: 'Standards', icon: '📏' },
    { value: 'pattern', label: 'Patterns', icon: '🧩' },
    { value: 'knowhow', label: 'Know-How', icon: '🧠' },
    { value: 'setup-guide', label: 'Setup Guides', icon: '🛠️' },
    { value: 'coding-pattern', label: 'Coding Patterns', icon: '💻' },
    { value: 'reference', label: 'Reference', icon: '📚' },
    { value: 'checklist', label: 'Checklists', icon: '✅' },
];

const SCOPES = [
    { value: 'general', label: 'General', color: '#6b7280' },
    { value: 'frontend', label: 'Frontend', color: '#60a5fa' },
    { value: 'backend', label: 'Backend', color: '#34d399' },
    { value: 'devops', label: 'DevOps', color: '#fbbf24' },
    { value: 'design', label: 'Design', color: '#f472b6' },
];

const SCOPE_MAP = Object.fromEntries(SCOPES.map(s => [s.value, s]));
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

export default function WikiPage() {
    const [articles, setArticles] = useState<any[] | null>(null);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterScope, setFilterScope] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editBody, setEditBody] = useState('');

    // Create form
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newCat, setNewCat] = useState('reference');
    const [newScope, setNewScope] = useState('general');
    const [newTags, setNewTags] = useState('');

    const load = useCallback(async () => {
        try {
            setArticles(await api.wiki.list({
                category: filterCat || undefined,
                scope: filterScope || undefined,
                search: search || undefined,
            }));
        } catch { setArticles([]); }
    }, [filterCat, filterScope, search]);

    useEffect(() => { load(); }, [load]);

    const all = articles || [];
    const selectedArticle = selected ? all.find(a => a.id === selected) : null;

    // Category counts
    const catCounts: Record<string, number> = {};
    for (const a of all) catCounts[a.category] = (catCounts[a.category] || 0) + 1;

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        const article = await api.wiki.create({
            title: newTitle.trim(), body: newBody,
            category: newCat, scope: newScope,
            tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        });
        setShowCreate(false); setNewTitle(''); setNewBody(''); setNewTags('');
        setSelected(article.id);
        await load();
    };

    const handleSaveBody = async () => {
        if (!selected) return;
        await api.wiki.update(selected, { body: editBody });
        setEditMode(false);
        await load();
    };

    const handleDelete = async (id: string) => {
        await api.wiki.delete(id);
        if (selected === id) setSelected(null);
        await load();
    };

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">📖 Wiki & Standards</h1>
                        <p className="page-description">Patterns, standards, setup guides, and knowledge base</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Article</button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Article title *"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, marginBottom: 12 }} />
                    <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Markdown content..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, fontFamily: 'monospace', minHeight: 120, resize: 'vertical', marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={newCat} onChange={e => setNewCat(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12 }}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                        </select>
                        <select value={newScope} onChange={e => setNewScope(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12 }}>
                            {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)"
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, minWidth: 120 }} />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: 12 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newTitle.trim()} style={{ fontSize: 12 }}>Create</button>
                    </div>
                </div>
            )}

            {/* Main Layout: sidebar + content */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, marginTop: 8 }}>
                {/* Sidebar */}
                <div>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12, marginBottom: 12 }} />

                    {/* Scope filter */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                        <button className={`btn ${!filterScope ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterScope('')} style={{ fontSize: 10, padding: '3px 8px' }}>All</button>
                        {SCOPES.map(s => (
                            <button key={s.value} className={`btn ${filterScope === s.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterScope(filterScope === s.value ? '' : s.value)}
                                style={{ fontSize: 10, padding: '3px 8px' }}>{s.label}</button>
                        ))}
                    </div>

                    {/* Category tree */}
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Categories</div>
                    <button onClick={() => setFilterCat('')}
                        style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                            background: !filterCat ? 'var(--accent-bg)' : 'transparent', border: 'none', color: 'inherit',
                            cursor: 'pointer', fontSize: 12, marginBottom: 2,
                        }}>All ({all.length})</button>
                    {CATEGORIES.map(c => {
                        const count = catCounts[c.value] || 0;
                        return (
                            <button key={c.value} onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                                    background: filterCat === c.value ? 'var(--accent-bg)' : 'transparent', border: 'none', color: 'inherit',
                                    cursor: 'pointer', fontSize: 12, marginBottom: 2, opacity: count > 0 ? 1 : 0.4,
                                }}>
                                {c.icon} {c.label} <span style={{ float: 'right', color: 'var(--text-tertiary)' }}>{count}</span>
                            </button>
                        );
                    })}

                    {/* Article list */}
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>Articles</div>
                    {articles === null ? (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Loading...</div>
                    ) : all.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No articles</div>
                    ) : (
                        all.map(a => (
                            <div key={a.id} onClick={() => { setSelected(a.id); setEditMode(false); }}
                                style={{
                                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                                    background: selected === a.id ? 'var(--accent-bg)' : 'transparent',
                                    border: selected === a.id ? '1px solid var(--accent)' : '1px solid transparent',
                                }}>
                                <div style={{ fontWeight: 500, fontSize: 12 }}>{a.title}</div>
                                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                    <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: (SCOPE_MAP[a.scope]?.color || '#6b7280') + '20', color: SCOPE_MAP[a.scope]?.color || '#6b7280' }}>
                                        {a.scope}
                                    </span>
                                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{CAT_MAP[a.category]?.icon}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Content Area */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', minHeight: 400 }}>
                    {!selectedArticle ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: 'var(--text-tertiary)', fontSize: 14 }}>
                            ← Select an article or create a new one
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 20 }}>{selectedArticle.title}</h2>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: (SCOPE_MAP[selectedArticle.scope]?.color || '#6b7280') + '20', color: SCOPE_MAP[selectedArticle.scope]?.color }}>
                                            {selectedArticle.scope}
                                        </span>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                            {CAT_MAP[selectedArticle.category]?.icon} {CAT_MAP[selectedArticle.category]?.label}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: '20px' }}>
                                            Updated {new Date(selectedArticle.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-secondary" onClick={() => { setEditMode(!editMode); setEditBody(selectedArticle.body || ''); }}
                                        style={{ fontSize: 11 }}>{editMode ? 'Preview' : '✏️ Edit'}</button>
                                    <button onClick={() => handleDelete(selectedArticle.id)}
                                        style={{ background: 'rgba(248,113,113,0.1)', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                                </div>
                            </div>

                            {/* Tags */}
                            {(selectedArticle.tags || []).length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                                    {selectedArticle.tags.map((t: string) => (
                                        <span key={t} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>#{t}</span>
                                    ))}
                                </div>
                            )}

                            {editMode ? (
                                <div>
                                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)',
                                            background: 'var(--bg-primary)', color: 'inherit', fontSize: 13, fontFamily: 'monospace',
                                            minHeight: 300, resize: 'vertical',
                                        }} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary" onClick={() => setEditMode(false)} style={{ fontSize: 12 }}>Cancel</button>
                                        <button className="btn btn-primary" onClick={handleSaveBody} style={{ fontSize: 12 }}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {selectedArticle.body || <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No content yet — click Edit to start writing.</span>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
