import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import { useDimensions } from '../hooks/useDimensions';
import { DEFAULT_DIMENSIONS, type Dimension, type SubDimension } from '../lib/dimensions';
import { useAuth } from '../hooks/useAuth';

export default function AdminPage() {
    const providers = useQuery(api.aiConfig.listProviders);
    const models = useQuery(api.aiConfig.listModels);
    const upsertProvider = useMutation(api.aiConfig.upsertProvider);
    const upsertModel = useMutation(api.aiConfig.upsertModel);
    const toggleProvider = useMutation(api.aiConfig.toggleProvider);
    const toggleModel = useMutation(api.aiConfig.toggleModel);

    const [searchParams, setSearchParams] = useSearchParams();
    const tab = (searchParams.get('tab') || 'providers') as 'providers' | 'models' | 'datasources' | 'dimensions' | 'chatbots' | 'system';
    const setTab = (t: typeof tab) => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', t); return next; }, { replace: true });
    const { dimensions, saveDimensions } = useDimensions();
    const [newDimName, setNewDimName] = useState('');
    const [newDimField, setNewDimField] = useState('');
    const [newDimIcon, setNewDimIcon] = useState('🏷️');
    const [newSubKey, setNewSubKey] = useState<Record<string, string>>({});
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [showAddModel, setShowAddModel] = useState(false);
    const [showAddChatbot, setShowAddChatbot] = useState(false);

    const { user } = useAuth();
    const orgId = (user as any)?.orgId;

    const chatbots = useQuery(api.chatbots.listConfigs, orgId ? { orgId } : "skip");
    const systemPrompts = useQuery(api.chatbots.listPrompts, orgId ? { orgId } : "skip");
    const createChatbot = useMutation(api.chatbots.createConfig);
    const deleteChatbot = useMutation(api.chatbots.deleteConfig);
    const updateChatbot = useMutation(api.chatbots.updateConfig);
    const createPrompt = useMutation(api.chatbots.createPrompt);
    const updatePrompt = useMutation(api.chatbots.updatePrompt);
    const deletePrompt = useMutation(api.chatbots.deletePrompt);

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

    // Add chatbot form
    const [cName, setCName] = useState('');
    const [cDesc, setCDesc] = useState('');
    const [cPrompt, setCPrompt] = useState('');
    const [cModel, setCModel] = useState('');

    // System prompts state
    const [showAddPrompt, setShowAddPrompt] = useState(false);
    const [spName, setSpName] = useState('');
    const [spContent, setSpContent] = useState('');
    const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
    const [editPromptContent, setEditPromptContent] = useState('');

    // Chatbot editing state
    const [editingChatbot, setEditingChatbot] = useState<string | null>(null);

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

    const handleAddChatbot = async () => {
        if (!cName || !orgId) return;
        await createChatbot({
            orgId,
            name: cName,
            description: cDesc,
            systemPromptId: cPrompt ? (cPrompt as any) : undefined,
            modelId: cModel ? (cModel as any) : undefined,
            isDefault: chatbots?.length === 0,
        });
        setCName(''); setCDesc(''); setCPrompt(''); setCModel('');
        setShowAddChatbot(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔧 Admin</h1>
                <p className="page-description">Manage AI providers, models, data sources, and system configuration</p>
            </div>

            {/* Tabs */}
            <div className="filter-bar mb-20">
                {(['providers', 'models', 'datasources', 'dimensions', 'chatbots', 'system'] as const).map(t => (
                    <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
                        {t === 'providers' ? '🔌 ' : t === 'models' ? '🤖 ' : t === 'datasources' ? '📂 ' : t === 'dimensions' ? '📐 ' : t === 'chatbots' ? '💬 ' : '⚙️ '}
                        {t === 'datasources' ? 'Data Sources' : t}
                    </button>
                ))}
            </div>

            {/* Providers Tab */}
            {tab === 'providers' && (
                <div>
                    <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                        <h3 className="section-header" style={{ margin: 0 }}>AI Providers</h3>
                        <button className="btn btn-primary text-base" onClick={() => setShowAddProvider(!showAddProvider)}>+ Add Provider</button>
                    </div>

                    {showAddProvider && (
                        <div className="section-card-sm mb-16">
                            <div className="grid-2 gap-12 mb-12">
                                <input placeholder="Name (e.g. NVIDIA NIM)" value={pName} onChange={e => setPName(e.target.value)} className="form-input" />
                                <input placeholder="Slug (e.g. nvidia)" value={pSlug} onChange={e => setPSlug(e.target.value)} className="form-input" />
                                <input placeholder="Base URL" value={pUrl} onChange={e => setPUrl(e.target.value)} className="form-input" />
                                <input placeholder="API Key Env Var (e.g. NVIDIA_API_KEY)" value={pKey} onChange={e => setPKey(e.target.value)} className="form-input" />
                            </div>
                            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowAddProvider(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddProvider}>Add Provider</button>
                            </div>
                        </div>
                    )}

                    {!providers ? <div className="loading"><div className="loading-spinner" /></div> : (
                        providers.map((p: any) => (
                            <div key={p._id} className="flex-row gap-16 mb-8" style={{
                                padding: '14px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.isEnabled ? '#34d399' : '#6b7280' }} />
                                <div className="flex-1">
                                    <div className="font-semibold text-lg">{p.name}</div>
                                    <div className="text-sm text-tertiary font-mono">{p.baseUrl}</div>
                                </div>
                                <span className="text-sm text-tertiary">{p.slug}</span>
                                <span className="text-sm text-tertiary font-mono">{p.apiKeyEnvVar}</span>
                                <button className={`btn ${p.isEnabled ? 'btn-secondary' : 'btn-primary'} text-sm`}
                                    onClick={() => toggleProvider({ id: p._id, isEnabled: !p.isEnabled })}
                                    style={{ padding: '4px 12px' }}>
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
                    <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                        <h3 className="section-header" style={{ margin: 0 }}>AI Models</h3>
                        <button className="btn btn-primary text-base" onClick={() => setShowAddModel(!showAddModel)}>+ Add Model</button>
                    </div>

                    {showAddModel && (
                        <div className="section-card-sm mb-16">
                            <div className="grid-2 gap-12 mb-12">
                                <SearchableSelect
                                    options={[{ value: '', label: 'Select Provider' }, ...(providers || []).map((p: any) => ({ value: p._id, label: p.name }))]}
                                    value={mProviderId} onChange={setMProviderId} placeholder="Provider" clearable={false} />
                                <input placeholder="Model ID" value={mModelId} onChange={e => setMModelId(e.target.value)} className="form-input" />
                                <input placeholder="Display Name" value={mDisplayName} onChange={e => setMDisplayName(e.target.value)} className="form-input" />
                                <input placeholder="Max Tokens" type="number" value={mMaxTokens} onChange={e => setMMaxTokens(e.target.value)} className="form-input" />
                                <input placeholder="Context Window" type="number" value={mContextWindow} onChange={e => setMContextWindow(e.target.value)} className="form-input" />
                                <input placeholder="Cost/M Input (cents)" type="number" step="0.01" value={mCostInput} onChange={e => setMCostInput(e.target.value)} className="form-input" />
                            </div>
                            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowAddModel(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddModel}>Add Model</button>
                            </div>
                        </div>
                    )}

                    {!models ? <div className="loading"><div className="loading-spinner" /></div> : (
                        (models as any[]).map((m: any) => (
                            <div key={m._id} className="flex-row gap-16 mb-8" style={{
                                padding: '14px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.isEnabled ? '#34d399' : '#6b7280' }} />
                                <div className="flex-1">
                                    <div className="font-semibold text-lg">
                                        {m.displayName}
                                        {m.isDefault && <span className="tag" style={{ marginLeft: 8, background: '#818cf830', color: '#818cf8', border: 'none' }}>DEFAULT</span>}
                                    </div>
                                    <div className="text-sm text-tertiary font-mono">{m.modelId}</div>
                                </div>
                                <span className="text-sm text-tertiary">{m.maxTokens} max</span>
                                <span className="text-sm text-tertiary">{m.contextWindow?.toLocaleString()} ctx</span>
                                <button className={`btn ${m.isEnabled ? 'btn-secondary' : 'btn-primary'} text-sm`}
                                    onClick={() => toggleModel({ id: m._id, isEnabled: !m.isEnabled })}
                                    style={{ padding: '4px 12px' }}>
                                    {m.isEnabled ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Data Sources Tab */}
            {tab === 'datasources' && (
                <div>
                    <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                        <h3 className="section-header" style={{ margin: 0 }}>📂 Data Sources Configuration</h3>
                    </div>

                    <div className="section-card-sm text-tertiary">
                        This section has been deprecated as we migrate to a GitHub-backed sync system.
                        Local file scanning config will be replaced by the GitHub repo sync configuration shortly.
                    </div>
                </div>
            )}

            {/* Dimensions Tab */}
            {tab === 'dimensions' && (
                <div>
                    <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                        <h3 className="section-header" style={{ margin: 0 }}>📐 Dimensions</h3>
                        <span className="text-sm text-tertiary">Used to group projects in Grid, Tree, Kanban, and Focus views</span>
                    </div>

                    {dimensions.map(dim => {
                        const isBuiltIn = dim.builtIn;
                        return (
                            <div key={dim.id} className="section-card-sm mb-12">
                                <div className="flex-row gap-10 mb-12">
                                    <span className="text-2xl">{dim.icon}</span>
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg">
                                            {dim.label}
                                            {isBuiltIn && <span className="tag" style={{ marginLeft: 8, background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none' }}>BUILT-IN</span>}
                                        </div>
                                        <div className="text-sm text-tertiary font-mono">field: {dim.field}</div>
                                    </div>
                                    {!isBuiltIn && (
                                        <button className="btn btn-secondary text-sm" style={{ color: '#f87171', padding: '4px 10px' }}
                                            onClick={() => saveDimensions(dimensions.filter(d => d.id !== dim.id))}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="text-sm font-semibold text-tertiary mb-4" style={{ textTransform: 'uppercase' }}>SUB-DIMENSIONS</div>
                                <div className="flex-row flex-wrap gap-6 mb-8">
                                    {dim.subDimensions.map(sub => (
                                        <span key={sub.key} className="flex-row gap-4 text-base" style={{
                                            padding: '4px 10px', borderRadius: 6,
                                            background: (sub.color || '#6b7280') + '15', border: `1px solid ${sub.color || 'var(--border)'}`,
                                            color: sub.color || 'var(--text-secondary)',
                                        }}>
                                            {sub.icon && <span>{sub.icon}</span>}
                                            {sub.label}
                                            <button onClick={() => {
                                                const newSubs = dim.subDimensions.filter(s => s.key !== sub.key);
                                                saveDimensions(dimensions.map(d => d.id === dim.id ? { ...d, subDimensions: newSubs } : d));
                                            }} className="icon-btn text-sm" style={{ color: '#f87171' }}>✕</button>
                                        </span>
                                    ))}
                                </div>
                                {/* Sub-dimension add (always available, even for built-in) */}
                                <div className="flex-row gap-8">
                                    <input
                                        value={newSubKey[dim.id] || ''}
                                        onChange={e => setNewSubKey(prev => ({ ...prev, [dim.id]: e.target.value }))}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newSubKey[dim.id]?.trim()) {
                                                const key = newSubKey[dim.id].trim().toLowerCase().replace(/\s+/g, '_');
                                                const newSub: SubDimension = { key, label: newSubKey[dim.id].trim(), order: dim.subDimensions.length };
                                                saveDimensions(dimensions.map(d => d.id === dim.id ? { ...d, subDimensions: [...d.subDimensions, newSub] } : d));
                                                setNewSubKey(prev => ({ ...prev, [dim.id]: '' }));
                                            }
                                        }}
                                        placeholder="Add sub-dimension..."
                                        className="form-input"
                                    />
                                    <button className="btn btn-primary text-base"
                                        onClick={() => {
                                            if (newSubKey[dim.id]?.trim()) {
                                                const key = newSubKey[dim.id].trim().toLowerCase().replace(/\s+/g, '_');
                                                const newSub: SubDimension = { key, label: newSubKey[dim.id].trim(), order: dim.subDimensions.length };
                                                saveDimensions(dimensions.map(d => d.id === dim.id ? { ...d, subDimensions: [...d.subDimensions, newSub] } : d));
                                                setNewSubKey(prev => ({ ...prev, [dim.id]: '' }));
                                            }
                                        }}>{newSubKey[dim.id]?.trim() ? '+ Add' : ''}</button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Custom Dimension */}
                    <div className="section-card-sm mt-16" style={{ border: '1px dashed var(--border)' }}>
                        <h4 className="font-semibold text-md mb-12" style={{ margin: 0 }}>+ Add Custom Dimension</h4>
                        <div className="gap-12" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', alignItems: 'center' }}>
                            <input value={newDimIcon} onChange={e => setNewDimIcon(e.target.value)}
                                className="form-input text-2xl text-center" style={{ width: 50 }} />
                            <input placeholder="Dimension name (e.g. Team)" value={newDimName}
                                onChange={e => setNewDimName(e.target.value)} className="form-input" />
                            <input placeholder="YAML field (e.g. team)" value={newDimField}
                                onChange={e => setNewDimField(e.target.value)} className="form-input" />
                        </div>
                        <div className="flex-row mt-12" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary text-base"
                                disabled={!newDimName.trim() || !newDimField.trim()}
                                onClick={() => {
                                    const id = 'custom_' + newDimField.trim().toLowerCase().replace(/\s+/g, '_');
                                    const newDim: Dimension = {
                                        id, label: newDimName.trim(), icon: newDimIcon || '🏷️',
                                        builtIn: false, field: newDimField.trim(), subDimensions: [],
                                    };
                                    saveDimensions([...dimensions, newDim]);
                                    setNewDimName(''); setNewDimField(''); setNewDimIcon('🏷️');
                                }}>Create Dimension</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chatbots Tab */}
            {tab === 'chatbots' && (
                <div>
                    <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                        <h3 className="section-header" style={{ margin: 0 }}>💬 Chatbot Profiles</h3>
                        <div className="flex-row gap-8">
                            <button className="btn btn-secondary text-sm" onClick={() => setTab('system')}>📝 Manage System Prompts</button>
                            <button className="btn btn-primary text-base" onClick={() => setShowAddChatbot(!showAddChatbot)}>+ Add Profile</button>
                        </div>
                    </div>

                    {showAddChatbot && (
                        <div className="section-card-sm mb-16">
                            <div className="grid-2 gap-12 mb-12">
                                <input placeholder="Profile Name (e.g. Code Assistant)" value={cName} onChange={e => setCName(e.target.value)} className="form-input" />
                                <input placeholder="Description (Optional)" value={cDesc} onChange={e => setCDesc(e.target.value)} className="form-input" />

                                <SearchableSelect
                                    options={[{ value: '', label: 'Select Model (Global Default)' }, ...(models as any[] || []).map((m: any) => ({ value: m._id, label: m.displayName }))]}
                                    value={cModel} onChange={setCModel} placeholder="AI Model" clearable={false} />

                                <SearchableSelect
                                    options={[{ value: '', label: 'Select System Prompt (Blank)' }, ...(systemPrompts || []).map((p: any) => ({ value: p._id, label: p.name + ` (v${p.version})` }))]}
                                    value={cPrompt} onChange={setCPrompt} placeholder="System Prompt" clearable={false} />
                            </div>
                            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowAddChatbot(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddChatbot}>Create Profile</button>
                            </div>
                        </div>
                    )}

                    {!chatbots ? <div className="loading"><div className="loading-spinner" /></div> : (
                        chatbots.map((c: any) => (
                            <div key={c._id} className="mb-8" style={{
                                background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                            }}>
                                <div className="flex-row gap-16" style={{ padding: '14px 16px' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.isDefault ? '#3b82f6' : '#6b7280', marginTop: 6 }} />
                                    <div className="flex-1">
                                        <div className="font-semibold text-lg">
                                            {c.name}
                                            {c.isDefault && <span className="tag" style={{ marginLeft: 8, background: '#3b82f630', color: '#60a5fa', border: 'none' }}>DEFAULT</span>}
                                            {c.isAgentic && <span className="tag" style={{ marginLeft: 8, background: '#a855f730', color: '#c084fc', border: 'none' }}>AGENT</span>}
                                        </div>
                                        <div className="text-sm text-tertiary">{c.description || 'No description'}</div>
                                    </div>
                                    <div className="flex-col text-sm text-tertiary" style={{ alignItems: 'flex-end' }}>
                                        <span>Model: {c.modelId ? (models as any[])?.find(m => m._id === c.modelId)?.displayName || c.modelId : 'Global Default'}</span>
                                        <span>Prompt: {c.systemPromptId ? systemPrompts?.find(p => p._id === c.systemPromptId)?.name || 'Default' : 'Blank'}</span>
                                    </div>
                                    <div className="flex-col gap-4">
                                        <button className="btn btn-secondary text-sm" onClick={() => setEditingChatbot(editingChatbot === c._id ? null : c._id)} style={{ padding: '4px 8px' }}>
                                            {editingChatbot === c._id ? 'Close' : 'Edit'}
                                        </button>
                                        {!c.isDefault && (
                                            <button className="btn btn-secondary text-sm" onClick={() => updateChatbot({ configId: c._id, isDefault: true })} style={{ padding: '4px 8px' }}>
                                                Set Default
                                            </button>
                                        )}
                                        <button className="btn btn-secondary text-sm text-error" onClick={() => deleteChatbot({ configId: c._id })} style={{ padding: '4px 8px' }}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                {editingChatbot === c._id && (
                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', marginTop: 0, paddingTop: 16 }}>
                                        <div className="grid-2 gap-12 mb-12">
                                            <div>
                                                <label className="form-label">Name</label>
                                                <input defaultValue={c.name} className="form-input" onBlur={e => updateChatbot({ configId: c._id, name: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="form-label">Description</label>
                                                <input defaultValue={c.description || ''} className="form-input" onBlur={e => updateChatbot({ configId: c._id, description: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="form-label">Model</label>
                                                <SearchableSelect
                                                    options={[{ value: '', label: 'Global Default' }, ...(models as any[] || []).map((m: any) => ({ value: m._id, label: m.displayName }))]}
                                                    value={c.modelId || ''} onChange={v => updateChatbot({ configId: c._id, modelId: v || undefined } as any)} placeholder="Model" clearable={false} />
                                            </div>
                                            <div>
                                                <label className="form-label">System Prompt</label>
                                                <SearchableSelect
                                                    options={[{ value: '', label: 'None' }, ...(systemPrompts || []).map((p: any) => ({ value: p._id, label: p.name + ` (v${p.version})` }))]}
                                                    value={c.systemPromptId || ''} onChange={v => updateChatbot({ configId: c._id, systemPromptId: v || undefined } as any)} placeholder="Prompt" clearable={false} />
                                            </div>
                                        </div>
                                        <div className="flex-row gap-12">
                                            <label className="flex-row gap-6 text-base" style={{ cursor: 'pointer' }}>
                                                <input type="checkbox" checked={c.isAgentic} onChange={e => updateChatbot({ configId: c._id, isAgentic: e.target.checked })} />
                                                Agentic Mode
                                            </label>
                                            <span className="text-xs text-tertiary">Temperature: {c.temperature ?? 0.7}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )
            }

            {/* System Tab */}
            {
                tab === 'system' && (
                    <div>
                        {/* System Prompts CRUD */}
                        <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                            <h3 className="section-header" style={{ margin: 0 }}>📝 System Prompts</h3>
                            <button className="btn btn-primary text-base" onClick={() => setShowAddPrompt(!showAddPrompt)}>+ New Prompt</button>
                        </div>

                        {showAddPrompt && (
                            <div className="section-card-sm mb-16">
                                <div className="flex-col gap-12">
                                    <input placeholder="Prompt Name (e.g. Product Assistant)" value={spName} onChange={e => setSpName(e.target.value)} className="form-input" />
                                    <textarea
                                        placeholder="Enter system prompt content..."
                                        value={spContent}
                                        onChange={e => setSpContent(e.target.value)}
                                        className="form-textarea"
                                        rows={6}
                                        style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="flex-row gap-8 mt-12" style={{ justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={() => { setShowAddPrompt(false); setSpName(''); setSpContent(''); }}>Cancel</button>
                                    <button className="btn btn-primary" disabled={!spName.trim() || !spContent.trim()} onClick={async () => {
                                        await createPrompt({ orgId, name: spName.trim(), content: spContent.trim() });
                                        setSpName(''); setSpContent(''); setShowAddPrompt(false);
                                    }}>Create Prompt</button>
                                </div>
                            </div>
                        )}

                        {!systemPrompts ? <div className="loading"><div className="loading-spinner" /></div> : systemPrompts.length === 0 ? (
                            <div className="empty-state mb-24">
                                <div className="empty-state-icon">📝</div>
                                <div className="empty-state-text">No system prompts yet. Create one to configure chatbot behavior.</div>
                            </div>
                        ) : (
                            <div className="mb-24">
                                {systemPrompts.map((p: any) => (
                                    <div key={p._id} className="mb-8" style={{
                                        background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                                    }}>
                                        <div className="flex-row gap-16" style={{ padding: '12px 16px' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.isActive ? '#34d399' : '#6b7280', marginTop: 6 }} />
                                            <div className="flex-1">
                                                <div className="font-semibold text-md">{p.name}</div>
                                                <div className="text-xs text-tertiary">v{p.version} · {p.content.length} chars · {p.isActive ? 'Active' : 'Inactive'}</div>
                                            </div>
                                            <div className="flex-row gap-4">
                                                <button className="btn btn-secondary text-sm" style={{ padding: '4px 8px' }}
                                                    onClick={() => { setEditingPrompt(editingPrompt === p._id ? null : p._id); setEditPromptContent(p.content); }}>
                                                    {editingPrompt === p._id ? 'Close' : 'Edit'}
                                                </button>
                                                <button className="btn btn-secondary text-sm" style={{ padding: '4px 8px' }}
                                                    onClick={() => updatePrompt({ promptId: p._id, isActive: !p.isActive })}>
                                                    {p.isActive ? 'Disable' : 'Enable'}
                                                </button>
                                                <button className="btn btn-secondary text-sm text-error" style={{ padding: '4px 8px' }}
                                                    onClick={() => deletePrompt({ promptId: p._id })}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        {editingPrompt === p._id && (
                                            <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                                <textarea
                                                    value={editPromptContent}
                                                    onChange={e => setEditPromptContent(e.target.value)}
                                                    className="form-textarea"
                                                    rows={8}
                                                    style={{ fontFamily: 'monospace', fontSize: '13px', width: '100%' }}
                                                />
                                                <div className="flex-row gap-8 mt-8" style={{ justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-primary text-sm" disabled={editPromptContent === p.content}
                                                        onClick={async () => {
                                                            await updatePrompt({ promptId: p._id, content: editPromptContent });
                                                            setEditingPrompt(null);
                                                        }}>Save Changes</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* System Info */}
                        <h3 className="section-header mb-16">⚙️ System Information</h3>
                        <div className="flex-col gap-8">
                            {[
                                { label: 'Convex URL', value: import.meta.env.VITE_CONVEX_URL?.replace('https://', '') || '(not configured)' },
                                { label: 'Frontend', value: window.location.hostname + ' (Vercel)' },
                                { label: 'Auth', value: 'Convex session tokens' },
                            ].map(item => (
                                <div key={item.label} className="flex-between" style={{
                                    padding: '10px 16px', alignItems: 'center',
                                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                                }}>
                                    <span className="font-medium text-md">{item.label}</span>
                                    <span className="font-mono text-base text-muted">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
