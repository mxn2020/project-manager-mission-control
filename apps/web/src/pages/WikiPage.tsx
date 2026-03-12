import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';
import SearchableSelect from '../components/SearchableSelect';
import { FormInput, FormTextarea } from '../components/ui';

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
    const { orgId } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;

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

    // Convex queries and mutations
    const rawArticles = useQuery(api.wiki.list, typedOrgId ? {
        orgId: typedOrgId,
        category: filterCat || undefined,
        scope: filterScope || undefined,
    } : "skip");

    const createArticle = useMutation(api.wiki.create);
    const updateArticle = useMutation(api.wiki.update);
    const deleteArticle = useMutation(api.wiki.remove);

    const articles = rawArticles ? rawArticles.map(a => ({ ...a, id: a._id })) : null;
    const all = articles || [];

    // Filter articles by search text
    const filteredArticles = all.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q)
            || (a.body || '').toLowerCase().includes(q)
            || (a.tags || []).some((t: string) => t.toLowerCase().includes(q));
    });

    const selectedArticle = selected ? all.find(a => a.id === selected) : null;

    // Category counts
    const catCounts: Record<string, number> = {};
    for (const a of all) catCounts[a.category] = (catCounts[a.category] || 0) + 1;

    const handleCreate = async () => {
        if (!newTitle.trim() || !typedOrgId) return;
        const articleId = await createArticle({
            orgId: typedOrgId,
            title: newTitle.trim(),
            body: newBody,
            category: newCat,
            scope: newScope,
            tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        });
        setShowCreate(false); setNewTitle(''); setNewBody(''); setNewTags('');
        setSelected(articleId as string);
    };

    const handleSaveBody = async () => {
        if (!selected) return;
        await updateArticle({ articleId: selected as Id<"wikiArticles">, body: editBody });
        setEditMode(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this article?')) {
            await deleteArticle({ articleId: id as Id<"wikiArticles"> });
            if (selected === id) setSelected(null);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">📖 Wiki & Standards</h1>
                        <p className="page-description">Patterns, standards, setup guides, and knowledge base</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Article</button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="section-card mb-16">
                    <FormInput value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Article title *"
                        className="mb-12" />
                    <FormTextarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Markdown content..."
                        className="mb-12 font-mono" style={{ minHeight: 120 }} />
                    <div className="flex-row flex-wrap gap-12">
                        <SearchableSelect
                            options={CATEGORIES.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))}
                            value={newCat} onChange={setNewCat} placeholder="Category" clearable={false} width="160px" />
                        <SearchableSelect
                            options={SCOPES.map(s => ({ value: s.value, label: s.label }))}
                            value={newScope} onChange={setNewScope} placeholder="Scope" clearable={false} width="140px" />
                        <FormInput value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma-separated)"
                            inputSize="sm" className="flex-1" style={{ minWidth: 120 }} />
                        <button className="btn btn-secondary text-base" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary text-base" onClick={handleCreate} disabled={!newTitle.trim()}>Create</button>
                    </div>
                </div>
            )}

            {/* Main Layout: sidebar + content */}
            <div className="gap-16 mt-8" style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>
                {/* Sidebar */}
                <div>
                    <FormInput value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..."
                        inputSize="sm" className="mb-12" style={{ width: '100%', background: 'var(--bg-secondary)' }} />

                    {/* Scope filter */}
                    <div className="flex-row flex-wrap gap-4 mb-12">
                        <button className={`btn ${!filterScope ? 'btn-primary' : 'btn-secondary'} text-xs`} onClick={() => setFilterScope('')} style={{ padding: '3px 8px' }}>All</button>
                        {SCOPES.map(s => (
                            <button key={s.value} className={`btn ${filterScope === s.value ? 'btn-primary' : 'btn-secondary'} text-xs`}
                                onClick={() => setFilterScope(filterScope === s.value ? '' : s.value)}
                                style={{ padding: '3px 8px' }}>{s.label}</button>
                        ))}
                    </div>

                    {/* Category tree */}
                    <div className="section-label mb-6">Categories</div>
                    <button onClick={() => setFilterCat('')}
                        className="sidebar-item" style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                            background: !filterCat ? 'var(--accent-bg)' : 'transparent', border: 'none', color: 'inherit',
                            cursor: 'pointer', fontSize: 12, marginBottom: 2,
                        }}>All ({filteredArticles.length})</button>
                    {CATEGORIES.map(c => {
                        const count = catCounts[c.value] || 0;
                        return (
                            <button key={c.value} onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                                    background: filterCat === c.value ? 'var(--accent-bg)' : 'transparent', border: 'none', color: 'inherit',
                                    cursor: 'pointer', fontSize: 12, marginBottom: 2, opacity: count > 0 ? 1 : 0.4,
                                }}>
                                {c.icon} {c.label} <span className="text-tertiary" style={{ float: 'right' }}>{count}</span>
                            </button>
                        );
                    })}

                    {/* Article list */}
                    <div className="section-label mt-16 mb-6">Articles</div>
                    {articles === null ? (
                        <div className="text-sm text-tertiary">Loading...</div>
                    ) : filteredArticles.length === 0 ? (
                        <div className="text-sm text-tertiary">{search ? 'No matches' : 'No articles'}</div>
                    ) : (
                        filteredArticles.map(a => (
                            <div key={a.id} onClick={() => { setSelected(a.id); setEditMode(false); }}
                                style={{
                                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                                    background: selected === a.id ? 'var(--accent-bg)' : 'transparent',
                                    border: selected === a.id ? '1px solid var(--accent)' : '1px solid transparent',
                                }}>
                                <div className="font-medium text-base">{a.title}</div>
                                <div className="flex-row gap-4 mt-4">
                                    <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: (SCOPE_MAP[a.scope]?.color || '#6b7280') + '20', color: SCOPE_MAP[a.scope]?.color || '#6b7280' }}>
                                        {a.scope}
                                    </span>
                                    <span className="text-tertiary" style={{ fontSize: 9 }}>{CAT_MAP[a.category]?.icon}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Content Area */}
                <div className="section-card" style={{ minHeight: 400 }}>
                    {!selectedArticle ? (
                        <div className="flex-center text-tertiary text-lg" style={{ height: 300 }}>
                            ← Select an article or create a new one
                        </div>
                    ) : (
                        <>
                            <div className="flex-between mb-16">
                                <div>
                                    <h2 className="text-3xl font-bold" style={{ margin: 0 }}>{selectedArticle.title}</h2>
                                    <div className="flex-row gap-6 mt-8">
                                        <span className="text-xs" style={{ padding: '2px 8px', borderRadius: 4, background: (SCOPE_MAP[selectedArticle.scope]?.color || '#6b7280') + '20', color: SCOPE_MAP[selectedArticle.scope]?.color }}>
                                            {selectedArticle.scope}
                                        </span>
                                        <span className="tag">{CAT_MAP[selectedArticle.category]?.icon} {CAT_MAP[selectedArticle.category]?.label}</span>
                                        <span className="text-xs text-tertiary" style={{ lineHeight: '20px' }}>
                                            Updated {new Date(selectedArticle.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-row gap-6">
                                    <button className="btn btn-secondary text-sm" onClick={() => { setEditMode(!editMode); setEditBody(selectedArticle.body || ''); }}>
                                        {editMode ? 'Preview' : '✏️ Edit'}
                                    </button>
                                    <button onClick={() => handleDelete(selectedArticle.id)}
                                        className="icon-btn" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', padding: '4px 10px', borderRadius: 6 }}>🗑️</button>
                                </div>
                            </div>

                            {/* Tags */}
                            {(selectedArticle.tags || []).length > 0 && (
                                <div className="flex-row flex-wrap gap-4 mb-16">
                                    {selectedArticle.tags.map((t: string) => (
                                        <span key={t} className="tag">#{t}</span>
                                    ))}
                                </div>
                            )}

                            {editMode ? (
                                <div>
                                    <FormTextarea value={editBody} onChange={e => setEditBody(e.target.value)}
                                        className="font-mono" style={{ minHeight: 300 }} />
                                    <div className="flex-row gap-8 mt-8" style={{ justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary text-base" onClick={() => setEditMode(false)}>Cancel</button>
                                        <button className="btn btn-primary text-base" onClick={handleSaveBody}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-lg text-muted whitespace-pre" style={{ lineHeight: 1.7 }}>
                                    {selectedArticle.body || <span className="text-tertiary" style={{ fontStyle: 'italic' }}>No content yet — click Edit to start writing.</span>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
