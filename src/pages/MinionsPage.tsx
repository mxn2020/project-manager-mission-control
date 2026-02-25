import { useState, useEffect, useCallback } from 'react';

interface MinionItem {
    id: string;
    name: string;
    description: string;
    status: string;
    priority: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}

interface TypeInfo {
    slug: string;
    name: string;
    icon: string;
    count: number;
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

export default function MinionsPage() {
    const [types, setTypes] = useState<TypeInfo[]>([]);
    const [expandedType, setExpandedType] = useState<string | null>(null);
    const [items, setItems] = useState<Record<string, MinionItem[]>>({});
    const [selectedItem, setSelectedItem] = useState<MinionItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingType, setLoadingType] = useState<string | null>(null);

    // Load type summary
    useEffect(() => {
        fetch(`${API_BASE}/api/minions-types`)
            .then(r => r.json())
            .then(d => {
                setTypes(d.types || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Load items for a type
    const loadType = useCallback(async (slug: string) => {
        if (items[slug]) return; // Already loaded
        setLoadingType(slug);
        try {
            const res = await fetch(`${API_BASE}/api/minions/${slug}`);
            const data = await res.json();
            setItems(prev => ({ ...prev, [slug]: data.items || [] }));
        } catch { /* ignore */ }
        setLoadingType(null);
    }, [items]);

    const toggleType = (slug: string) => {
        if (expandedType === slug) {
            setExpandedType(null);
        } else {
            setExpandedType(slug);
            loadType(slug);
        }
    };

    const formatValue = (value: unknown, indent = 0): string => {
        const pad = '  '.repeat(indent);
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            if (value.includes('\n')) return `|\n${value.split('\n').map(l => `${pad}  ${l}`).join('\n')}`;
            if (value.includes(':') || value.includes('#') || value === '') return `"${value}"`;
            return value;
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (value.every(v => typeof v === 'string' || typeof v === 'number'))
                return `[${value.join(', ')}]`;
            return '\n' + value.map(v => `${pad}  - ${formatValue(v, indent + 1)}`).join('\n');
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>);
            return '\n' + entries.map(([k, v]) => `${pad}  ${k}: ${formatValue(v, indent + 1)}`).join('\n');
        }
        return String(value);
    };

    const renderYaml = (item: MinionItem) => {
        const lines: string[] = [];
        // Core fields first
        const coreKeys = ['id', 'name', 'description', 'status', 'priority', 'tags', 'createdAt', 'updatedAt'];
        for (const key of coreKeys) {
            if (item[key] !== undefined) {
                lines.push(`${key}: ${formatValue(item[key])}`);
            }
        }
        // Then remaining fields
        lines.push('');
        lines.push('# ─── Fields ───────────────────────────');
        for (const [key, value] of Object.entries(item)) {
            if (coreKeys.includes(key)) continue;
            lines.push(`${key}: ${formatValue(value)}`);
        }
        return lines.join('\n');
    };

    if (loading) {
        return <div className="loading"><div className="loading-spinner" /> Loading Minions...</div>;
    }

    return (
        <div className="minions-workspace">
            <div className="minions-tree">
                <div className="minions-tree-header">
                    <span className="minions-tree-title">📦 .minions</span>
                    <span className="minions-tree-badge">{types.reduce((s, t) => s + t.count, 0)} items</span>
                </div>
                <div className="minions-tree-list">
                    {types.map(type => (
                        <div key={type.slug} className="minions-type-group">
                            <div
                                className={`minions-type-folder ${expandedType === type.slug ? 'expanded' : ''}`}
                                onClick={() => toggleType(type.slug)}
                            >
                                <span className="minions-folder-icon">
                                    {expandedType === type.slug ? '📂' : '📁'}
                                </span>
                                <span className="minions-folder-name">{type.name}</span>
                                <span className="minions-folder-count">{type.count}</span>
                            </div>
                            {expandedType === type.slug && (
                                <div className="minions-type-items">
                                    {loadingType === type.slug ? (
                                        <div className="minions-loading-items">Loading...</div>
                                    ) : (items[type.slug] || []).length === 0 ? (
                                        <div className="minions-empty-items">No items</div>
                                    ) : (
                                        (items[type.slug] || []).map(item => (
                                            <div
                                                key={item.id}
                                                className={`minions-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedItem(item)}
                                            >
                                                <span className="minions-item-icon">{type.icon}</span>
                                                <span className="minions-item-name">{item.name || item.id.slice(0, 8)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {types.length === 0 && (
                        <div className="minions-empty">
                            <p>No minions data found.</p>
                            <p style={{ fontSize: 11, marginTop: 8 }}>Run the migration script first.</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="minions-detail">
                {selectedItem ? (
                    <>
                        <div className="minions-detail-header">
                            <h2 className="minions-detail-title">{selectedItem.name || 'Untitled'}</h2>
                            <div className="minions-detail-meta">
                                <span className="minions-meta-badge">{selectedItem.status}</span>
                                <span className="minions-meta-badge">{selectedItem.priority}</span>
                                <span className="minions-meta-id">{selectedItem.id}</span>
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
