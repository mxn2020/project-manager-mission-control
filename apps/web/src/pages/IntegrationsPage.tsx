import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';
import { getErrorMessage } from '../lib/types';
import toast from 'react-hot-toast';

interface IntegrationCard {
    id: string;
    name: string;
    icon: string;
    description: string;
    status: 'connected' | 'disconnected' | 'coming_soon';
    username?: string | null;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export default function IntegrationsPage() {
    const { orgId, token: sessionToken } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;
    const githubConnection = useQuery(api.github.getGithubConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const revokeGithub = useMutation(api.github.revokeGithubToken);

    // ── Vercel ────────────────────────────────────────────────────────
    const vercelConnection = useQuery(api.vercel.getVercelConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const revokeVercel = useMutation(api.vercel.revokeVercelToken);
    const saveVercelToken = useMutation(api.vercel.saveVercelToken);

    // Vercel token dialog state
    const [showVercelDialog, setShowVercelDialog] = useState(false);
    const [vercelToken, setVercelToken] = useState('');
    const [vercelTeamId, setVercelTeamId] = useState('');
    const [vercelSaving, setVercelSaving] = useState(false);

    // Check for OAuth callback redirect (GitHub only now)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('github') === 'connected') {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const connectGithub = () => {
        if (!sessionToken) return;
        const convexUrl = import.meta.env.VITE_CONVEX_URL?.replace('.cloud', '.site') || '';
        const authorizeUrl = `${convexUrl}/github/authorize?session=${encodeURIComponent(sessionToken)}`;
        window.location.href = authorizeUrl;
    };

    const disconnectGithub = async () => {
        if (!typedOrgId) return;
        await revokeGithub({ orgId: typedOrgId });
    };

    // ── Vercel handlers ───────────────────────────────────────────────
    const connectVercel = () => {
        setShowVercelDialog(true);
    };

    const saveVercel = async () => {
        if (!typedOrgId || !vercelToken.trim()) return;
        setVercelSaving(true);
        try {
            await saveVercelToken({
                orgId: typedOrgId,
                vercelToken: vercelToken.trim(),
                vercelTeamId: vercelTeamId.trim() || undefined,
            });
            toast.success('Vercel connected! ▲');
            setShowVercelDialog(false);
            setVercelToken('');
            setVercelTeamId('');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setVercelSaving(false);
        }
    };

    const disconnectVercel = async () => {
        if (!typedOrgId) return;
        try {
            await revokeVercel({ orgId: typedOrgId });
            toast.success('Vercel disconnected');
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const integrations: IntegrationCard[] = [
        {
            id: 'github',
            name: 'GitHub',
            icon: '🐙',
            description: 'Connect your GitHub account to browse repositories, sync project files, and manage code.',
            status: githubConnection?.connected ? 'connected' : 'disconnected',
            username: githubConnection?.username,
            onConnect: connectGithub,
            onDisconnect: disconnectGithub,
        },
        {
            id: 'vercel',
            name: 'Vercel',
            icon: '▲',
            description: 'Deploy and manage your frontend projects with Vercel. Create, deploy, and view deployment logs.',
            status: vercelConnection?.connected ? 'connected' : 'disconnected',
            username: vercelConnection?.teamId ? `team: ${vercelConnection.teamId}` : null,
            onConnect: connectVercel,
            onDisconnect: disconnectVercel,
        },
        {
            id: 'slack',
            name: 'Slack',
            icon: '💬',
            description: 'Get notifications and interact with Mission Control from Slack channels.',
            status: 'coming_soon',
        },
        {
            id: 'linear',
            name: 'Linear',
            icon: '📐',
            description: 'Sync issues and projects between Mission Control and Linear.',
            status: 'coming_soon',
        },
        {
            id: 'notion',
            name: 'Notion',
            icon: '📝',
            description: 'Import and sync documentation from your Notion workspace.',
            status: 'coming_soon',
        },
        {
            id: 'openai',
            name: 'OpenAI',
            icon: '🤖',
            description: 'Configure AI capabilities with your own OpenAI API key.',
            status: 'coming_soon',
        },
    ];

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">🔗 Integrations</h1>
                        <p className="page-description">Connect tools and services to supercharge your workflow</p>
                    </div>
                </div>
            </div>

            {/* Integration Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 16,
                padding: '0 0 24px',
            }}>
                {integrations.map(integration => (
                    <div
                        key={integration.id}
                        className="section-card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            opacity: integration.status === 'coming_soon' ? 0.6 : 1,
                        }}
                    >
                        {/* Status indicator */}
                        <div style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}>
                            {integration.status === 'connected' && (
                                <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    color: '#22c55e',
                                    fontWeight: 600,
                                }}>
                                    <span style={{
                                        width: 8, height: 8,
                                        borderRadius: '50%',
                                        background: '#22c55e',
                                        display: 'inline-block',
                                        boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                                    }} />
                                    Connected
                                </span>
                            )}
                            {integration.status === 'disconnected' && (
                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    Not connected
                                </span>
                            )}
                            {integration.status === 'coming_soon' && (
                                <span style={{
                                    fontSize: 11,
                                    color: 'var(--text-tertiary)',
                                    background: 'var(--bg-tertiary)',
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    fontWeight: 500,
                                }}>
                                    Coming Soon
                                </span>
                            )}
                        </div>

                        {/* Icon + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <span style={{ fontSize: 28 }}>{integration.icon}</span>
                            <div>
                                <div className="font-semibold text-md">{integration.name}</div>
                                {integration.username && (
                                    <div className="text-sm text-tertiary">@{integration.username}</div>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-tertiary" style={{ margin: '8px 0 16px', lineHeight: 1.5 }}>
                            {integration.description}
                        </p>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {integration.status === 'connected' && (
                                <>
                                    <button
                                        className="btn btn-secondary text-sm"
                                        onClick={integration.onDisconnect}
                                        style={{ flex: 1 }}
                                    >
                                        Disconnect
                                    </button>
                                    <button
                                        className="btn btn-primary text-sm"
                                        onClick={integration.onConnect}
                                        style={{ flex: 1 }}
                                    >
                                        Reconnect
                                    </button>
                                </>
                            )}
                            {integration.status === 'disconnected' && (
                                <button
                                    className="btn btn-primary text-sm"
                                    onClick={integration.onConnect}
                                    style={{ flex: 1 }}
                                >
                                    Connect {integration.name}
                                </button>
                            )}
                            {integration.status === 'coming_soon' && (
                                <button
                                    className="btn btn-secondary text-sm"
                                    disabled
                                    style={{ flex: 1, cursor: 'not-allowed' }}
                                >
                                    Coming Soon
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Vercel Token Dialog ────────────────────────────────── */}
            {showVercelDialog && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowVercelDialog(false); }}>
                    <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">▲ Connect Vercel</h2>
                            <button onClick={() => setShowVercelDialog(false)} className="icon-btn text-tertiary text-2xl">✕</button>
                        </div>

