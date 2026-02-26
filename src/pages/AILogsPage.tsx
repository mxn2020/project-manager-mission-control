import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState } from 'react';

export default function AILogsPage() {
    const logs = useQuery(api.aiLogs.listLogs, { limit: 100 });
    const stats = useQuery(api.aiLogs.getStats);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
    const [search, setSearch] = useState('');

    const models = [...new Set((logs || []).map((l: any) => l.model.split('/').pop()))].sort();

    const filtered = (logs || []).filter((l: any) => {
        if (filter !== 'all' && l.status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            const inModel = l.model.toLowerCase().includes(q);
            const inPrompt = l.promptMessages?.toLowerCase().includes(q);
            const inResponse = l.responseContent?.toLowerCase().includes(q);
            const inError = l.errorMessage?.toLowerCase().includes(q);
            if (!inModel && !inPrompt && !inResponse && !inError) return false;
        }
        return true;
    });

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📝 AI Logs</h1>
                <p className="page-description">Browse AI request history, token usage, and costs</p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div className="stat-card">
                        <div className="stat-value">{stats.totalCalls}</div>
                        <div className="stat-label">Total Calls</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.totalTokens.toLocaleString()}</div>
                        <div className="stat-label">Total Tokens</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">${(stats.totalCostCents / 100).toFixed(2)}</div>
                        <div className="stat-label">Total Cost</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.avgDurationMs}ms</div>
                        <div className="stat-label">Avg Duration</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: stats.errorCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {stats.errorCount}
                        </div>
                        <div className="stat-label">Errors</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(['all', 'success', 'error'] as const).map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {f === 'all' ? `All (${logs?.length || 0})` : `${f === 'error' ? '❌' : '✅'} ${f}`}
                    </button>
                ))}
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Search logs..."
                    style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'inherit', fontSize: 12, flex: 1, minWidth: 150,
                    }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{filtered.length} results</span>
            </div>

            {/* Logs Table */}
            <div className="logs-table" style={{ marginTop: 16 }}>
                {!logs ? (
                    <div className="loading"><div className="loading-spinner" /> Loading logs...</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📝</div>
                        <div className="empty-state-text">No AI logs yet — start chatting!</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Time</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Model</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Tokens</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Cost</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Duration</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Tools</th>
                                <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((log: any) => (
                                <>
                                    <tr
                                        key={log._id}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            background: expandedId === log._id ? 'var(--bg-secondary)' : 'transparent',
                                        }}
                                        onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                                    >
                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{formatTime(log.createdAt)}</td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{log.model.split('/').pop()}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.totalTokens ? log.totalTokens.toLocaleString() : '—'}
                                            {log.promptTokens && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}> ({log.promptTokens}↑ {log.completionTokens}↓)</span>}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.costCents ? `$${(log.costCents / 100).toFixed(4)}` : 'Free'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>{(log.durationMs / 1000).toFixed(1)}s</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.toolCalls ? '🔧 ' + JSON.parse(log.toolCalls).length : '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                background: log.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                                                color: log.status === 'success' ? '#34d399' : '#f87171',
                                            }}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedId === log._id && (
                                        <tr key={`${log._id}-detail`}>
                                            <td colSpan={7} style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: 400, overflow: 'auto' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Prompt</div>
                                                        <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: 'var(--bg-primary)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                                                            {(() => {
                                                                try {
                                                                    const msgs = JSON.parse(log.promptMessages);
                                                                    return msgs.map((m: any) => `[${m.role}] ${m.content}`).join('\n\n');
                                                                } catch { return log.promptMessages; }
                                                            })()}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Response</div>
                                                        <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: 'var(--bg-primary)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                                                            {log.responseContent}
                                                        </pre>
                                                    </div>
                                                </div>
                                                {log.errorMessage && (
                                                    <div style={{ marginTop: 8, padding: 8, background: 'rgba(248,113,113,0.1)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
                                                        ❌ {log.errorMessage}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
