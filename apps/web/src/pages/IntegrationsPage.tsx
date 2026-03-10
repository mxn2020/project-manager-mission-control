import { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';

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

    // Check for OAuth callback redirect
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
            description: 'Deploy and manage your frontend projects with Vercel integration.',
            status: 'coming_soon',
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
        </div>
    );
}
