import { useState, useRef, useCallback } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';

type Tab = 'chat' | 'stt' | 'tts' | 'clone';

interface STTResult {
    text: string;
    model: string;
    provider: string;
    duration?: number;
    words?: Array<{ word: string; start: number; end: number }>;
    latencyMs: number;
}

interface TTSResult {
    audioUrl: string;
    model: string;
    provider: string;
    latencyMs: number;
}

// ─── Base64 helpers ──────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function base64ToAudioUrl(base64: string, mimeType: string): string {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export default function AIPlaygroundPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('chat');

    const voiceModels = useQuery(api.aiVoiceConfig.listVoiceModels, {});
    const llmModels = useQuery(api.aiConfig.listModels);
    const seedVoiceModels = useMutation(api.aiVoiceConfig.seedDefaults);
    const aiChat = useAction(api.aiChat.chat);
    const transcribeAction = useAction(api.aiVoice.transcribe);
    const synthesizeAction = useAction(api.aiVoice.synthesize);

    const sttModels = (voiceModels || []).filter(m => m.type === 'stt');
    const ttsModels = (voiceModels || []).filter(m => m.type === 'tts');

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'chat', label: 'Chat (LLM)', icon: '💬' },
        { id: 'stt', label: 'Speech-to-Text', icon: '🎤' },
        { id: 'tts', label: 'Text-to-Speech', icon: '🔊' },
        { id: 'clone', label: 'Voice Cloning', icon: '🧬' },
    ];

    return (
        <div className="playground-container">
            <div className="playground-header">
                <h1 className="playground-title">🧪 AI Playground</h1>
                <p className="playground-subtitle">Test all AI models and modalities in one place</p>
            </div>

            <div className="playground-tabs">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        className={`playground-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* Seed button if no voice models */}
            {voiceModels && voiceModels.length === 0 && (
                <div className="playground-seed-banner">
                    <span>No voice models found in database.</span>
                    <button className="btn btn-primary" onClick={() => seedVoiceModels({})}>
                        🌱 Seed Default Models
                    </button>
                </div>
            )}

            <div className="playground-content">
                {activeTab === 'chat' && <ChatTab models={llmModels || []} aiChat={aiChat} userId={user?.id} />}
                {activeTab === 'stt' && <STTTab models={sttModels} transcribe={transcribeAction} />}
                {activeTab === 'tts' && <TTSTab models={ttsModels} synthesize={synthesizeAction} />}
                {activeTab === 'clone' && <VoiceCloningTab models={ttsModels} synthesize={synthesizeAction} />}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: Chat (LLM)
// ═══════════════════════════════════════════════════════════════════════════

function ChatTab({ models, aiChat, userId }: { models: VoiceModel[]; aiChat: { send: (args: Record<string, unknown>) => Promise<{ content: string }> }; userId?: string }) {
    const [prompt, setPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant. Be concise.');
    const [temperature, setTemperature] = useState(0.7);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [response, setResponse] = useState('');
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Provider/model grouping
    const providers = Array.from(new Map(
        models
            .filter(m => m.provider && m.isEnabled)
            .map(m => [m.provider?._id || m.provider?.slug, m.provider])
    ).values());

    const filteredModels = selectedProvider
        ? models.filter(m => (m.provider?._id === selectedProvider || m.provider?.slug === selectedProvider) && m.isEnabled)
        : models.filter(m => m.isEnabled);

    const selectedModel = models.find(m => m._id === selectedModelId || m.modelId === selectedModelId);

    const handleSend = async () => {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        setResponse('');
        setMeta(null);
        try {
            const res = await aiChat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
                userId: userId as Id<"users">,
            });
            setResponse(res.response);
            setMeta({
                model: res.model,
                provider: res.provider,
                tokens: res.tokens,
                costCents: res.costCents,
                durationMs: res.durationMs,
                toolCalls: res.toolCalls,
            });
        } catch (err: unknown) {
            setResponse(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="playground-panel">
            <div className="playground-panel-grid">
                <div className="playground-panel-left">
                    {/* Provider Selector */}
                    <div className="pg-field">
                        <label>Provider</label>
                        <select className="pg-select" value={selectedProvider} onChange={e => {
                            setSelectedProvider(e.target.value);
                            setSelectedModelId(''); // Reset model when provider changes
                        }}>
                            <option value="">All Providers</option>
                            {providers.map(p => (
                                <option key={p._id || p.slug} value={p._id || p.slug}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Model Selector */}
                    <div className="pg-field">
                        <label>Model</label>
                        <select className="pg-select" value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}>
                            <option value="">Default (auto-select)</option>
                            {filteredModels.map(m => (
                                <option key={m._id} value={m._id}>
                                    {m.displayName || m.modelId}{m.isDefault ? ' ⭐' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Model Info */}
                    {selectedModel && (
                        <div className="pg-field" style={{
                            padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(129, 140, 248, 0.08)',
                            border: '1px solid rgba(129, 140, 248, 0.15)',
                            fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {selectedModel.displayName}
                                {selectedModel.isDefault && <span style={{ color: '#fbbf24', marginLeft: 6 }}>⭐ Default</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span>📐 Context: {((selectedModel.contextWindow || 0) / 1000).toFixed(0)}k</span>
                                <span>📝 Max: {((selectedModel.maxTokens || 0) / 1000).toFixed(0)}k tokens</span>
                                <span>💰 ${((selectedModel.costPerMillionInput || 0) / 100).toFixed(2)}/M in</span>
                            </div>
                        </div>
                    )}

                    <div className="pg-field">
                        <label>System Prompt</label>
                        <textarea
                            className="pg-textarea"
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="pg-field">
                        <label>Temperature: {temperature}</label>
                        <input type="range" min="0" max="2" step="0.1" value={temperature}
                            onChange={e => setTemperature(parseFloat(e.target.value))} />
                    </div>
                    <div className="pg-field">
                        <label>User Message</label>
                        <textarea
                            className="pg-textarea"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            rows={5}
                            placeholder="Type your message..."
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSend} disabled={loading || !prompt.trim()}>
                        {loading ? '⏳ Generating...' : '▶ Send'}
                    </button>
                </div>
                <div className="playground-panel-right">
                    <label>Response</label>
                    <div className="pg-output-box">
                        {response ? (
                            <pre className="pg-output-text">{response}</pre>
                        ) : (
                            <div className="pg-placeholder">Response will appear here...</div>
                        )}
                    </div>
                    {meta && (
                        <div className="pg-meta">
                            <span>🏷️ {meta.model}</span>
                            <span>⏱️ {meta.durationMs ? `${(meta.durationMs / 1000).toFixed(1)}s` : '—'}</span>
                            <span>🔢 {meta.tokens?.total || '—'} tokens</span>
                            <span>💰 {meta.costCents ? `$${(meta.costCents / 100).toFixed(4)}` : 'Free'}</span>
                            {meta.toolCalls?.length > 0 && <span>🔧 {meta.toolCalls.join(', ')}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: Speech-to-Text
// ═══════════════════════════════════════════════════════════════════════════

function STTTab({ models, transcribe }: { models: VoiceModel[]; transcribe: (formData: FormData) => Promise<string> }) {
    const [selectedModel, setSelectedModel] = useState('');
    const [language, setLanguage] = useState('en');
    const [results, setResults] = useState<STTResult[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getModel = (id: string) => models.find(m => (m._id === id || m.name === id));

    const doTranscribe = async (audioBlob: Blob, model?: VoiceModel) => {
        setLoading(true);
        const start = Date.now();
        try {
            const base64 = await blobToBase64(audioBlob);
            const m = model || getModel(selectedModel) || models.find(m => m.apiFormat === 'openai');

            const res = await transcribe({
                audioBase64: base64,
                mimeType: audioBlob.type || 'audio/webm',
                language,
                model: m?.name,
                provider: m?.provider,
                baseUrl: m?.baseUrl,
                apiKeyEnvVar: m?.apiKeyEnvVar,
            });

            setResults(prev => [...prev, {
                text: res.text,
                model: m?.displayName || m?.name || 'Unknown',
                provider: m?.provider || 'unknown',
                duration: res.duration,
                words: res.words,
                latencyMs: Date.now() - start,
            }]);
        } catch (err: unknown) {
            setResults(prev => [...prev, {
                text: `❌ ${err.message}`,
                model: model?.displayName || 'Error',
                provider: model?.provider || 'unknown',
                latencyMs: Date.now() - start,
            }]);
        } finally {
            setLoading(false);
        }
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            doTranscribe(blob);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        doTranscribe(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Compare all enabled OpenAI-format STT models
    const compareAll = async () => {
        if (!audioChunksRef.current.length) return;
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const openaiModels = models.filter(m => m.apiFormat === 'openai' && m.isEnabled);
        for (const m of openaiModels) {
            await doTranscribe(blob, m);
        }
    };

    return (
        <div className="playground-panel">
            <div className="playground-panel-grid">
                <div className="playground-panel-left">
                    <div className="pg-field">
                        <label>STT Model</label>
                        <select className="pg-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                            <option value="">Auto (first available)</option>
                            {models.map(m => (
                                <option key={m._id || m.name} value={m._id || m.name} disabled={m.apiFormat === 'riva-grpc'}>
                                    {m.displayName} {m.apiFormat === 'riva-grpc' ? '(gRPC — proxy needed)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="pg-field">
                        <label>Language</label>
                        <select className="pg-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            {['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'vi'].map(l => (
                                <option key={l} value={l}>{l.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="pg-field pg-actions-row">
                        <button
                            className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={loading}
                        >
                            {isRecording ? '⏹️ Stop Recording' : '🎤 Record Audio'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                            📁 Upload File
                        </button>
                    </div>
                    {isRecording && (
                        <div className="pg-recording-indicator">
                            <span className="conversation-dot" /> Recording...
                        </div>
                    )}
                </div>
                <div className="playground-panel-right">
                    <label>Transcription Results</label>
                    {results.length === 0 ? (
                        <div className="pg-placeholder">Record or upload audio to see transcription...</div>
                    ) : (
                        <div className="pg-results-list">
                            {results.map((r, i) => (
                                <div key={i} className="pg-result-card">
                                    <div className="pg-result-header">
                                        <span className="pg-result-model">{r.model}</span>
                                        <span className="pg-result-provider">{r.provider}</span>
                                        <span className="pg-result-latency">⏱️ {(r.latencyMs / 1000).toFixed(1)}s</span>
                                    </div>
                                    <pre className="pg-result-text">{r.text}</pre>
                                </div>
                            ))}
                        </div>
                    )}
                    {results.length > 0 && (
                        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setResults([])}>
                            🗑️ Clear Results
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: Text-to-Speech
// ═══════════════════════════════════════════════════════════════════════════

function TTSTab({ models, synthesize }: { models: VoiceModel[]; synthesize: (text: string, modelId: string, options?: Record<string, unknown>) => Promise<Blob> }) {
    const [text, setText] = useState('Hello! This is a test of the text-to-speech system. How does this voice sound?');
    const [selectedModel, setSelectedModel] = useState('');
    const [voice, setVoice] = useState('alloy');
    const [speed, setSpeed] = useState(1.0);
    const [language, setLanguage] = useState('en');
    const [results, setResults] = useState<TTSResult[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSynthesize = async (modelOverride?: VoiceModel) => {
        if (!text.trim() || loading) return;
        setLoading(true);
        const start = Date.now();
        const m = modelOverride || models.find(m => m._id === selectedModel || m.name === selectedModel) || models[0];
        try {
            const res = await synthesize({
                text,
                voice,
                speed,
                model: m?.name,
                provider: m?.provider,
                baseUrl: m?.baseUrl,
                apiKeyEnvVar: m?.apiKeyEnvVar,
                language,
            });

            const url = base64ToAudioUrl(res.audioBase64, res.mimeType);
            setResults(prev => [...prev, {
                audioUrl: url,
                model: m?.displayName || m?.name || 'Unknown',
                provider: m?.provider || 'unknown',
                latencyMs: Date.now() - start,
            }]);
        } catch (err: unknown) {
            setResults(prev => [...prev, {
                audioUrl: '',
                model: `❌ ${m?.displayName || 'Error'}: ${err.message}`,
                provider: m?.provider || 'unknown',
                latencyMs: Date.now() - start,
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="playground-panel">
            <div className="playground-panel-grid">
                <div className="playground-panel-left">
                    <div className="pg-field">
                        <label>TTS Model</label>
                        <select className="pg-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                            {models.map(m => (
                                <option key={m._id || m.name} value={m._id || m.name} disabled={m.apiFormat === 'riva-grpc'}>
                                    {m.displayName} {m.apiFormat === 'riva-grpc' ? '(gRPC — proxy needed)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="pg-field">
                        <label>Voice</label>
                        <select className="pg-select" value={voice} onChange={e => setVoice(e.target.value)}>
                            {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(v => (
                                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="pg-field">
                        <label>Language</label>
                        <select className="pg-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            {['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr'].map(l => (
                                <option key={l} value={l}>{l.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="pg-field">
                        <label>Speed: {speed.toFixed(1)}x</label>
                        <input type="range" min="0.25" max="4.0" step="0.25" value={speed}
                            onChange={e => setSpeed(parseFloat(e.target.value))} />
                    </div>
                    <div className="pg-field">
                        <label>Text</label>
                        <textarea className="pg-textarea" value={text} onChange={e => setText(e.target.value)} rows={5} />
                    </div>
                    <button className="btn btn-primary" onClick={() => handleSynthesize()} disabled={loading || !text.trim()}>
                        {loading ? '⏳ Synthesizing...' : '▶ Synthesize'}
                    </button>
                </div>
                <div className="playground-panel-right">
                    <label>Audio Results</label>
                    {results.length === 0 ? (
                        <div className="pg-placeholder">Generate audio to hear results...</div>
                    ) : (
                        <div className="pg-results-list">
                            {results.map((r, i) => (
                                <div key={i} className="pg-result-card">
                                    <div className="pg-result-header">
                                        <span className="pg-result-model">{r.model}</span>
                                        <span className="pg-result-provider">{r.provider}</span>
                                        <span className="pg-result-latency">⏱️ {(r.latencyMs / 1000).toFixed(1)}s</span>
                                    </div>
                                    {r.audioUrl && <audio controls src={r.audioUrl} className="pg-audio-player" />}
                                </div>
                            ))}
                        </div>
                    )}
                    {results.length > 0 && (
                        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => {
                            results.forEach(r => r.audioUrl && URL.revokeObjectURL(r.audioUrl));
                            setResults([]);
                        }}>🗑️ Clear</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: Voice Cloning
// ═══════════════════════════════════════════════════════════════════════════

function VoiceCloningTab({ models, synthesize }: { models: VoiceModel[]; synthesize: (text: string, modelId: string, options?: Record<string, unknown>) => Promise<Blob> }) {
    const [text, setText] = useState('This is a test of voice cloning. The generated speech should sound similar to the reference audio.');
    const [refAudio, setRefAudio] = useState<string | null>(null);
    const [refName, setRefName] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [language, setLanguage] = useState('en');
    const [results, setResults] = useState<TTSResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const cloningModels = models.filter(m => {
        try { return JSON.parse(m.config || '{}').supportsVoiceCloning; } catch { return false; }
    });

    const handleRefFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const b64 = await blobToBase64(file);
        setRefAudio(b64);
        setRefName(file.name);
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const b64 = await blobToBase64(blob);
            setRefAudio(b64);
            setRefName('Recorded reference');
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
    };

    const handleSynthesize = async () => {
        if (!text.trim() || !refAudio || loading) return;
        setLoading(true);
        const start = Date.now();
        const m = cloningModels.find(m => m._id === selectedModel || m.name === selectedModel) || cloningModels[0];
        try {
            const res = await synthesize({
                text,
                model: m?.name,
                provider: m?.provider,
                baseUrl: m?.baseUrl,
                apiKeyEnvVar: m?.apiKeyEnvVar,
                language,
                referenceAudioBase64: refAudio,
            });
            const url = base64ToAudioUrl(res.audioBase64, res.mimeType);
            setResults(prev => [...prev, {
                audioUrl: url,
                model: m?.displayName || m?.name || 'Unknown',
                provider: m?.provider || 'unknown',
                latencyMs: Date.now() - start,
            }]);
        } catch (err: unknown) {
            setResults(prev => [...prev, {
                audioUrl: '',
                model: `❌ ${err.message}`,
                provider: 'error',
                latencyMs: Date.now() - start,
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="playground-panel">
            <div className="playground-panel-grid">
                <div className="playground-panel-left">
                    <div className="pg-field">
                        <label>Voice Cloning Model</label>
                        <select className="pg-select" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                            {cloningModels.length === 0 && <option value="">No cloning models available</option>}
                            {cloningModels.map(m => (
                                <option key={m._id || m.name} value={m._id || m.name} disabled={m.apiFormat === 'riva-grpc'}>
                                    {m.displayName} {m.apiFormat === 'riva-grpc' ? '(proxy needed)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="pg-field">
                        <label>Reference Voice (10-30s audio sample)</label>
                        <div className="pg-actions-row">
                            <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleRefFile} />
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                📁 Upload Audio
                            </button>
                            <button
                                className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                                onClick={() => {
                                    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); }
                                    else startRecording();
                                }}
                            >
                                {isRecording ? '⏹️ Stop' : '🎤 Record'}
                            </button>
                        </div>
                        {refAudio && (
                            <div className="pg-ref-badge">✅ {refName} loaded</div>
                        )}
                    </div>

                    <div className="pg-field">
                        <label>Language</label>
                        <select className="pg-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            {['en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'zh', 'ar', 'hi', 'pt', 'ru', 'tr', 'nl'].map(l => (
                                <option key={l} value={l}>{l.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pg-field">
                        <label>Text to Clone</label>
                        <textarea className="pg-textarea" value={text} onChange={e => setText(e.target.value)} rows={5} />
                    </div>

                    <button className="btn btn-primary" onClick={handleSynthesize}
                        disabled={loading || !text.trim() || !refAudio}>
                        {loading ? '⏳ Cloning...' : '🧬 Generate with Cloned Voice'}
                    </button>
                </div>
                <div className="playground-panel-right">
                    <label>Cloned Audio Results</label>
                    {results.length === 0 ? (
                        <div className="pg-placeholder">Upload a reference voice, type text, and generate...</div>
                    ) : (
                        <div className="pg-results-list">
                            {results.map((r, i) => (
                                <div key={i} className="pg-result-card">
                                    <div className="pg-result-header">
                                        <span className="pg-result-model">{r.model}</span>
                                        <span className="pg-result-provider">{r.provider}</span>
                                        <span className="pg-result-latency">⏱️ {(r.latencyMs / 1000).toFixed(1)}s</span>
                                    </div>
                                    {r.audioUrl && <audio controls src={r.audioUrl} className="pg-audio-player" />}
                                </div>
                            ))}
                        </div>
                    )}
                    {results.length > 0 && (
                        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => {
                            results.forEach(r => r.audioUrl && URL.revokeObjectURL(r.audioUrl));
                            setResults([]);
                        }}>🗑️ Clear</button>
                    )}
                </div>
            </div>
        </div>
    );
}
