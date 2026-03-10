import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState } from 'react';
import { PageHeader } from '../components/ui';

export default function AILogsPage() {
    const logs = useQuery(api.aiLogs.listLogs, { limit: 100 });
    const stats = useQuery(api.aiLogs.getStats);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
    const [search, setSearch] = useState('');

    const models = [...new Set((logs || []).map(l => l.model.split('/').pop()))].sort();

    const filtered = (logs || []).filter(l => {
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
            <PageHeader title="📝 AI Logs" description="Browse AI request history, token usage, and costs" />

            {/* Stats Cards */}
            {stats && (
                <div className="grid-auto gap-12 mb-20">
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
            <div className="filter-bar flex-row flex-wrap gap-8">
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
                    className="form-input-sm flex-1" style={{ minWidth: 150, background: 'var(--bg-secondary)' }}
                />
                <span className="text-sm text-tertiary">{filtered.length} results</span>
            </div>

            {/* Logs Table */}
            <div className="mt-16">
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
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Time</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Model</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Tokens</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Cost</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Duration</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Tools</th>
                                <th className="text-muted" style={{ padding: '8px 12px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(log => (
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
                                        <td className="font-mono text-sm" style={{ padding: '8px 12px' }}>{log.model.split('/').pop()}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.totalTokens ? log.totalTokens.toLocaleString() : '—'}
                                            {log.promptTokens && <span className="text-tertiary text-xs"> ({log.promptTokens}↑ {log.completionTokens}↓)</span>}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.costCents ? `$${(log.costCents / 100).toFixed(4)}` : 'Free'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>{(log.durationMs / 1000).toFixed(1)}s</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            {log.toolCalls ? '🔧 ' + JSON.parse(log.toolCalls).length : '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span className="tag" style={{
                                                background: log.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                                                color: log.status === 'success' ? '#34d399' : '#f87171',
                                                border: 'none',
                                            }}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedId === log._id && (
                                        <tr key={`${log._id}-detail`}>
                                            <td colSpan={7} style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                                                <div className="grid-2 gap-12" style={{ maxHeight: 400, overflow: 'auto' }}>
                                                    <div>
                                                        <div className="section-label mb-4">Prompt</div>
                                                        <pre className="text-sm whitespace-pre" style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                                                            {(() => {
                                                                try {
                                                                    const msgs = JSON.parse(log.promptMessages);
                                                                    return msgs.map((m: { role: string; content: string }) => `[${m.role}] ${m.content}`).join('\n\n');
                                                                } catch { return log.promptMessages; }
                                                            })()}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <div className="section-label mb-4">Response</div>
                                                        <pre className="text-sm whitespace-pre" style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                                                            {log.responseContent}
                                                        </pre>
                                                    </div>
                                                </div>
                                                {log.errorMessage && (
                                                    <div className="error-box mt-8">
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
