import { useState, useEffect, useCallback } from 'react';
import { useMinionsSDK, type MinionRecord } from '../hooks/useMinionsSDK';
import type { MinionType } from 'minions-sdk';

// Use MinionRecord since that's what the SDK hook returns
type Minion = MinionRecord;

export default function MinionsPage() {
    const { client, list, create, remove, search, registry } = useMinionsSDK();

    const [minions, setMinions] = useState<Minion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<Minion | null>(null);
    const [expandedType, setExpandedType] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createSlug, setCreateSlug] = useState('');
    const [createTitle, setCreateTitle] = useState('');
    const [creating, setCreating] = useState(false);

    // Load minions from Convex via SDK
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const data = searchQuery.trim()
                ? await search(searchQuery)
                : await list();
            setMinions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('Minions SDK not connected:', err);
            setMinions([]);
        } finally {
            setLoading(false);
        }
    }, [list, search, searchQuery]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Group minions by minionTypeId
    let allTypes: MinionRecord[] = [];
    try { allTypes = registry.list() || []; } catch { allTypes = []; }
    const grouped: Record<string, Minion[]> = {};
    for (const m of minions) {
        const key = m.minionTypeId || '_unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    }

    const typeSlugToInfo = (slug: string): { name: string; icon: string } => {
        const t = allTypes.find(t => t.slug === slug);
        return { name: t?.name ?? slug, icon: t?.icon ?? '📦' };
    };

    const toggleType = (slug: string) => {
        setExpandedType(expandedType === slug ? null : slug);
    };

    const handleCreate = async () => {
        if (!createSlug || !createTitle.trim()) return;
        setCreating(true);
        try {
            const newMinion = await create(createSlug, { title: createTitle.trim() });
            setCreateTitle('');
            setShowCreate(false);
            await refresh();
            setSelectedItem(newMinion);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (m: Minion) => {
        await remove(m);
        if (selectedItem?.id === m.id) setSelectedItem(null);
        await refresh();
    };

    // ─── Render helpers ──────────────────────────────────────────────────

    const formatValue = (value: unknown, indent = 0): string => {
        const pad = '  '.repeat(indent);
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            if (value.includes('\n'))
                return `|\n${value.split('\n').map((l) => `${pad}  ${l}`).join('\n')}`;
            if (value.includes(':') || value.includes('#') || value === '')
                return `"${value}"`;
            return value;
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (value.every((v) => typeof v === 'string' || typeof v === 'number'))
                return `[${value.join(', ')}]`;
            return '\n' + value.map((v) => `${pad}  - ${formatValue(v, indent + 1)}`).join('\n');
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>);
            return '\n' + entries.map(([k, v]) => `${pad}  ${k}: ${formatValue(v, indent + 1)}`).join('\n');
        }
        return String(value);
    };

    const renderYaml = (item: Minion) => {
        const lines: string[] = [];
        const coreKeys = ['id', 'title', 'status', 'priority', 'tags', 'minionTypeId', 'createdAt', 'updatedAt'];
        for (const key of coreKeys) {
            if ((item as Record<string, unknown>)[key] !== undefined) {
                lines.push(`${key}: ${formatValue((item as Record<string, unknown>)[key])}`);
            }
        }
        if (item.fields && Object.keys(item.fields).length > 0) {
            lines.push('');
            lines.push('# ─── Fields ───────────────────────────');
            for (const [key, value] of Object.entries(item.fields)) {
                lines.push(`${key}: ${formatValue(value)}`);
            }
        }
        return lines.join('\n');
    };

    // ─── UI ──────────────────────────────────────────────────────────────

    const typeEntries = Object.keys(grouped).sort();

    return (
        <div className="minions-workspace">
            <div className="minions-tree">
                <div className="minions-tree-header">
                    <span className="minions-tree-title">📦 Minions</span>
                    <span className="minions-tree-badge">{minions.length} items</span>
                </div>

                {/* Search bar */}
                <div style={{ padding: '8px 12px' }}>
                    <input
                        className="form-input"
                        placeholder="Search minions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ fontSize: 12 }}
                    />
                </div>

                {/* New minion */}
                <div style={{ padding: '0 12px 8px' }}>
                    <button className="btn btn-primary text-base" style={{ width: '100%' }} onClick={() => setShowCreate(!showCreate)}>
                        + New Minion
                    </button>
                </div>
                {showCreate && (
                    <div style={{ padding: '0 12px 12px' }}>
                        <select
                            className="form-input mb-8"
                            style={{ fontSize: 12 }}
                            value={createSlug}
                            onChange={(e) => setCreateSlug(e.target.value)}
                        >
                            <option value="">Select type...</option>
                            {allTypes.map((t) => (
                                <option key={t.slug} value={t.slug}>
                                    {t.icon} {t.name}
                                </option>
                            ))}
                        </select>
                        <input
                            className="form-input mb-8"
                            style={{ fontSize: 12 }}
                            placeholder="Title..."
                            value={createTitle}
                            onChange={(e) => setCreateTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button className="btn btn-primary text-base" style={{ width: '100%' }} onClick={handleCreate} disabled={creating}>
                            {creating ? '...' : 'Create'}
                        </button>
                    </div>
                )}

                {/* Tree list */}
                <div className="minions-tree-list">
                    {loading ? (
                        <div className="loading" style={{ padding: 24 }}><div className="loading-spinner" /></div>
                    ) : typeEntries.length === 0 ? (
                        <div className="minions-empty" style={{ padding: 16 }}>
                            <div style={{ fontSize: 36, marginBottom: 8, textAlign: 'center' }}>📦</div>
                            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                No minions yet. Create one to get started.
                            </p>
                        </div>
                    ) : (
                        typeEntries.map((slug) => {
                            const info = typeSlugToInfo(slug);
                            const items = grouped[slug];
                            return (
                                <div key={slug} className="minions-type-group">
                                    <div
                                        className={`minions-type-folder ${expandedType === slug ? 'expanded' : ''}`}
                                        onClick={() => toggleType(slug)}
                                    >
                                        <span className="minions-folder-icon">
                                            {expandedType === slug ? '📂' : '📁'}
                                        </span>
                                        <span className="minions-folder-name">{info.name}</span>
                                        <span className="minions-folder-count">{items.length}</span>
                                    </div>
                                    {expandedType === slug && (
                                        <div className="minions-type-items">
                                            {items.length === 0 ? (
                                                <div className="minions-empty-items">No items</div>
                                            ) : (
                                                items.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className={`minions-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                                                        onClick={() => setSelectedItem(item)}
                                                    >
                                                        <span className="minions-item-icon">{info.icon}</span>
                                                        <span className="minions-item-name">
                                                            {item.title || item.id.slice(0, 8)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Detail pane */}
            <div className="minions-detail">
                {selectedItem ? (
                    <>
                        <div className="minions-detail-header">
                            <h2 className="minions-detail-title">{selectedItem.title || 'Untitled'}</h2>
                            <div className="minions-detail-meta">
                                <span className="minions-meta-badge">{selectedItem.status}</span>
                                {selectedItem.priority && (
                                    <span className="minions-meta-badge">{selectedItem.priority}</span>
                                )}
                                <span className="minions-meta-id">{selectedItem.id}</span>
                                <button
                                    className="btn btn-secondary text-sm text-error"
                                    style={{ marginLeft: 'auto', padding: '2px 10px' }}
                                    onClick={() => handleDelete(selectedItem)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        <pre className="minions-yaml-view">{renderYaml(selectedItem)}</pre>
                    </>
                ) : (
                    <div className="minions-detail-empty">
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                        <h3>Select a minion</h3>
                        <p>Browse the tree on the left and click an item to view its data.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
