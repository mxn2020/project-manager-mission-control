import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getAuthHeaders, API_BASE } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    toolCalls?: string[];
    tokens?: number;
}

interface ChatMeta {
    model?: string;
    provider?: string;
    tokens?: { prompt: number; completion: number; total: number };
    costCents?: number;
    durationMs?: number;
    toolCalls?: string[];
}

const WELCOME_MSG: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `👋 Hi! I'm your **Mission Control AI** assistant, powered by Llama 3.1 with direct access to your Minions database.

I can query, create, and update your project data. Try asking me:

• *"How many shipped projects do I have?"*
• *"List all projects using React"*
• *"What's the health score of mega-claw?"*
• *"Create a task for mission-control: fix auth issues"*
• *"Give me a portfolio summary"*`,
    timestamp: Date.now(),
};

export default function AIPage() {
    const { user } = useAuth();
    const userId = user?.id;

    // ─── Session State ───────────────────────────────────────────────
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [lastMeta, setLastMeta] = useState<ChatMeta | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ─── Convex Queries ──────────────────────────────────────────────
    const sessionMessages = useQuery(
        api.chatSessions.getMessages,
        activeSessionId ? { sessionId: activeSessionId as any } : 'skip'
    );
    const settings = useQuery(api.aiConfig.getSettings, userId ? { userId: userId as any } : 'skip');
    const models = useQuery(api.aiConfig.listModels);

    // ─── Convex Mutations ────────────────────────────────────────────
    const createSession = useMutation(api.chatSessions.createSession);
    const deleteSession = useMutation(api.chatSessions.deleteSession);
    const updateSettings = useMutation(api.aiConfig.updateSettings);

    // ─── Load session messages from Convex ────────────────────────────
    useEffect(() => {
        if (sessionMessages && sessionMessages.length > 0) {
            const loaded: Message[] = sessionMessages.map((m: any) => ({
                id: m._id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.createdAt,
                toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
                tokens: m.tokenCount,
            }));
            setMessages(loaded);
        } else if (activeSessionId && sessionMessages && sessionMessages.length === 0) {
            setMessages([WELCOME_MSG]);
        }
    }, [sessionMessages, activeSessionId]);

    // ─── Auto-scroll ─────────────────────────────────────────────────
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, sending]);

    // ─── Create new session ──────────────────────────────────────────
    const handleNewChat = useCallback(async () => {
        if (!userId) return;
        const id = await createSession({ userId: userId as any });
        setActiveSessionId(id);
        setMessages([WELCOME_MSG]);
        setLastMeta(null);
    }, [userId, createSession]);

    // ─── Switch session ──────────────────────────────────────────────
    const handleSelectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
        setLastMeta(null);
    }, []);

    // ─── Delete session ──────────────────────────────────────────────
    const handleDeleteSession = useCallback(async (sessionId: string) => {
        await deleteSession({ id: sessionId as any });
        if (activeSessionId === sessionId) {
            setActiveSessionId(null);
            setMessages([WELCOME_MSG]);
        }
    }, [deleteSession, activeSessionId]);

    // ─── Send message ────────────────────────────────────────────────
    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;

        // Auto-create session if none active
        let sessionId = activeSessionId;
        if (!sessionId && userId) {
            sessionId = await createSession({ userId: userId as any });
            setActiveSessionId(sessionId);
        }

        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMsg]);
        setInput('');
        setSending(true);

        try {
            const history = [...messages.filter(m => m.id !== 'welcome'), userMsg]
                .slice(-(settings?.historyLength || 10))
                .map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ messages: history, sessionId }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setLastMeta({
                model: data.model,
                provider: data.provider,
                tokens: data.tokens,
                costCents: data.costCents,
                durationMs: data.durationMs,
                toolCalls: data.toolCalls,
            });

            const reply: Message = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: data.response,
                timestamp: Date.now(),
                toolCalls: data.toolCalls,
                tokens: data.tokens?.total,
            };
            setMessages(prev => [...prev, reply]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: `e-${Date.now()}`,
                role: 'assistant',
                content: `❌ Error: ${err.message}`,
                timestamp: Date.now(),
            }]);
        } finally {
            setSending(false);
        }
    };

    // ─── Format message content (basic markdown) ─────────────────────
    const formatContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            let processed = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

            if (/^[•\-\*]\s/.test(processed)) {
                processed = `<span class="chat-bullet">•</span>${processed.slice(2)}`;
            }

            return <div key={i} dangerouslySetInnerHTML={{ __html: processed || '&nbsp;' }} />;
        });
    };

    // ─── Settings Panel ──────────────────────────────────────────────
    const renderSettings = () => {
        if (!showSettings || !userId) return null;

        const currentSettings = settings || {
            temperature: 0.7,
            maxResponseTokens: 2048,
            historyLength: 10,
            toolsEnabled: true,
        };

        return (
            <div className="chat-settings-panel">
                <div className="chat-settings-header">
                    <span>⚙️ Settings</span>
                    <button className="chat-settings-close" onClick={() => setShowSettings(false)}>✕</button>
                </div>

                <div className="chat-settings-group">
                    <label>Model</label>
                    <select
                        value={(currentSettings as any)?.defaultModelId || ''}
                        onChange={e => updateSettings({
                            userId: userId as any,
                            defaultModelId: e.target.value || undefined,
                        } as any)}
                    >
                        <option value="">System Default</option>
                        {(models || []).map((m: any) => (
                            <option key={m._id} value={m._id} disabled={!m.isEnabled}>
                                {m.displayName} ({m.provider?.name || 'Unknown'})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="chat-settings-group">
                    <label>Temperature: {currentSettings.temperature}</label>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={currentSettings.temperature}
                        onChange={e => updateSettings({
                            userId: userId as any,
                            temperature: parseFloat(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <label>Max Tokens: {currentSettings.maxResponseTokens}</label>
                    <input
                        type="range"
                        min="256"
                        max="8192"
                        step="256"
                        value={currentSettings.maxResponseTokens}
                        onChange={e => updateSettings({
                            userId: userId as any,
                            maxResponseTokens: parseInt(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <label>History Length: {currentSettings.historyLength} messages</label>
                    <input
                        type="range"
                        min="2"
                        max="30"
                        step="2"
                        value={currentSettings.historyLength}
                        onChange={e => updateSettings({
                            userId: userId as any,
                            historyLength: parseInt(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={currentSettings.toolsEnabled}
                            onChange={e => updateSettings({
                                userId: userId as any,
                                toolsEnabled: e.target.checked,
                            })}
                        />
                        Enable Minions Tools
                    </label>
                </div>

                {lastMeta && (
                    <div className="chat-settings-group chat-meta-display">
                        <label>Last Call</label>
                        <div className="chat-meta-grid">
                            <span>Model:</span><span>{lastMeta.model}</span>
                            <span>Tokens:</span><span>{lastMeta.tokens?.total || '—'}</span>
                            <span>Cost:</span><span>{lastMeta.costCents ? `$${(lastMeta.costCents / 100).toFixed(4)}` : 'Free'}</span>
                            <span>Duration:</span><span>{lastMeta.durationMs ? `${(lastMeta.durationMs / 1000).toFixed(1)}s` : '—'}</span>
                            {lastMeta.toolCalls && lastMeta.toolCalls.length > 0 && (
                                <><span>Tools:</span><span>{lastMeta.toolCalls.join(', ')}</span></>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="chat-container">
            {renderSettings()}

            <div className="chat-messages" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                        <div className="chat-message-avatar">
                            {msg.role === 'assistant' ? '🤖' : '👤'}
                        </div>
                        <div className="chat-message-body">
                            <div className="chat-message-content">
                                {formatContent(msg.content)}
                            </div>
                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className="chat-message-tools">
                                    🔧 {msg.toolCalls.join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="chat-message assistant">
                        <div className="chat-message-avatar">🤖</div>
                        <div className="chat-message-body">
                            <div className="chat-message-content">
                                <div className="chat-thinking">
                                    <div className="chat-dots"><span /><span /><span /></div>
                                    Thinking...
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="chat-input-area">
                <button
                    className="chat-settings-btn"
                    onClick={() => setShowSettings(!showSettings)}
                    title="Settings"
                >⚙️</button>
                <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Ask about your projects, create tasks, get insights..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    rows={1}
                    onInput={e => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = 'auto';
                        t.style.height = Math.min(t.scrollHeight, 150) + 'px';
                    }}
                />
                <button className="chat-send" onClick={handleSend} disabled={sending || !input.trim()}>↑</button>
            </div>
        </div>
    );
}
