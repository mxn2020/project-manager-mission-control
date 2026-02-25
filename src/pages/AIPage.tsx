import { useState } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function AIPage() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: '👋 Hi! I\'m your Mission Control AI assistant. I can help you analyze your 250+ projects, suggest improvements, draft content, and more.\n\nTry asking me:\n- "Which projects have the lowest health scores?"\n- "What should I focus on this week?"\n- "Draft release notes for mega-claw v0.3"' }
    ]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        // Placeholder: will connect to Convex AI action
        setTimeout(() => {
            const reply: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '🔧 AI integration coming soon! This will connect to your Convex backend and have full access to your project portfolio data via MCP tools.\n\nFor now, the chat UI is ready and waiting for the AI provider connection.'
            };
            setMessages(prev => [...prev, reply]);
            setSending(false);
        }, 1000);
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map(m => (
                    <div key={m.id} className={`chat-message ${m.role}`}>
                        {m.content.split('\n').map((line, i) => (
                            <span key={i}>{line}<br /></span>
                        ))}
                    </div>
                ))}
                {sending && (
                    <div className="chat-message assistant" style={{ opacity: 0.6 }}>
                        <div className="loading-spinner" style={{ width: 14, height: 14 }} /> Thinking...
                    </div>
                )}
            </div>
            <div className="chat-input-area">
                <textarea
                    className="chat-input"
                    placeholder="Ask about your projects..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                />
                <button className="chat-send" onClick={handleSend} disabled={sending || !input.trim()}>Send</button>
            </div>
        </div>
    );
}
