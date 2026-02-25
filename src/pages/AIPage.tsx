import { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

const WELCOME_MSG: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `👋 Hi! I'm your **Mission Control AI** assistant, powered by Llama 3.1 with direct access to your Minions database.

I can query, create, and update your project data. Try asking me:

• "How many shipped projects do I have?"
• "List all projects using React"
• "What's the health score of mega-claw?"
• "Create a task for mission-control: fix auth issues"
• "Give me a portfolio summary"`,
    timestamp: Date.now(),
};

export default function AIPage() {
    const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        try {
            // Build conversation history (last 10 messages for context)
            const history = [...messages.filter(m => m.id !== 'welcome'), userMsg]
                .slice(-10)
                .map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const reply: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response || 'No response from AI.',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, reply]);
        } catch (err: any) {
            const errMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `⚠️ Error: ${err.message}\n\nMake sure the API server is running and NVIDIA_API_KEY is configured.`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setSending(false);
        }
    };

    // Simple markdown-like rendering
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            // Bold
            let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Inline code
            rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Bullet points
            if (rendered.startsWith('• ') || rendered.startsWith('- ')) {
                rendered = `<span class="chat-bullet">•</span> ${rendered.slice(2)}`;
            }
            return (
                <span key={i} dangerouslySetInnerHTML={{ __html: rendered || '<br/>' }} />
            );
        });
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map(m => (
                    <div key={m.id} className={`chat-message ${m.role}`}>
                        <div className="chat-message-avatar">
                            {m.role === 'user' ? '👤' : '🤖'}
                        </div>
                        <div className="chat-message-body">
                            <div className="chat-message-content">
                                {renderContent(m.content)}
                            </div>
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="chat-message assistant">
                        <div className="chat-message-avatar">🤖</div>
                        <div className="chat-message-body">
                            <div className="chat-message-content chat-thinking">
                                <div className="chat-dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
                <textarea
                    ref={textareaRef}
                    className="chat-input"
                    placeholder="Ask about your projects, create tasks, get insights..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    rows={1}
                />
                <button
                    className="chat-send"
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                >
                    {sending ? '⏳' : '↑'}
                </button>
            </div>
        </div>
    );
}
