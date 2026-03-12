import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';
import AIChatPanel, { MARKETING_PROFILES } from '../components/AIChatPanel';
import { PageHeader, StatCard, EmptyState, FormInput, FormTextarea } from '../components/ui';
import type { Id } from '../lib/types';

// ─── Constants ───────────────────────────────────────────────────────────

const TABS = [
    { id: 'strategies', label: 'Strategies', icon: '📋' },
    { id: 'campaigns', label: 'Campaigns', icon: '📢' },
] as const;

type TabId = typeof TABS[number]['id'];

const PIPELINE_STAGES = [
    { key: 'idea', label: 'Idea', icon: '💡', color: '#a78bfa' },
    { key: 'draft', label: 'Draft', icon: '📝', color: '#60a5fa' },
    { key: 'in-review', label: 'In Review', icon: '👀', color: '#fbbf24' },
    { key: 'scheduled', label: 'Scheduled', icon: '📅', color: '#f472b6' },
    { key: 'posted', label: 'Posted', icon: '✅', color: '#34d399' },
    { key: 'archived', label: 'Archived', icon: '📦', color: '#6b7280' },
];

const PLATFORM_META: Record<string, { icon: string; label: string; color: string }> = {
    tiktok: { icon: '🎵', label: 'TikTok', color: '#ff0050' },
    x: { icon: '𝕏', label: 'X / Twitter', color: '#1da1f2' },
    reddit: { icon: '🔴', label: 'Reddit', color: '#ff4500' },
    youtube: { icon: '▶️', label: 'YouTube', color: '#ff0000' },
    blog: { icon: '📝', label: 'Blog', color: '#34d399' },
    medium: { icon: '📰', label: 'Medium', color: '#00ab6c' },
    linkedin: { icon: '💼', label: 'LinkedIn', color: '#0a66c2' },
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
    slideshow: '🖼️', video: '🎬', post: '📮', article: '📄',
    thread: '🧵', vlog: '📹',
};

const TONE_BADGES: Record<string, { label: string; color: string }> = {
    controversy: { label: '🔥 Controversy', color: '#ef4444' },
    motivational: { label: '💪 Motivational', color: '#f59e0b' },
    educational: { label: '📚 Educational', color: '#3b82f6' },
    storytelling: { label: '📖 Storytelling', color: '#8b5cf6' },
    'how-to': { label: '🔧 How-To', color: '#10b981' },
};

const CATEGORY_LABELS: Record<string, string> = {
    'webapp': '🌐 Web App', 'fullstack-app': '🏗️ Full-Stack', 'monorepo-app': '📦 Monorepo',
    'oss-tool': '🔓 OSS Tool', 'ui-package': '🎨 UI Package', 'library': '📚 Library',
    'boilerplate': '🧩 Boilerplate', 'minion-toolbox': '🤖 Toolbox',
    'backend-service': '⚙️ Backend', 'client-project': '💼 Client',
};

const CADENCE_LABELS: Record<string, string> = {
    'daily': 'Daily', '2x-week': '2× / week', 'weekly': 'Weekly',
    'biweekly': 'Bi-weekly', 'monthly': 'Monthly',
};

// ─── Main Component ──────────────────────────────────────────────────────