                        <div className="modal-body flex-col gap-16">
                            <p className="text-sm text-tertiary" style={{ lineHeight: 1.5 }}>
                                Enter your Vercel access token. Create one at{' '}
                                <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer"
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                    vercel.com/account/tokens
                                </a>
                                {' '}with full access scope.
                            </p>

                            <div>
                                <label className="form-label">Access Token *</label>
                                <input
                                    type="password"
                                    value={vercelToken}
                                    onChange={e => setVercelToken(e.target.value)}
                                    placeholder="vcp_xxxxxxxxxxxxxxxx"
                                    className="form-input"
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>

                            <div>
                                <label className="form-label">Team ID <span className="text-tertiary">(optional)</span></label>
                                <input
                                    type="text"
                                    value={vercelTeamId}
                                    onChange={e => setVercelTeamId(e.target.value)}
                                    placeholder="team_xxxxxxxxxxxxxxxx"
                                    className="form-input"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                <p className="text-xs text-tertiary" style={{ marginTop: 4 }}>
                                    Leave empty for personal account. Find your team ID in Vercel settings.
                                </p>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowVercelDialog(false)} disabled={vercelSaving}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveVercel}
                                disabled={!vercelToken.trim() || vercelSaving}
                            >
                                {vercelSaving ? '⏳ Saving...' : '▲ Connect Vercel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
