import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect from '../components/SearchableSelect';

export default function AgentRunsPage() {
    const { user } = useAuth();
    const orgId = (user as any)?.orgId;

    const runs = useQuery(api.agents.listRuns, orgId ? { orgId } : "skip");
    const chatbots = useQuery(api.chatbots.listConfigs, orgId ? { orgId } : "skip");
    const startRun = useMutation(api.agents.startRun);
    const cancelRun = useMutation(api.agents.cancelRun);

    const [showNewRun, setShowNewRun] = useState(false);
    const [goal, setGoal] = useState('');
    const [chatbotId, setChatbotId] = useState('');
    const [starting, setStarting] = useState(false);

    const handleStartRun = async () => {
        if (!goal || !chatbotId || !orgId || !(user as any)?.id) return;
        setStarting(true);
        try {
            await startRun({
                orgId,
                userId: (user as any).id,
                chatbotConfigId: chatbotId as any,
                goal,
            });
            setGoal('');
            setChatbotId('');
            setShowNewRun(false);
        } finally {
            setStarting(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = '#6b7280';
        let bg = 'rgba(107, 114, 128, 0.12)';
        if (status === 'running') { color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.12)'; }
        if (status === 'completed') { color = '#10b981'; bg = 'rgba(16, 185, 129, 0.12)'; }
        if (status === 'failed' || status === 'cancelled') { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.12)'; }

        return (
            <span style={{ padding: '4px 8px', borderRadius: '4px', background: bg, color, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                {status}
            </span>
        );
    };

    const agentOptions = chatbots
        ? chatbots.filter((c: any) => c.isAgentic).map((c: any) => ({ value: c._id, label: c.name }))
        : [];

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">🕵️ Agent Workflows</h1>
                    <p className="page-description">Monitor and trigger background agentic tasks</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewRun(!showNewRun)}>+ New Agent Run</button>
            </div>

            {showNewRun && (
                <div className="section-card mb-20">
                    <h3 className="section-header" style={{ marginTop: 0 }}>Trigger New Agent Run</h3>
                    <div className="flex-col gap-12">
                        <div>
                            <label className="form-label">Agent Profile</label>
                            <SearchableSelect
                                options={agentOptions}
                                value={chatbotId}
                                onChange={setChatbotId}
                                placeholder="Select an Agent Profile"
                                clearable={false}
                            />
                        </div>
                        <div>
                            <label className="form-label">Goal / Objective</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                placeholder="Describe exactly what the agent should accomplish..."
                                value={goal}
                                onChange={e => setGoal(e.target.value)}
                            />
                        </div>
                        <div className="flex-row gap-8" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn btn-secondary" onClick={() => setShowNewRun(false)} disabled={starting}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleStartRun} disabled={starting || !goal || !chatbotId}>
                                {starting ? 'Loading...' : 'Start Execution 🚀'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!runs ? (
                <div className="loading"><div className="loading-spinner" /></div>
            ) : runs.length === 0 ? (
                <div className="section-card-sm text-center text-tertiary" style={{ padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🏃</div>
                    <p>No agent runs yet. Trigger a new one to see it here.</p>
                </div>
            ) : (
                <div className="grid gap-12">
                    {runs.map((run: any) => (
                        <div key={run._id} className="section-card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="flex-between">
                                <div className="font-semibold" style={{ fontSize: 16 }}>{run.goal.substring(0, 100)}{run.goal.length > 100 ? '...' : ''}</div>
                                <StatusBadge status={run.status} />
                            </div>
                            <div className="text-sm text-tertiary flex-between">
                                <span>Agent: {chatbots?.find((c: any) => c._id === run.chatbotConfigId)?.name || 'Unknown'}</span>
                                <span>Started: {new Date(run.startedAt).toLocaleString()}</span>
                            </div>

                            {/* Progress Bar implementation or Current Step */}
                            <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)' }}>
                                <div className="flex-between" style={{ marginBottom: 6, color: 'var(--text-secondary)' }}>
                                    <span>Current Step {run.currentStep || 0}</span>
                                    {run.status === 'running' || run.status === 'pending' ? (
                                        <button
                                            className="btn btn-secondary text-error"
                                            style={{ padding: '2px 8px', fontSize: 11 }}
                                            onClick={() => cancelRun({ runId: run._id })}
                                        >
                                            Cancel
                                        </button>
                                    ) : null}
                                </div>
                                <div style={{ color: run.status === 'failed' ? '#ef4444' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    {run.result || (run.status === 'running' ? 'Executing background steps...' : run.status === 'pending' ? 'Queued for execution...' : 'Cancelled')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
