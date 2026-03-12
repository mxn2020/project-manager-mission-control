import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import SearchableSelect from './SearchableSelect';
import type { Id } from '../lib/types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface AIProfile {
    id: string;
    label: string;
    icon: string;
    systemPrompt: string;
}

export interface AIChatPanelProps {
    /** Page context label (shown in header) */
    pageContext: string;
    /** AI profile presets for this page */
    profiles: AIProfile[];
    /** Optional initial system prompt override */
    defaultProfile?: string;
    /** Whether the panel is open */
    isOpen: boolean;
    /** Toggle open/close */
    onToggle: () => void;
}

// ─── Default Profile Sets ────────────────────────────────────────────────

export const IDEAS_PROFILES: AIProfile[] = [
    { id: 'brainstorm', label: 'Brainstorm', icon: '💡', systemPrompt: 'You are a creative product brainstormer. Help generate, refine, and evaluate product ideas. Suggest innovative approaches and ask thought-provoking questions.' },
    { id: 'critique', label: 'Critic', icon: '🔍', systemPrompt: 'You are a constructive product critic. Evaluate ideas for feasibility, market fit, and potential issues. Be honest but constructive.' },
    { id: 'research', label: 'Researcher', icon: '📊', systemPrompt: 'You are a product research assistant. Help research market trends, competitor analysis, and user needs. Provide data-driven insights.' },
];

export const ROADMAP_PROFILES: AIProfile[] = [
    { id: 'planner', label: 'Planner', icon: '📋', systemPrompt: 'You are a product roadmap planner. Help prioritize features, estimate effort, and plan releases. Consider dependencies and resource constraints.' },
    { id: 'architect', label: 'Architect', icon: '🏗️', systemPrompt: 'You are a software architect. Help design feature implementations, suggest technical approaches, and identify architectural considerations.' },
    { id: 'ux', label: 'UX Advisor', icon: '🎨', systemPrompt: 'You are a UX/UI advisor. Help design user experiences, suggest UI patterns, and evaluate usability of proposed features.' },
];

export const DEV_PROFILES: AIProfile[] = [
    { id: 'engineer', label: 'Engineer', icon: '⚙️', systemPrompt: 'You are a senior software engineer. Help plan sprint work, estimate tasks, suggest implementation approaches, and identify technical risks.' },
    { id: 'reviewer', label: 'Reviewer', icon: '👀', systemPrompt: 'You are a code review expert. Help review implementation plans, suggest best practices, identify edge cases, and improve code quality.' },
    { id: 'devops', label: 'DevOps', icon: '🚀', systemPrompt: 'You are a DevOps engineer. Help plan deployments, CI/CD pipelines, monitoring, and infrastructure considerations.' },
];

export const MARKETING_PROFILES: AIProfile[] = [
    { id: 'strategist', label: 'Strategist', icon: '🎯', systemPrompt: 'You are a marketing strategist. Help develop content strategies, identify target audiences, and plan marketing campaigns across platforms.' },
    { id: 'copywriter', label: 'Copywriter', icon: '✏️', systemPrompt: 'You are a professional copywriter. Help write engaging marketing copy, social media posts, blog articles, and promotional content.' },
    { id: 'analyst', label: 'Analyst', icon: '📈', systemPrompt: 'You are a marketing analyst. Help analyze campaign performance, suggest optimizations, and provide data-driven marketing insights.' },
];

export const CONTENT_PROFILES: AIProfile[] = [
    { id: 'creator', label: 'Creator', icon: '🎬', systemPrompt: 'You are a content creator. Help plan and write content for various platforms including social media, blogs, and video scripts.' },
    { id: 'editor', label: 'Editor', icon: '📝', systemPrompt: 'You are a content editor. Help refine, proofread, and improve content drafts. Suggest better hooks, CTAs, and formatting.' },
    { id: 'seo', label: 'SEO Expert', icon: '🔎', systemPrompt: 'You are an SEO expert. Help optimize content for search engines, suggest keywords, and improve content discoverability.' },
];

// ─── Save Actions ────────────────────────────────────────────────────────

const SAVE_ACTIONS = [
    { id: 'idea', label: 'Save as Idea', icon: '💡', table: 'ideas' },
    { id: 'feature', label: 'Save as Feature', icon: '✨', table: 'features' },
    { id: 'task', label: 'Save as Task', icon: '📋', table: 'tasks' },
    { id: 'strategy', label: 'Save as Strategy', icon: '📣', table: 'marketingStrategies' },
] as const;

