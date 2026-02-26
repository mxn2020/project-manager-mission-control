import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState } from 'react';

export default function AdminPage() {
    const providers = useQuery(api.aiConfig.listProviders);
    const models = useQuery(api.aiConfig.listModels);
    const upsertProvider = useMutation(api.aiConfig.upsertProvider);
    const upsertModel = useMutation(api.aiConfig.upsertModel);
    const toggleProvider = useMutation(api.aiConfig.toggleProvider);
    const toggleModel = useMutation(api.aiConfig.toggleModel);

    const [tab, setTab] = useState<'providers' | 'models' | 'system'>('providers');
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [showAddModel, setShowAddModel] = useState(false);

    // Add provider form
    const [pName, setPName] = useState('');
    const [pSlug, setPSlug] = useState('');
    const [pUrl, setPUrl] = useState('');
    const [pKey, setPKey] = useState('');

    // Add model form
    const [mProviderId, setMProviderId] = useState('');
    const [mModelId, setMModelId] = useState('');
    const [mDisplayName, setMDisplayName] = useState('');
    const [mMaxTokens, setMMaxTokens] = useState('4096');
    const [mContextWindow, setMContextWindow] = useState('128000');
    const [mCostInput, setMCostInput] = useState('0');
    const [mCostOutput, setMCostOutput] = useState('0');

    const handleAddProvider = async () => {
        if (!pName || !pSlug || !pUrl || !pKey) return;
        await upsertProvider({ name: pName, slug: pSlug, baseUrl: pUrl, apiKeyEnvVar: pKey, isEnabled: true });
        setPName(''); setPSlug(''); setPUrl(''); setPKey('');
        setShowAddProvider(false);
    };

    const handleAddModel = async () => {
        if (!mProviderId || !mModelId || !mDisplayName) return;
        await upsertModel({
            providerId: mProviderId as any,
            modelId: mModelId,
            displayName: mDisplayName,
            maxTokens: parseInt(mMaxTokens),
            contextWindow: parseInt(mContextWindow),
            costPerMillionInput: parseFloat(mCostInput),
            costPerMillionOutput: parseFloat(mCostOutput),
            isEnabled: true,
            isDefault: false,
        });
        setMModelId(''); setMDisplayName('');
        setShowAddModel(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔧 Admin</h1>
                <p className="page-description">Manage AI providers, models, and system configuration</p>
            </div>

            {/* Tabs */}
            <div className="filter-bar" style={{ marginBottom: 20 }}>
                {(['providers', 'models', 'system'] as const).map(t => (
                    <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
                        {t === 'providers' ? '🔌 ' : t === 'models' ? '🤖 ' : '⚙️ '}{t}
                    </button>
                ))}
            </div>

            {/* Providers Tab */}
            {tab === 'providers' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 14 }}>AI Providers</h3>
                        <button className="btn btn-primary" onClick={() => setShowAddProvider(!showAddProvider)} style={{ fontSize: 12 }}>+ Add Provider</button>
                    </div>

                    {showAddProvider && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <input placeholder="Name (e.g. NVIDIA NIM)" value={pName} onChange={e => setPName(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Slug (e.g. nvidia)" value={pSlug} onChange={e => setPSlug(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Base URL" value={pUrl} onChange={e => setPUrl(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="API Key Env Var (e.g. NVIDIA_API_KEY)" value={pKey} onChange={e => setPKey(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowAddProvider(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddProvider}>Add Provider</button>
                            </div>
                        </div>
                    )}

                    {!providers ? <div className="loading"><div className="loading-spinner" /></div> : (
                        providers.map((p: any) => (
                            <div key={p._id} style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: p.isEnabled ? '#34d399' : '#6b7280',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.baseUrl}</div>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.slug}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.apiKeyEnvVar}</span>
                                <button
                                    className={`btn ${p.isEnabled ? 'btn-secondary' : 'btn-primary'}`}
                                    onClick={() => toggleProvider({ id: p._id, isEnabled: !p.isEnabled })}
                                    style={{ fontSize: 11, padding: '4px 12px' }}
                                >
                                    {p.isEnabled ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Models Tab */}
            {tab === 'models' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 14 }}>AI Models</h3>
                        <button className="btn btn-primary" onClick={() => setShowAddModel(!showAddModel)} style={{ fontSize: 12 }}>+ Add Model</button>
                    </div>

                    {showAddModel && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <select value={mProviderId} onChange={e => setMProviderId(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }}>
                                    <option value="">Select Provider</option>
                                    {(providers || []).map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                                <input placeholder="Model ID" value={mModelId} onChange={e => setMModelId(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Display Name" value={mDisplayName} onChange={e => setMDisplayName(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Max Tokens" type="number" value={mMaxTokens} onChange={e => setMMaxTokens(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Context Window" type="number" value={mContextWindow} onChange={e => setMContextWindow(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                                <input placeholder="Cost/M Input (cents)" type="number" step="0.01" value={mCostInput} onChange={e => setMCostInput(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowAddModel(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddModel}>Add Model</button>
                            </div>
                        </div>
                    )}

                    {!models ? <div className="loading"><div className="loading-spinner" /></div> : (
                        (models as any[]).map((m: any) => (
                            <div key={m._id} style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: m.isEnabled ? '#34d399' : '#6b7280',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                                        {m.displayName}
                                        {m.isDefault && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: '#818cf830', color: '#818cf8', fontSize: 10 }}>DEFAULT</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{m.modelId}</div>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.maxTokens} max</span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.contextWindow?.toLocaleString()} ctx</span>
                                <button
                                    className={`btn ${m.isEnabled ? 'btn-secondary' : 'btn-primary'}`}
                                    onClick={() => toggleModel({ id: m._id, isEnabled: !m.isEnabled })}
                                    style={{ fontSize: 11, padding: '4px 12px' }}
                                >
                                    {m.isEnabled ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* System Tab */}
            {tab === 'system' && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16 }}>System Information</h3>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {[
                            { label: 'Convex URL', value: 'academic-buzzard-501.eu-west-1.convex.cloud' },
                            { label: 'VPS Server', value: '46.225.232.118 (Hetzner)' },
                            { label: 'Frontend', value: 'nabhani.wtf (Vercel)' },
                            { label: 'API Server', value: 'nabhani.wtf/api (proxied)' },
                            { label: 'Auth', value: 'Convex session tokens' },
                            { label: 'AI Provider', value: 'NVIDIA NIM (Llama 3.1 70B)' },
                        ].map(item => (
                            <div key={item.label} style={{
                                display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
