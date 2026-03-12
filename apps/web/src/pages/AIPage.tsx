import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect from '../components/SearchableSelect';
import { FormCheckbox } from '../components/ui';
import type { Id } from '../lib/types';

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

// ─── Persona Definitions (matches aiPersonas.ts defaults) ────────────────

interface Persona {
    id: string;
    name: string;
    icon: string;
    description: string;
    welcome: string;
}

const DEFAULT_PERSONAS: Persona[] = [
    {
        id: 'default_0',
        name: 'Mission Control',
        icon: '🤖',
        description: 'Full access to all features',
        welcome: `👋 Hi! I'm your **Mission Control AI** assistant with full access to your portfolio.

I can manage projects, tasks, ideas, workflows, marketing plans, wiki articles, and more. Try asking:

• *"How many shipped projects do I have?"*
• *"Create a task for mission-control: fix auth issues"*
• *"What are my focus group projects?"*
• *"Give me a portfolio summary"*`,
    },
    {
        id: 'default_1',
        name: 'Project Manager',
        icon: '📊',
        description: 'Projects, tasks & focus groups',
        welcome: `📊 Hi! I'm your **Project Manager** — focused on project tracking and task management.

I can help you with:

• *"List all high-priority projects"*
• *"Create a task: review deployment pipeline"*
• *"Which projects are in the focus group?"*
• *"Run a health check on all projects"*`,
    },
    {
        id: 'default_2',
        name: 'Ideas Lab',
        icon: '💡',
        description: 'Brainstorming & ideation',
        welcome: `💡 Welcome to the **Ideas Lab**! I'm your creative partner for brainstorming.

I can help you:

• *"List all my ideas"*
• *"Create an idea: AI-powered code review tool"*
• *"Combine these ideas into one"*
• *"Promote my top idea to a task"*`,
    },
    {
        id: 'default_3',
        name: 'Marketing Strategist',
        icon: '📣',
        description: 'Marketing, content & wiki',
        welcome: `📣 Hi! I'm your **Marketing Strategist** — focused on growth and content.

I specialize in:

• *"Create a marketing plan for the product launch"*
• *"List all content plans"*
• *"Write a wiki article about our deployment process"*
• *"What marketing plans do we have?"*`,
    },
    {
        id: 'default_4',
        name: 'DevOps Engineer',
        icon: '🔧',
        description: 'Workflows & automation',
        welcome: `🔧 Hi! I'm your **DevOps Engineer** — focused on workflows and automation.

I can help with:

• *"List all workflows"*
• *"Create a deployment workflow"*
• *"Run automation: check for stale projects"*
• *"Show me all project health scores"*`,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip "data:...;base64," prefix
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function base64ToAudioUrl(base64: string, mimeType: string): string {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
}

export default function AIPage() {
    const { user, orgId } = useAuth();
    const userId = user?.id;
    const [searchParams, setSearchParams] = useSearchParams();

    // ─── Session from URL ────────────────────────────────────────────
    const sessionIdFromUrl = searchParams.get('session');

    // ─── Dynamic Personas from Chatbot Configs ───────────────────────
    const chatbotConfigs = useQuery(api.chatbots.listConfigs, orgId ? { orgId } : 'skip');

    const personas: Persona[] = useMemo(() => {
        if (!chatbotConfigs || chatbotConfigs.length === 0) return DEFAULT_PERSONAS;
        return chatbotConfigs.map((c, idx: number) => {
            const cRec = c as Record<string, unknown>;
            return {
                id: c._id,
                name: c.name || `Chatbot ${idx + 1}`,
                icon: (cRec.icon as string) || DEFAULT_PERSONAS[idx % DEFAULT_PERSONAS.length]?.icon || '🤖',
                description: c.description || '',
                welcome: (cRec.welcomeMessage as string) || DEFAULT_PERSONAS[idx % DEFAULT_PERSONAS.length]?.welcome || `👋 Hi! I'm **${c.name}**.\n\nHow can I help you today?`,
            };
        });
    }, [chatbotConfigs]);

    // ─── Persona State ───────────────────────────────────────────────
    const [selectedPersona, setSelectedPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);

    // Sync selected persona when dynamic list loads
    useEffect(() => {
        if (personas.length > 0 && !personas.find(p => p.id === selectedPersona.id)) {
            setSelectedPersona(personas[0]);
        }
    }, [personas]);

    const getWelcomeMsg = (persona: Persona): Message => ({
        id: 'welcome',
        role: 'assistant',
        content: persona.welcome,
        timestamp: Date.now(),
    });

    // ─── Local State ─────────────────────────────────────────────────
    const [messages, setMessages] = useState<Message[]>([getWelcomeMsg(DEFAULT_PERSONAS[0])]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [lastMeta, setLastMeta] = useState<ChatMeta | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ─── Voice State ─────────────────────────────────────────────────
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // ─── TTS State ───────────────────────────────────────────────────
    const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ─── Conversation Mode ───────────────────────────────────────────
    const [conversationMode, setConversationMode] = useState(false);
    const conversationModeRef = useRef(false);

    // ─── File Upload State ───────────────────────────────────────────
    const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Convex Queries ──────────────────────────────────────────────
    const sessionMessages = useQuery(
        api.chatSessions.getMessages,
        sessionIdFromUrl ? { sessionId: sessionIdFromUrl as Id<"chatSessions"> } : 'skip'
    );
    const settings = useQuery(api.aiConfig.getSettings, userId ? { userId: userId as Id<"users"> } : 'skip');
    const models = useQuery(api.aiConfig.listModels);

    // ─── Convex Mutations & Actions ──────────────────────────────────
    const createSession = useMutation(api.chatSessions.createSession);
    const updateSettings = useMutation(api.aiConfig.updateSettings);
    const aiChat = useAction(api.aiChat.chat);
    const transcribeAction = useAction(api.aiVoice.transcribe);
    const synthesizeAction = useAction(api.aiVoice.synthesize);

    // ─── Keep ref in sync ────────────────────────────────────────────
    useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);

    // ─── Load session messages from Convex ────────────────────────────
    useEffect(() => {
        if (!sessionIdFromUrl) {
            setMessages([getWelcomeMsg(selectedPersona)]);
            setLastMeta(null);
            return;
        }
        if (sessionMessages && sessionMessages.length > 0) {
            const loaded: Message[] = sessionMessages.map(m => ({
                id: m._id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.createdAt,
                toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
                tokens: m.tokenCount,
            }));
            setMessages(loaded);
        } else if (sessionIdFromUrl && sessionMessages && sessionMessages.length === 0) {
            setMessages([getWelcomeMsg(selectedPersona)]);
        }
    }, [sessionMessages, sessionIdFromUrl]);

    // ─── Auto-scroll ─────────────────────────────────────────────────
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, sending]);

    // ─── Persona switch ──────────────────────────────────────────────
    const handlePersonaSwitch = (persona: Persona) => {
        setSelectedPersona(persona);
        if (!sessionIdFromUrl) {
            setMessages([getWelcomeMsg(persona)]);
            setLastMeta(null);
        }
    };

    // ─── Send message ────────────────────────────────────────────────
    const handleSend = useCallback(async (overrideText?: string) => {
        const text = (overrideText || input).trim();
        if (!text && attachedFiles.length === 0) return;
        if (sending) return;

        let sessionId = sessionIdFromUrl;
        if (!sessionId && userId) {
            sessionId = await createSession({ userId: userId as Id<"users"> });
            setSearchParams({ session: sessionId }, { replace: true });
        }

        // Build message content with file context
        let messageContent = text;
        if (attachedFiles.length > 0) {
            const fileContext = attachedFiles.map(f =>
                `📎 **${f.name}** (${f.type}):\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\``
            ).join('\n\n');
            messageContent = fileContext + (text ? '\n\n' + text : '');
            setAttachedFiles([]);
        }

        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
        };

        const currentMessages = messages.filter(m => m.id !== 'welcome');
        setMessages([...currentMessages, userMsg]);
        setInput('');
        setSending(true);

        try {
            const history = [...currentMessages, userMsg]
                .slice(-(settings?.historyLength || 10))
                .map(m => ({ role: m.role, content: m.content }));

            const res = await aiChat({
                messages: history,
                sessionId: sessionId as Id<"chatSessions">,
                userId: userId as Id<"users">,
                orgId: user?.orgId as Id<"organizations">,
                personaId: selectedPersona.id,
            });

            setLastMeta({
                model: res.model,
                provider: res.provider,
                tokens: res.tokens,
                costCents: res.costCents,
                durationMs: res.durationMs,
                toolCalls: res.toolCalls,
            });

            const reply: Message = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: res.response,
                timestamp: Date.now(),
                toolCalls: res.toolCalls,
                tokens: res.tokens?.total,
            };
            setMessages(prev => [...prev, reply]);

            // Conversation mode: auto-speak the response
            if (conversationModeRef.current) {
                handleTTS(reply.id, res.response);
            }
        } catch (err: unknown) {
            setMessages(prev => [...prev, {
                id: `e-${Date.now()}`,
                role: 'assistant',
                content: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
                timestamp: Date.now(),
            }]);
        } finally {
            setSending(false);
        }
    }, [input, sending, sessionIdFromUrl, userId, messages, settings, createSession, setSearchParams, selectedPersona, attachedFiles]);

    // ─── Voice Recording ─────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await transcribeAudio(audioBlob);
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Microphone access denied:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) stopRecording();
        else startRecording();
    };

    const transcribeAudio = async (blob: Blob) => {
        setIsTranscribing(true);
        try {
            const base64 = await blobToBase64(blob);
            const result = await transcribeAction({
                audioBase64: base64,
                mimeType: 'audio/webm',
            });
            if (result.text) {
                if (conversationModeRef.current) {
                    // In conversation mode, send immediately
                    handleSend(result.text);
                } else {
                    setInput(prev => prev + (prev ? ' ' : '') + result.text);
                }
            }
        } catch (err) {
            console.error('Transcription failed:', err);
        } finally {
            setIsTranscribing(false);
        }
    };

    // ─── TTS Playback ────────────────────────────────────────────────
    const handleTTS = async (msgId: string, text: string) => {
        if (playingMsgId === msgId) {
            audioRef.current?.pause();
            setPlayingMsgId(null);
            return;
        }

        setPlayingMsgId(msgId);
        try {
            const result = await synthesizeAction({
                text: text.replace(/[*#`_~\[\]]/g, '').slice(0, 4096),
            });

            const url = base64ToAudioUrl(result.audioBase64, result.mimeType);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                setPlayingMsgId(null);
                URL.revokeObjectURL(url);
                // Conversation mode: start recording again after playback
                if (conversationModeRef.current) {
                    startRecording();
                }
            };

            audio.play();
        } catch (err) {
            console.error('TTS error:', err);
            setPlayingMsgId(null);
            // In conversation mode, still restart recording even if TTS fails
            if (conversationModeRef.current) {
                startRecording();
            }
        }
    };

    // ─── File Upload ─────────────────────────────────────────────────
    const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            try {
                if (file.type.startsWith('audio/')) {
                    setIsTranscribing(true);
                    const base64 = await blobToBase64(file);
                    const result = await transcribeAction({
                        audioBase64: base64,
                        mimeType: file.type,
                    });
                    setIsTranscribing(false);
                    if (result.text) {
                        setAttachedFiles(prev => [...prev, { name: file.name, content: result.text, type: '🎵 Transcribed Audio' }]);
                    }
                } else if (file.type.startsWith('image/')) {
                    const base64 = await blobToBase64(file);
                    setAttachedFiles(prev => [...prev, { name: file.name, content: `[Image: ${file.name}]`, type: '🖼️ Image' }]);
                } else {
                    const content = await file.text();
                    setAttachedFiles(prev => [...prev, { name: file.name, content, type: '📄 File' }]);
                }
            } catch (err) {
                console.error('File processing error:', err);
                setIsTranscribing(false);
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
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
                    <SearchableSelect
                        options={[
                            { value: '', label: 'System Default' },
                            ...(models || []).map(m => ({ value: m._id, label: `${m.displayName} (${m.provider?.name || 'Unknown'})` })),
                        ]}
                        value={settings && 'defaultModelId' in settings ? (settings.defaultModelId || '') : ''}
                        onChange={v => updateSettings({ userId: userId as Id<"users">, defaultModelId: (v || undefined) as Id<"aiModels"> | undefined })}
                        placeholder="Model" clearable={false} />
                </div>

                <div className="chat-settings-group">
                    <label>Temperature: {currentSettings.temperature}</label>
                    <input
                        type="range" min="0" max="2" step="0.1"
                        value={currentSettings.temperature}
                        onChange={e => updateSettings({
                            userId: userId as Id<"users">,
                            temperature: parseFloat(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <label>Max Tokens: {currentSettings.maxResponseTokens}</label>
                    <input
                        type="range" min="256" max="8192" step="256"
                        value={currentSettings.maxResponseTokens}
                        onChange={e => updateSettings({
                            userId: userId as Id<"users">,
                            maxResponseTokens: parseInt(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <label>History: {currentSettings.historyLength} messages</label>
                    <input
                        type="range" min="2" max="30" step="2"
                        value={currentSettings.historyLength}
                        onChange={e => updateSettings({
                            userId: userId as Id<"users">,
                            historyLength: parseInt(e.target.value),
                        })}
                    />
                </div>

                <div className="chat-settings-group">
                    <FormCheckbox
                        checked={currentSettings.toolsEnabled}
                        onChange={e => updateSettings({
                            userId: userId as Id<"users">,
                            toolsEnabled: e.target.checked,
                        })}
                        label="Enable Minions Tools"
                    />
                </div>

                {lastMeta && (
                    <div className="chat-settings-group chat-meta-display">
                        <label>Last Call</label>
                        <div className="chat-meta-grid">
                            <span>Model:</span><span>{lastMeta.model}</span>
                            <span>Tokens:</span><span>{lastMeta.tokens?.total || '—'}</span>
                            <span>Cost:</span><span>{lastMeta.costCents ? `$${(lastMeta.costCents / 100).toFixed(4)}` : 'Free'}</span>
                            <span>Time:</span><span>{lastMeta.durationMs ? `${(lastMeta.durationMs / 1000).toFixed(1)}s` : '—'}</span>
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
            {/* Persona Selector Bar */}
            <div className="persona-bar">
                {personas.map(p => (
                    <button
                        key={p.id}
                        className={`persona-pill ${selectedPersona.id === p.id ? 'active' : ''}`}
                        onClick={() => handlePersonaSwitch(p)}
                        title={p.description}
                    >
                        <span className="persona-icon">{p.icon}</span>
                        <span className="persona-name">{p.name}</span>
                    </button>
                ))}
                {conversationMode && (
                    <div className="conversation-indicator">
                        <span className="conversation-dot" />
                        Voice Mode
                    </div>
                )}
            </div>

            {renderSettings()}

            <div className="chat-messages" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                        <div className="chat-message-avatar">
                            {msg.role === 'assistant' ? selectedPersona.icon : '👤'}
                        </div>
                        <div className="chat-message-body">
                            <div className="chat-message-content">
                                {formatContent(msg.content)}
                            </div>
                            <div className="chat-message-actions">
                                {msg.role === 'assistant' && msg.id !== 'welcome' && (
                                    <button
                                        className={`chat-action-btn ${playingMsgId === msg.id ? 'active' : ''}`}
                                        onClick={() => handleTTS(msg.id, msg.content)}
                                        title={playingMsgId === msg.id ? 'Stop playback' : 'Listen to response'}
                                    >
                                        {playingMsgId === msg.id ? '⏹️' : '🔊'}
                                    </button>
                                )}
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <span className="chat-message-tools">
                                        🔧 {msg.toolCalls.join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {(sending || isTranscribing) && (
                    <div className="chat-message assistant">
                        <div className="chat-message-avatar">{selectedPersona.icon}</div>
                        <div className="chat-message-body">
                            <div className="chat-message-content">
                                <div className="chat-thinking">
                                    <div className="chat-dots"><span /><span /><span /></div>
                                    {isTranscribing ? 'Transcribing...' : 'Thinking...'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
                <div className="chat-attachments">
                    {attachedFiles.map((f, i) => (
                        <div key={i} className="chat-attachment">
                            <span>{f.type} {f.name}</span>
                            <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}>✕</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="chat-input-area">
                <button
                    className="chat-settings-btn"
                    onClick={() => setShowSettings(!showSettings)}
                    title="Settings"
                >⚙️</button>

                {/* File attach */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.json,.csv,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.m4a,.ogg,.webm"
                    style={{ display: 'none' }}
                    onChange={handleFileAttach}
                />
                <button
                    className="chat-action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                >📎</button>

                {/* Voice record */}
                <button
                    className={`chat-action-btn ${isRecording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    title={isRecording ? 'Stop recording' : 'Record voice'}
                    disabled={isTranscribing}
                >
                    {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎤'}
                </button>

                {/* Conversation mode toggle */}
                <button
                    className={`chat-action-btn ${conversationMode ? 'active' : ''}`}
                    onClick={() => {
                        const next = !conversationMode;
                        setConversationMode(next);
                        if (next) startRecording();
                        else stopRecording();
                    }}
                    title={conversationMode ? 'Exit conversation mode' : 'Start conversation mode (voice ↔ voice)'}
                >🗣️</button>

                <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder={isRecording ? '🔴 Recording... speak now' : 'Ask about your projects, create tasks, get insights...'}
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
                <button className="chat-send" onClick={() => handleSend()} disabled={sending || (!input.trim() && attachedFiles.length === 0)}>↑</button>
            </div>
        </div>
    );
}