// ─── Component ───────────────────────────────────────────────────────────

export default function AIChatPanel({ pageContext, profiles, defaultProfile, isOpen, onToggle }: AIChatPanelProps) {
    const { orgId, user } = useAuth();
    const userId = user?.id;
    const { data: projectData } = useProjects();

    // Chat state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [activeProfile, setActiveProfile] = useState(defaultProfile || profiles[0]?.id || '');
    const [selectedProject, setSelectedProject] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showSaveMenu, setShowSaveMenu] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Convex queries/mutations
    const sessions = useQuery(api.chatSessions.listSessions, userId ? { userId: userId as Id<"users"> } : "skip");
    const messages = useQuery(api.chatSessions.getMessages, sessionId ? { sessionId: sessionId as Id<"chatSessions"> } : "skip");
    const createSession = useMutation(api.chatSessions.createSession);
    const addMessage = useMutation(api.chatSessions.addMessage);
    const deleteSession = useMutation(api.chatSessions.deleteSession);

    // Idea/Feature/Task creation
    const createIdea = useMutation(api.ideas.create);
    const createFeature = useMutation(api.features.create);
    const createTask = useMutation(api.tasks.create);

    // Project options
    const projectOptions = useMemo(() =>
        (projectData?.projects || []).map(p => ({
            value: p.id as string, label: p.name, sublabel: p.path, icon: '📁',
        })), [projectData]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const currentProfile = profiles.find(p => p.id === activeProfile) || profiles[0];

    const handleNewSession = async () => {
        if (!userId || !orgId) return;
        const id = await createSession({
            userId: userId as Id<"users">,
            orgId: orgId as Id<"organizations">,
            title: `${pageContext} Chat`,
        });
        setSessionId(id as string);
    };

    const handleSend = async () => {
        if (!input.trim() || isSending) return;

        // Create session if needed
        let sid = sessionId;
        if (!sid && userId && orgId) {
            sid = await createSession({
                userId: userId as Id<"users">,
                orgId: orgId as Id<"organizations">,
                title: `${pageContext} Chat`,
            }) as string;
            setSessionId(sid);
        }
        if (!sid) return;

        setIsSending(true);
        try {
            // Add user message
            await addMessage({
                sessionId: sid as Id<"chatSessions">,
                role: 'user',
                content: input.trim(),
            });

            // Simulate AI response (placeholder - would connect to real AI in production)
            const contextInfo = selectedProject
                ? `Project: ${projectOptions.find(p => p.value === selectedProject)?.label || selectedProject}`
                : '';
            const aiResponse = `I'm the ${currentProfile?.label || 'AI'} assistant for **${pageContext}**.${contextInfo ? ` Working with ${contextInfo}.` : ''}\n\nI received your message: "${input.trim()}"\n\n*Note: This is a placeholder response. Connect to your AI backend to get real responses based on the system prompt: "${currentProfile?.systemPrompt?.slice(0, 80)}..."*`;

            await addMessage({
                sessionId: sid as Id<"chatSessions">,
                role: 'assistant',
                content: aiResponse,
            });
        } catch {
            // Error handling
        }
        setIsSending(false);
        setInput('');
    };

    const handleSaveAs = async (action: typeof SAVE_ACTIONS[number], content: string) => {
        if (!orgId) return;
        const title = content.split('\n')[0].replace(/^[#*\s]+/, '').slice(0, 100) || 'AI Generated';

        try {
            if (action.id === 'idea') {
                await createIdea({
                    orgId: orgId as Id<"organizations">,
                    title,
                    body: content,
                    category: 'feature',
                    score: 5,
                    tags: ['ai-generated'],
                });
            } else if (action.id === 'feature') {
                await createFeature({
                    orgId: orgId as Id<"organizations">,
                    title,
                    description: content,
                    status: 'proposed',
                    priority: 'medium',
                    tags: ['ai-generated'],
                });
            } else if (action.id === 'task') {
                await createTask({
                    orgId: orgId as Id<"organizations">,
                    title,
                    description: content,
                    projectPath: selectedProject || '(general)',
                    priority: 'medium',
                    effort: 'M',
                    taskType: 'feature',
                });
            }
            setShowSaveMenu(null);
        } catch {
            // Error handling
        }
    };

    const handleDeleteSession = async () => {
        if (!sessionId) return;
        await deleteSession({ id: sessionId as Id<"chatSessions"> });
        setSessionId(null);
    };

    // Recent sessions for this page
    const recentSessions = useMemo(() =>
        (sessions || []).filter(s => s.title.includes(pageContext)).slice(0, 5),
        [sessions, pageContext]);

    if (!isOpen) return null;

    const allMessages = messages || [];

    return (
        <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0,
            width: 420, maxWidth: '100vw',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            zIndex: 1000,
            animation: 'slideInRight 0.2s ease-out',
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-secondary)',
            }}>
                <span className="text-xl">🤖</span>
                <span className="font-semibold text-md flex-1">AI · {pageContext}</span>
                <button onClick={handleNewSession} className="btn btn-secondary text-xs" style={{ padding: '3px 8px' }}>+ New</button>
                {sessionId && (
                    <button onClick={handleDeleteSession} className="text-xs" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '2px 6px' }}>🗑️</button>
                )}
                <button onClick={onToggle} className="text-xs" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 6px', fontSize: 16 }}>✕</button>
            </div>

            {/* Profile & Project Selectors */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <SearchableSelect
                        options={profiles.map(p => ({ value: p.id, label: `${p.icon} ${p.label}` }))}
                        value={activeProfile}
                        onChange={setActiveProfile}
                        placeholder="Profile"
                        clearable={false}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <SearchableSelect
                        options={projectOptions}
                        value={selectedProject}
                        onChange={setSelectedProject}
                        placeholder="Project context"
                    />
                </div>
            </div>

            {/* Recent Sessions */}
            {!sessionId && recentSessions.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div className="text-xs text-tertiary mb-4">Recent Sessions</div>
                    {recentSessions.map(s => (
                        <div key={s._id} onClick={() => setSessionId(s._id)} className="text-sm"
                            style={{
                                padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                                background: 'var(--bg-secondary)', marginBottom: 2,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                        >{s.title} · <span className="text-tertiary">{new Date(s.updatedAt).toLocaleDateString()}</span></div>
                    ))}
                </div>
            )}

            {/* Messages */}
            <div style={{
                flex: 1, overflow: 'auto', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 12,
            }}>
                {allMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{currentProfile?.icon || '🤖'}</div>
                        <div className="text-md font-medium mb-4">{currentProfile?.label || 'AI Assistant'}</div>
                        <div className="text-sm text-tertiary">{currentProfile?.systemPrompt?.slice(0, 120)}...</div>
                    </div>
                )}
                {allMessages.map(msg => (
                    <div key={msg._id} style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: msg.role === 'user' ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                        border: msg.role === 'user' ? '1px solid rgba(99,102,241,0.2)' : '1px solid var(--border)',
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%', position: 'relative',
                    }}>
                        <div className="text-xs text-tertiary mb-4">
                            {msg.role === 'user' ? '👤 You' : `🤖 ${currentProfile?.label || 'AI'}`}
                        </div>
                        <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {msg.content}
                        </div>
                        {/* Save Actions for AI messages */}
                        {msg.role === 'assistant' && (
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <button
                                    onClick={() => setShowSaveMenu(showSaveMenu === msg._id ? null : msg._id)}
                                    className="text-xs"
                                    style={{
                                        padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                                        border: '1px solid var(--border)', background: 'var(--bg-primary)',
                                        color: 'var(--text-tertiary)',
                                    }}
                                >💾 Save as...</button>
                                {showSaveMenu === msg._id && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', left: 0,
                                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                        borderRadius: 8, padding: 4, marginBottom: 4,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10,
                                    }}>
                                        {SAVE_ACTIONS.map(action => (
                                            <button key={action.id} onClick={() => handleSaveAs(action, msg.content)}
                                                className="text-sm"
                                                style={{
                                                    display: 'block', width: '100%', textAlign: 'left',
                                                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                                                    background: 'none', color: 'var(--text-primary)',
                                                    borderRadius: 4, whiteSpace: 'nowrap',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                            >{action.icon} {action.label}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 8,
                background: 'var(--bg-secondary)',
            }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={`Ask ${currentProfile?.label || 'AI'}...`}
                    className="form-input"
                    style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                    disabled={isSending}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: 13 }}
                >{isSending ? '⏳' : '⬆️'}</button>
            </div>

            {/* Slide-in animation */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