export default function MarketingPage() {
    const { orgId } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('strategies');
    const [showAIChat, setShowAIChat] = useState(false);

    return (
        <div>
            <PageHeader
                title="📣 Marketing Pipeline"
                description="AI-supported content pipeline · Create, manage, and track marketing tasks across all projects"
                actions={
                    <div className="flex-row gap-8">
                        <button className="btn btn-secondary" onClick={() => setShowAIChat(!showAIChat)} title="AI Assistant">🤖 AI</button>
                        {activeTab === 'strategies' && <SeedButton orgId={orgId} />}
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex-row gap-4 mb-16" style={{
                borderBottom: '1px solid var(--border)', paddingBottom: 0,
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="text-md font-medium"
                        style={{
                            padding: '10px 16px', border: 'none', cursor: 'pointer',
                            background: 'none',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'strategies' && <StrategiesTab orgId={orgId} />}
            {activeTab === 'campaigns' && <CampaignsTab orgId={orgId} />}

            <AIChatPanel
                pageContext="Marketing"
                profiles={MARKETING_PROFILES}
                isOpen={showAIChat}
                onToggle={() => setShowAIChat(false)}
            />
        </div>
    );
}

// ─── Seed Button ─────────────────────────────────────────────────────────

function SeedButton({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const seedDefaults = useMutation(api.marketingStrategies.seedDefaults);
    const [seeding, setSeeding] = useState(false);

    const handleSeed = async () => {
        if (!orgId) return;
        setSeeding(true);
        try {
            const result = await seedDefaults({ orgId });
            if (!result.seeded) alert(result.message);
        } catch (err) {
            alert(String(err));
        }
        setSeeding(false);
    };

    return (
        <button className="btn btn-secondary text-base" onClick={handleSeed} disabled={seeding || !orgId}>
            {seeding ? '⏳ Seeding...' : '🌱 Seed Default Strategies'}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── STRATEGIES TAB ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

interface Tactic {
    id: string;
    platform: string;
    contentType: string;
    tone: string;
    description: string;
    example: string;
    frequency: string;
}

function StrategiesTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const rawStrategies = useQuery(api.marketingStrategies.list, orgId ? { orgId } : "skip");
    const strategies = rawStrategies || [];
    const { data: projectData } = useProjects();

    const [catFilter, setCatFilter] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [applyProject, setApplyProject] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState('');

    const generateFromStrategy = useMutation(api.marketingTasks.generateFromStrategy);

    const projectOptions: SelectOption[] = useMemo(() =>
        (projectData?.projects || []).filter(p => p.name).map(p => ({
            value: p.id as string,
            label: p.name,
            sublabel: p.tier,
            icon: '📁',
        })), [projectData]);

    const filtered = strategies.filter(s => !catFilter || s.projectCategory === catFilter);
    const categories = [...new Set(strategies.map(s => s.projectCategory))];

    const handleApply = async (strategyId: string) => {
        if (!orgId || !selectedProject) return;
        const project = (projectData?.projects || []).find(p => (p.id as string) === selectedProject);
        if (!project) return;

        await generateFromStrategy({
            orgId,
            strategyId: strategyId as Id<"marketingStrategies">,
            projectId: project.id,
            projectPath: project.name,
            projectName: project.name,
        });
        setApplyProject(null);
        setSelectedProject('');
    };

    return (
        <div>
            {/* Category Filter */}
            {categories.length > 1 && (
                <div className="flex-row flex-wrap gap-6 mb-16">
                    <button
                        className={`btn text-sm ${!catFilter ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCatFilter('')}
                    >All ({strategies.length})</button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`btn text-sm ${catFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
                        >{CATEGORY_LABELS[cat] || cat} ({strategies.filter(s => s.projectCategory === cat).length})</button>
                    ))}
                </div>
            )}

            {strategies.length === 0 ? (
                <EmptyState icon="📋" message="No strategies yet — click 'Seed Default Strategies' to get started" />
            ) : filtered.length === 0 ? (
                <EmptyState icon="🔍" message="No strategies match this filter" />
            ) : (
                <div className="flex-col gap-8">
                    {filtered.map(strategy => (
                        <div key={strategy._id} style={{
                            background: 'var(--bg-secondary)', borderRadius: 12,
                            border: expanded === strategy._id ? '1px solid var(--accent)' : '1px solid var(--border)',
                            transition: 'border-color 0.2s', position: 'relative',
                        }}>
                            {/* Header */}
                            <div
                                className="flex-row gap-12"
                                style={{ padding: '14px 16px', cursor: 'pointer', alignItems: 'center' }}
                                onClick={() => setExpanded(expanded === strategy._id ? null : strategy._id)}
                            >
                                <div className="flex-1">
                                    <div className="flex-row gap-8 flex-wrap" style={{ alignItems: 'center' }}>
                                        <span className="font-semibold text-md">{strategy.name}</span>
                                        <span className="text-xs" style={{
                                            padding: '2px 8px', borderRadius: 4,
                                            background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                                        }}>{CATEGORY_LABELS[strategy.projectCategory] || strategy.projectCategory}</span>
                                        <span className="text-xs text-tertiary">
                                            📡 {CADENCE_LABELS[strategy.cadence] || strategy.cadence}
                                        </span>
                                    </div>
                                    {strategy.description && (
                                        <div className="text-sm text-tertiary mt-4" style={{
                                            maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: expanded === strategy._id ? 'normal' : 'nowrap',
                                        }}>{strategy.description}</div>
                                    )}
                                </div>

                                {/* Channel badges */}
                                <div className="flex-row gap-4 flex-shrink-0">
                                    {strategy.channels.slice(0, 6).map(ch => (
                                        <span key={ch} title={PLATFORM_META[ch]?.label || ch} className="text-lg">
                                            {PLATFORM_META[ch]?.icon || '📢'}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); setApplyProject(applyProject === strategy._id ? null : strategy._id); }}
                                    className="btn btn-primary text-sm"
                                    style={{ padding: '6px 12px', flexShrink: 0 }}
                                >🚀 Apply</button>
                            </div>

                            {/* Apply Project Selector */}
                            {applyProject === strategy._id && (
                                <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border)' }}>
                                    <div className="flex-row gap-8 mt-12" style={{ alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <SearchableSelect
                                                options={projectOptions}
                                                value={selectedProject}
                                                onChange={setSelectedProject}
                                                placeholder="Select a project to generate tasks..."
                                                grouped
                                            />
                                        </div>
                                        <button
                                            className="btn btn-primary text-sm"
                                            disabled={!selectedProject}
                                            onClick={() => handleApply(strategy._id)}
                                            style={{ padding: '8px 16px' }}
                                        >⚡ Generate Tasks</button>
                                        <button
                                            className="btn btn-secondary text-sm"
                                            onClick={() => { setApplyProject(null); setSelectedProject(''); }}
                                            style={{ padding: '8px 12px' }}
                                        >Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Tactics */}
                            {expanded === strategy._id && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                                    <div className="section-label mt-12 mb-8">
                                        Tactics ({(strategy.tactics as Tactic[]).length})
                                    </div>
                                    <div className="flex-col gap-6">
                                        {(strategy.tactics as Tactic[]).map((tactic: Tactic, i: number) => (
                                            <div key={tactic.id || i} style={{
                                                padding: '10px 14px', borderRadius: 8,
                                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                            }}>
                                                <div className="flex-row gap-8 flex-wrap" style={{ alignItems: 'center', marginBottom: 4 }}>
                                                    <span className="text-lg">{PLATFORM_META[tactic.platform]?.icon || '📢'}</span>
                                                    <span className="text-sm font-medium">{PLATFORM_META[tactic.platform]?.label || tactic.platform}</span>
                                                    <span className="text-xs" style={{
                                                        padding: '1px 6px', borderRadius: 4,
                                                        background: 'rgba(255,255,255,0.06)',
                                                    }}>{CONTENT_TYPE_ICONS[tactic.contentType] || '📄'} {tactic.contentType}</span>
                                                    <span className="text-xs" style={{
                                                        padding: '1px 6px', borderRadius: 4,
                                                        background: `${TONE_BADGES[tactic.tone]?.color || '#6b7280'}18`,
                                                        color: TONE_BADGES[tactic.tone]?.color || '#6b7280',
                                                    }}>{TONE_BADGES[tactic.tone]?.label || tactic.tone}</span>
                                                    <span className="text-xs text-tertiary">📡 {tactic.frequency}</span>
                                                </div>
                                                <div className="text-sm">{tactic.description}</div>
                                                <div className="text-xs text-tertiary mt-4" style={{ fontStyle: 'italic' }}>
                                                    💡 {tactic.example}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Pipeline, Calendar, Cross-Project tabs moved to ContentPage.tsx



// ═══════════════════════════════════════════════════════════════════════════
// ── CAMPAIGNS TAB ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const CAMPAIGN_STATUS = [
    { key: 'draft', label: 'Draft', icon: '📝', color: '#a78bfa' },
    { key: 'active', label: 'Active', icon: '🟢', color: '#34d399' },
    { key: 'paused', label: 'Paused', icon: '⏸️', color: '#fbbf24' },
    { key: 'completed', label: 'Completed', icon: '✅', color: '#60a5fa' },
    { key: 'cancelled', label: 'Cancelled', icon: '❌', color: '#6b7280' },
];

function CampaignsTab({ orgId }: { orgId: Id<"organizations"> | undefined }) {
    const campaigns = useQuery(api.campaigns.list, orgId ? { orgId } : 'skip');
    const strategies = useQuery(api.marketingStrategies.list, orgId ? { orgId } : 'skip');
    const createCampaign = useMutation(api.campaigns.create);
    const updateCampaign = useMutation(api.campaigns.update);
    const deleteCampaign = useMutation(api.campaigns.remove);
    const generateTasks = useMutation(api.campaigns.generateTasks);

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newStrategy, setNewStrategy] = useState('');

    const strategyOptions = useMemo(() =>
        (strategies || []).map(s => ({
            value: s._id,
            label: s.name,
            sublabel: s.projectCategory,
            icon: '📋',
        })), [strategies]
    );

    const handleCreate = async () => {
        if (!newName.trim() || !orgId) return;
        await createCampaign({
            orgId,
            name: newName.trim(),
            description: newDesc.trim(),
            strategyId: newStrategy ? newStrategy as Id<"marketingStrategies"> : undefined,
        });
        setNewName('');
        setNewDesc('');
        setNewStrategy('');
        setShowCreate(false);
    };

    const handleStatusChange = async (id: string, status: string) => {
        await updateCampaign({ campaignId: id as Id<"campaigns">, status });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this campaign?')) {
            await deleteCampaign({ campaignId: id as Id<"campaigns"> });
        }
    };

    const handleGenerateTasks = async (id: string) => {
        if (!orgId) return;
        const result = await generateTasks({ campaignId: id as Id<"campaigns">, orgId });
        alert(`Generated ${result.created} marketing tasks!`);
    };

    const allCampaigns = campaigns || [];

    return (
        <div>
            {/* Create Form */}
            <div className="flex-row gap-8 mb-16">
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Campaign</button>
            </div>

            {showCreate && (
                <div className="section-card mb-16">
                    <div className="grid-2 gap-12 mb-12">
                        <FormInput value={newName} onChange={e => setNewName(e.target.value)} placeholder="Campaign name *" />
                        <SearchableSelect options={strategyOptions} value={newStrategy} onChange={setNewStrategy} placeholder="Link strategy (optional)" />
                    </div>
                    <FormTextarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="mb-12" style={{ minHeight: 60 }} />
                    <div className="flex-row gap-12">
                        <div className="flex-1" />
                        <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
                    </div>
                </div>
            )}

            {/* Campaigns Kanban */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CAMPAIGN_STATUS.length}, minmax(180px, 1fr))`, gap: 12, overflowX: 'auto' }}>
                {CAMPAIGN_STATUS.map(col => {
                    const colCampaigns = allCampaigns.filter(c => c.status === col.key);
                    return (
                        <div key={col.key} style={{ background: `${col.color}08`, borderRadius: 12, padding: 12, minHeight: 300, border: `1px solid ${col.color}20` }}>
                            <div className="flex-row gap-6 mb-12" style={{ alignItems: 'center' }}>
                                <span>{col.icon}</span>
                                <span className="text-sm font-semibold">{col.label}</span>
                                <span className="text-xs font-semibold" style={{ padding: '1px 6px', borderRadius: 10, background: `${col.color}20`, color: col.color, marginLeft: 'auto' }}>{colCampaigns.length}</span>
                            </div>
                            <div className="flex-col gap-6">
                                {colCampaigns.map(campaign => (
                                    <div key={campaign._id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px' }}>
                                        <div className="font-medium text-sm mb-4">{campaign.name}</div>
                                        {campaign.description && <div className="text-xs text-tertiary mb-6">{campaign.description}</div>}
                                        <div className="flex-row flex-wrap gap-4 mb-6">
                                            {campaign.strategyId && <span className="text-xs" style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>📋 Strategy linked</span>}
                                            {campaign.tags.length > 0 && campaign.tags.slice(0, 3).map((tag: string) => (
                                                <span key={tag} className="tag" style={{ fontSize: 9 }}>{tag}</span>
                                            ))}
                                        </div>
                                        <div className="flex-row gap-4">
                                            {campaign.status === 'draft' && (
                                                <>
                                                    <button className="btn btn-secondary text-xs" style={{ padding: '2px 6px' }} onClick={() => handleStatusChange(campaign._id, 'active')}>▶ Start</button>
                                                    <button className="btn btn-secondary text-xs" style={{ padding: '2px 6px' }} onClick={() => handleGenerateTasks(campaign._id)} title="Generate tasks">⚡ Tasks</button>
                                                </>
                                            )}
                                            {campaign.status === 'active' && (
                                                <>
                                                    <button className="btn btn-secondary text-xs" style={{ padding: '2px 6px' }} onClick={() => handleStatusChange(campaign._id, 'paused')}>⏸️</button>
                                                    <button className="btn btn-secondary text-xs" style={{ padding: '2px 6px' }} onClick={() => handleStatusChange(campaign._id, 'completed')}>✅</button>
                                                </>
                                            )}
                                            {campaign.status === 'paused' && (
                                                <button className="btn btn-secondary text-xs" style={{ padding: '2px 6px' }} onClick={() => handleStatusChange(campaign._id, 'active')}>▶ Resume</button>
                                            )}
                                            <button onClick={() => handleDelete(campaign._id)} className="icon-btn text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', marginLeft: 'auto' }} title="Delete">✕</button>
                                        </div>
                                    </div>
                                ))}
                                {colCampaigns.length === 0 && <div className="text-sm text-tertiary text-center" style={{ padding: 24, opacity: 0.5 }}>No campaigns</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

