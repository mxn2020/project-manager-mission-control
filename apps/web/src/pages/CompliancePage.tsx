import { useState, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import type { Id } from '../lib/types';
import { getErrorMessage } from '../lib/types';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────

interface MetricResult {
    pass: boolean;
    detail: string;
}

interface ScanData {
    _id: string;
    projectId: string;
    results: string;
    passCount: number;
    totalCount: number;
    score: number;
    scannedAt: number;
}

const CATEGORIES: Record<string, string[]> = {
    "Version Control & GitHub": ["GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS"],
    "CI/CD & Workflows": ["GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT"],
    "Releases & Versioning": ["GH_RELEASES", "GH_TAGS", "CHANGELOG"],
    "NPM & Package Config": ["PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT", "NPM_PUBLISHED"],
    "UI Library": ["GEENIUS_UI", "NO_INTERNAL_UI"],
    "Documentation": ["README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT"],
    "Project Identity": ["PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML"],
    "Code Quality & Config": ["TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE", "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS"],
    "Testing": ["TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE"],
    "Deployment & Infrastructure": ["DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED"],
    "App Quality": ["ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS"],
};

const CATEGORY_ICONS: Record<string, string> = {
    "Version Control & GitHub": "🔀",
    "CI/CD & Workflows": "⚙️",
    "Releases & Versioning": "🏷️",
    "NPM & Package Config": "📦",
    "UI Library": "🎨",
    "Documentation": "📝",
    "Project Identity": "🪪",
    "Code Quality & Config": "✨",
    "Testing": "🧪",
    "Deployment & Infrastructure": "🚀",
    "App Quality": "💎",
};

const CATEGORY_LABELS: Record<string, string> = {
    'webapp': '🌐 Web App',
    'fullstack-app': '🏗️ Full-Stack',
    'monorepo-app': '📦 Monorepo',
    'oss-tool': '🔓 OSS Tool',
    'ui-package': '🎨 UI Pkg',
    'library': '📚 Library',
    'boilerplate': '🧩 Boilerplate',
    'minion-toolbox': '🤖 Toolbox',
    'backend-service': '⚙️ Backend',
    'client-project': '💼 Client',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#84cc16';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
}

function scoreBg(score: number): string {
    return scoreColor(score) + '18';
}

function scoreGradient(score: number): string {
    if (score >= 90) return 'linear-gradient(135deg, #22c55e, #16a34a)';
    if (score >= 70) return 'linear-gradient(135deg, #84cc16, #65a30d)';
    if (score >= 50) return 'linear-gradient(135deg, #eab308, #ca8a04)';
    if (score >= 30) return 'linear-gradient(135deg, #f97316, #ea580c)';
    return 'linear-gradient(135deg, #ef4444, #dc2626)';
}

function formatTime(ts: number): string {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
}

// ─── Score Badge Component ───────────────────────────────────────────────

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
    const sizes = {
        sm: { width: 36, height: 36, fontSize: 11, fontWeight: 700 },
        md: { width: 48, height: 48, fontSize: 14, fontWeight: 700 },
        lg: { width: 72, height: 72, fontSize: 22, fontWeight: 800 },
    };
    const s = sizes[size];
    return (
        <div style={{
            width: s.width, height: s.height,
            borderRadius: '50%',
            background: scoreGradient(score),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s.fontSize, fontWeight: s.fontWeight,
            color: '#fff', flexShrink: 0,
            boxShadow: `0 2px 8px ${scoreColor(score)}40`,
        }}>
            {score}%
        </div>
    );
}

// ─── Progress Bar ────────────────────────────────────────────────────────

function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
    return (
        <div style={{
            width: '100%', height, borderRadius: height / 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
            <div style={{
                width: `${value}%`, height: '100%',
                borderRadius: height / 2,
                background: scoreGradient(value),
                transition: 'width 0.6s ease',
            }} />
        </div>
    );
}

// ─── Category Score Bar ──────────────────────────────────────────────────

function CategoryScoreRow({ category, metrics, results }: {
    category: string;
    metrics: string[];
    results: Record<string, MetricResult>;
}) {
    const passed = metrics.filter(m => results[m]?.pass).length;
    const total = metrics.length;
    const pct = Math.round((passed / total) * 100);
    const icon = CATEGORY_ICONS[category] || '📊';

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--bg-secondary)',
        }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="text-sm font-medium">{category}</span>
                    <span className="text-xs" style={{ color: scoreColor(pct) }}>{passed}/{total}</span>
                </div>
                <ProgressBar value={pct} height={4} />
            </div>
        </div>
    );
}

// ─── Confirm Delete Dialog ───────────────────────────────────────────────

function ConfirmDeleteDialog({ title, itemName, onConfirm, onCancel, loading }: {
    title: string;
    itemName: string;
    onConfirm: (confirmText: string) => void;
    onCancel: () => void;
    loading: boolean;
}) {
    const [confirmText, setConfirmText] = useState('');
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onCancel}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-secondary)', borderRadius: 12,
                border: '1px solid var(--border)', padding: 24, maxWidth: 420, width: '90%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
                <h3 style={{ color: '#ef4444', marginBottom: 8 }}>⚠️ {title}</h3>
                <p className="text-sm text-tertiary" style={{ marginBottom: 16 }}>
                    This action is <strong>permanent and irreversible</strong>. Type <code style={{
                        background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4,
                        color: '#ef4444', fontWeight: 600,
                    }}>{itemName}</code> to confirm.
                </p>
                <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder={`Type "${itemName}" to confirm`}
                    style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)', fontSize: 14, marginBottom: 16,
                        boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
                    <button
                        className="btn"
                        disabled={confirmText !== itemName || loading}
                        onClick={() => onConfirm(confirmText)}
                        style={{
                            background: confirmText === itemName ? '#ef4444' : 'rgba(239,68,68,0.3)',
                            color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6,
                            cursor: confirmText === itemName ? 'pointer' : 'not-allowed',
                            fontWeight: 600,
                        }}
                    >
                        {loading ? '⏳ Deleting...' : '🗑️ Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── GitHub Actions Panel ────────────────────────────────────────────────

function GitHubActionsPanel({ project, orgId }: {
    project: { id: string; name: string; repo: string | null };
    orgId: Id<"organizations">;
}) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [repoUrl, setRepoUrl] = useState('');
    const [newRepoName, setNewRepoName] = useState(project.name);
    const [newRepoPrivate, setNewRepoPrivate] = useState(false);
    const [loading, setLoading] = useState(false);

    const linkedRepo = useQuery(api.github.getByProject, { projectId: project.id as Id<"projects"> });
    const linkRepoMut = useMutation(api.github.linkRepo);
    const unlinkRepoMut = useMutation(api.github.unlinkRepo);
    const updateProject = useMutation(api.projects.update);
    const createRepoAction = useAction(api.github.createRepo);
    const deleteRepoAction = useAction(api.github.deleteRepo);

    const repoFullName = project.repo?.replace('https://github.com/', '').replace(/\/$/, '') || '';

    const handleLink = async () => {
        setLoading(true);
        try {
            const fullName = repoUrl.replace('https://github.com/', '').replace(/\/$/, '');
            await linkRepoMut({
                orgId, repoUrl,
                repoFullName: fullName,
                defaultBranch: 'main',
                projectId: project.id as Id<"projects">,
            });
            await updateProject({
                projectId: project.id as Id<"projects">,
                repo: repoUrl,
            });
            toast.success('Repo linked');
            setShowLinkInput(false);
            setRepoUrl('');
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            const result = await createRepoAction({
                orgId,
                name: newRepoName,
                isPrivate: newRepoPrivate,
                projectId: project.id as Id<"projects">,
            });
            await updateProject({
                projectId: project.id as Id<"projects">,
                repo: result.repoUrl,
            });
            toast.success(`Created ${result.repoFullName}`);
            setShowCreateForm(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleUnlink = async () => {
        if (!linkedRepo) return;
        setLoading(true);
        try {
            await unlinkRepoMut({ repoId: linkedRepo._id });
            await updateProject({
                projectId: project.id as Id<"projects">,
                repo: undefined,
            });
            toast.success('Repo unlinked');
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleDelete = async (confirmName: string) => {
        setLoading(true);
        try {
            await deleteRepoAction({
                orgId,
                repoFullName,
                confirmName,
            });
            await updateProject({
                projectId: project.id as Id<"projects">,
                repo: undefined,
            });
            toast.success('Repo deleted');
            setShowDeleteConfirm(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    return (
        <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🐙</span>
                <span className="text-sm font-semibold">GitHub</span>
                {project.repo ? (
                    <span className="text-xs" style={{
                        background: '#22c55e18', color: '#22c55e',
                        padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>Linked</span>
                ) : (
                    <span className="text-xs" style={{
                        background: '#fbbf2418', color: '#fbbf24',
                        padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>Not linked</span>
                )}
            </div>

            {project.repo && (
                <a href={project.repo} target="_blank" rel="noreferrer" className="text-xs"
                    style={{ color: 'var(--accent)', textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                    {repoFullName}
                </a>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!project.repo && (
                    <>
                        <button className="btn btn-secondary text-xs" onClick={() => setShowLinkInput(true)} style={{ padding: '4px 10px', borderRadius: 6 }}>
                            🔗 Link Repo
                        </button>
                        <button className="btn btn-primary text-xs" onClick={() => setShowCreateForm(true)} style={{ padding: '4px 10px', borderRadius: 6 }}>
                            ✨ Create Repo
                        </button>
                    </>
                )}
                {project.repo && (
                    <>
                        <button className="btn btn-secondary text-xs" onClick={() => setShowLinkInput(true)} style={{ padding: '4px 10px', borderRadius: 6 }}>
                            🔄 Update Link
                        </button>
                        <button className="btn btn-secondary text-xs" onClick={handleUnlink} disabled={loading} style={{ padding: '4px 10px', borderRadius: 6 }}>
                            🔓 Unlink
                        </button>
                        <button className="text-xs" onClick={() => setShowDeleteConfirm(true)} style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                            cursor: 'pointer', fontWeight: 600,
                        }}>
                            🗑️ Delete
                        </button>
                    </>
                )}
            </div>

            {/* Link Input */}
            {showLinkInput && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input
                        type="text" value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        style={{
                            flex: 1, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: 12,
                        }}
                    />
                    <button className="btn btn-primary text-xs" onClick={handleLink} disabled={loading || !repoUrl}
                        style={{ padding: '6px 12px', borderRadius: 6 }}>
                        {loading ? '⏳' : '✓'}
                    </button>
                    <button className="btn btn-secondary text-xs" onClick={() => { setShowLinkInput(false); setRepoUrl(''); }}
                        style={{ padding: '6px 8px', borderRadius: 6 }}>✕</button>
                </div>
            )}

            {/* Create Form */}
            {showCreateForm && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                        type="text" value={newRepoName} onChange={e => setNewRepoName(e.target.value)}
                        placeholder="Repository name"
                        style={{
                            padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: 12,
                        }}
                    />
                    <div className="text-xs text-tertiary" style={{ fontFamily: 'monospace' }}>
                        Slug: {newRepoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}
                    </div>
                    <label className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={newRepoPrivate} onChange={e => setNewRepoPrivate(e.target.checked)} />
                        Private repository
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary text-xs" onClick={handleCreate} disabled={loading || !newRepoName}
                            style={{ padding: '6px 12px', borderRadius: 6 }}>
                            {loading ? '⏳ Creating...' : '✨ Create'}
                        </button>
                        <button className="btn btn-secondary text-xs" onClick={() => setShowCreateForm(false)}
                            style={{ padding: '6px 8px', borderRadius: 6 }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && repoFullName && (
                <ConfirmDeleteDialog
                    title="Delete GitHub Repository"
                    itemName={repoFullName.split('/').pop() || ''}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                    loading={loading}
                />
            )}
        </div>
    );
}

// ─── Vercel Actions Panel ────────────────────────────────────────────────

function VercelActionsPanel({ project, orgId }: {
    project: { id: string; name: string; vercelProjectId?: string; repo: string | null };
    orgId: Id<"organizations">;
}) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDeployments, setShowDeployments] = useState(false);
    const [vercelProjId, setVercelProjId] = useState('');
    const [newProjName, setNewProjName] = useState(project.name);
    const [loading, setLoading] = useState(false);
    const [deployments, setDeployments] = useState<Array<{
        id: string; url: string; state: string; created: number;
        target?: string; commitMessage?: string;
    }>>([]);

    const vercelConnection = useQuery(api.vercel.getVercelConnection, { orgId });
    const linkVercel = useMutation(api.vercel.linkProject);
    const unlinkVercel = useMutation(api.vercel.unlinkProject);
    const createVercelProject = useAction(api.vercel.createProject);
    const deleteVercelProject = useAction(api.vercel.deleteProject);
    const deployAction = useAction(api.vercel.deploy);
    const getDeploymentsAction = useAction(api.vercel.getDeployments);

    const isConnected = vercelConnection?.connected ?? false;

    const handleLink = async () => {
        setLoading(true);
        try {
            await linkVercel({ projectId: project.id as Id<"projects">, vercelProjectId: vercelProjId });
            toast.success('Vercel project linked');
            setShowLinkInput(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            const repoFullName = project.repo?.replace('https://github.com/', '').replace(/\/$/, '');
            const result = await createVercelProject({
                orgId, name: newProjName,
                gitRepo: repoFullName || undefined,
            });
            await linkVercel({ projectId: project.id as Id<"projects">, vercelProjectId: result.id });
            toast.success(`Created Vercel project: ${result.name}`);
            setShowCreateForm(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleUnlink = async () => {
        setLoading(true);
        try {
            await unlinkVercel({ projectId: project.id as Id<"projects"> });
            toast.success('Vercel project unlinked');
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleDeploy = async () => {
        if (!project.vercelProjectId) return;
        setLoading(true);
        try {
            const repoFullName = project.repo?.replace('https://github.com/', '').replace(/\/$/, '');
            const result = await deployAction({
                orgId, vercelProjectId: project.vercelProjectId,
                gitRepo: repoFullName || undefined,
            });
            toast.success(`Deployment started: ${result.url}`);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleViewDeployments = async () => {
        if (!project.vercelProjectId) return;
        setLoading(true);
        try {
            const deps = await getDeploymentsAction({
                orgId, vercelProjectId: project.vercelProjectId, limit: 5,
            });
            setDeployments(deps);
            setShowDeployments(true);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    const handleDelete = async (confirmName: string) => {
        if (!project.vercelProjectId) return;
        setLoading(true);
        try {
            await deleteVercelProject({
                orgId, vercelProjectId: project.vercelProjectId, confirmName,
            });
            await unlinkVercel({ projectId: project.id as Id<"projects"> });
            toast.success('Vercel project deleted');
            setShowDeleteConfirm(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setLoading(false);
    };

    return (
        <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>▲</span>
                <span className="text-sm font-semibold">Vercel</span>
                {!isConnected ? (
                    <span className="text-xs" style={{
                        background: 'rgba(107,114,128,0.15)', color: '#6b7280',
                        padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>Not connected</span>
                ) : project.vercelProjectId ? (
                    <span className="text-xs" style={{
                        background: '#22c55e18', color: '#22c55e',
                        padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>Linked</span>
                ) : (
                    <span className="text-xs" style={{
                        background: '#fbbf2418', color: '#fbbf24',
                        padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>Not linked</span>
                )}
            </div>

            {!isConnected && (
                <p className="text-xs text-tertiary">Connect Vercel in Integrations to manage deployments.</p>
            )}

            {isConnected && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!project.vercelProjectId && (
                        <>
                            <button className="btn btn-secondary text-xs" onClick={() => setShowLinkInput(true)}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>🔗 Link</button>
                            <button className="btn btn-primary text-xs" onClick={() => setShowCreateForm(true)}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>✨ Create</button>
                        </>
                    )}
                    {project.vercelProjectId && (
                        <>
                            <button className="btn btn-primary text-xs" onClick={handleDeploy} disabled={loading}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>
                                {loading ? '⏳' : '🚀'} Deploy
                            </button>
                            <button className="btn btn-secondary text-xs" onClick={handleViewDeployments} disabled={loading}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>📋 Logs</button>
                            <button className="btn btn-secondary text-xs" onClick={() => setShowLinkInput(true)}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>🔄 Update</button>
                            <button className="btn btn-secondary text-xs" onClick={handleUnlink} disabled={loading}
                                style={{ padding: '4px 10px', borderRadius: 6 }}>🔓 Unlink</button>
                            <button className="text-xs" onClick={() => setShowDeleteConfirm(true)} style={{
                                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                cursor: 'pointer', fontWeight: 600,
                            }}>🗑️ Delete</button>
                        </>
                    )}
                </div>
            )}

            {/* Link Input */}
            {showLinkInput && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input type="text" value={vercelProjId} onChange={e => setVercelProjId(e.target.value)}
                        placeholder="Vercel Project ID"
                        style={{
                            flex: 1, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: 12,
                        }} />
                    <button className="btn btn-primary text-xs" onClick={handleLink} disabled={loading || !vercelProjId}
                        style={{ padding: '6px 12px', borderRadius: 6 }}>{loading ? '⏳' : '✓'}</button>
                    <button className="btn btn-secondary text-xs" onClick={() => { setShowLinkInput(false); setVercelProjId(''); }}
                        style={{ padding: '6px 8px', borderRadius: 6 }}>✕</button>
                </div>
            )}

            {/* Create Form */}
            {showCreateForm && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="text" value={newProjName} onChange={e => setNewProjName(e.target.value)}
                        placeholder="Vercel project name"
                        style={{
                            padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: 12,
                        }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary text-xs" onClick={handleCreate} disabled={loading || !newProjName}
                            style={{ padding: '6px 12px', borderRadius: 6 }}>{loading ? '⏳ Creating...' : '✨ Create'}</button>
                        <button className="btn btn-secondary text-xs" onClick={() => setShowCreateForm(false)}
                            style={{ padding: '6px 8px', borderRadius: 6 }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Deployments Panel */}
            {showDeployments && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div className="text-xs font-semibold" style={{ marginBottom: 6 }}>Recent Deployments</div>
                    {deployments.length === 0 ? (
                        <span className="text-xs text-tertiary">No deployments found</span>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {deployments.map(d => (
                                <div key={d.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '4px 8px', borderRadius: 4,
                                    background: 'var(--bg-primary)', fontSize: 11,
                                }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: d.state === 'READY' ? '#22c55e' : d.state === 'ERROR' ? '#ef4444' : '#eab308',
                                    }} />
                                    <a href={`https://${d.url}`} target="_blank" rel="noreferrer"
                                        style={{ color: 'var(--accent)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.url}
                                    </a>
                                    <span className="text-tertiary">{d.target || ''}</span>
                                    <span className="text-tertiary">{formatTime(d.created)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="text-xs text-tertiary" onClick={() => setShowDeployments(false)}
                        style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Close
                    </button>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && project.vercelProjectId && (
                <ConfirmDeleteDialog
                    title="Delete Vercel Project"
                    itemName={project.name}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                    loading={loading}
                />
            )}
        </div>
    );
}

// ─── Project Compliance Card ─────────────────────────────────────────────

function ProjectComplianceCard({ project, scan, orgId, onScan }: {
    project: {
        id: string; name: string; tier: string; lane: string;
        repo: string | null; deploy_url: string | null;
        project_type?: string; vercelProjectId?: string;
        projectCategory?: string;
    };
    scan: ScanData | undefined;
    orgId: Id<"organizations">;
    onScan: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const results: Record<string, MetricResult> = useMemo(() => {
        if (!scan?.results) return {};
        try { return JSON.parse(scan.results); } catch { return {}; }
    }, [scan?.results]);

    const score = scan?.score ?? -1;
    const hasResults = score >= 0;

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: `1px solid ${hasResults ? scoreColor(score) + '20' : 'var(--border)'}`,
            overflow: 'hidden',
            transition: 'border-color 0.3s',
        }}>
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', cursor: 'pointer',
                    transition: 'background 0.2s',
                }}
            >
                {hasResults ? (
                    <ScoreBadge score={score} size="sm" />
                ) : (
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(107,114,128,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                    }}>—</div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="font-semibold text-md">{project.name}</span>
                        <span className="text-xs" style={{
                            padding: '1px 6px', borderRadius: 4,
                            background: 'var(--bg-primary)', color: 'var(--text-tertiary)',
                        }}>{project.tier}</span>
                        <span className="text-xs text-tertiary">{project.lane}</span>
                        {project.projectCategory && (
                            <span className="text-xs" style={{
                                padding: '1px 6px', borderRadius: 4,
                                background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                                fontWeight: 500,
                            }}>{CATEGORY_LABELS[project.projectCategory] || project.projectCategory}</span>
                        )}
                    </div>
                    {hasResults && (
                        <div style={{ marginTop: 4 }}>
                            <ProgressBar value={score} height={3} />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {scan && (
                        <span className="text-xs text-tertiary">{formatTime(scan.scannedAt)}</span>
                    )}
                    <span style={{ opacity: 0.4, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>
            </div>

            {/* Expanded Detail */}
            {expanded && (
                <div style={{
                    padding: '0 16px 16px',
                    borderTop: '1px solid var(--border)',
                }}>
                    {/* Category Scores */}
                    {hasResults && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {Object.entries(CATEGORIES).map(([cat, metrics]) => (
                                <CategoryScoreRow key={cat} category={cat} metrics={metrics} results={results} />
                            ))}
                        </div>
                    )}

                    {/* Metrics Grid */}
                    {hasResults && (
                        <div style={{ marginTop: 12 }}>
                            <div className="text-xs font-semibold" style={{ marginBottom: 8 }}>All Metrics</div>
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: 4,
                            }}>
                                {Object.entries(results).map(([id, result]) => (
                                    <div key={id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '4px 8px', borderRadius: 4,
                                        background: result.pass ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                                        fontSize: 11,
                                    }}>
                                        <span>{result.pass ? '✅' : '❌'}</span>
                                        <span style={{
                                            fontFamily: 'monospace', fontWeight: 600,
                                            color: result.pass ? '#22c55e' : '#ef4444',
                                            minWidth: 140,
                                        }}>{id}</span>
                                        <span className="text-tertiary" style={{
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{result.detail}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!hasResults && (
                        <div className="text-sm text-tertiary" style={{ padding: '16px 0', textAlign: 'center' }}>
                            No scan data. Click "Scan" to analyze compliance.
                        </div>
                    )}

                    {/* GitHub & Vercel Panels */}
                    <div style={{
                        marginTop: 16, display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8,
                    }}>
                        <GitHubActionsPanel
                            project={{ id: project.id, name: project.name, repo: project.repo }}
                            orgId={orgId}
                        />
                        <VercelActionsPanel
                            project={{
                                id: project.id, name: project.name,
                                vercelProjectId: project.vercelProjectId, repo: project.repo,
                            }}
                            orgId={orgId}
                        />
                    </div>

                    {/* Scan Button */}
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                        <button className="btn btn-primary text-xs" onClick={onScan}
                            style={{ padding: '6px 14px', borderRadius: 6 }}>
                            🔍 Re-scan Project
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function CompliancePage() {
    const { orgId } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;
    const { data } = useProjects();
    const scans = useQuery(api.compliance.listScans, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const summary = useQuery(api.compliance.getOrgComplianceSummary, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const scanProject = useAction(api.compliance.scanProject);

    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanTotal, setScanTotal] = useState(0);
    const [scanFailed, setScanFailed] = useState(0);
    const [scanningProject, setScanningProject] = useState<string | null>(null);
    const [filterLane, setFilterLane] = useState('');
    const [filterScore, setFilterScore] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const projects = data?.projects || [];
    const lanes = useMemo(() => [...new Set(projects.map(p => p.lane))].sort(), [projects]);

    // Build scan lookup
    const scanMap = useMemo(() => {
        const map = new Map<string, ScanData>();
        if (scans) {
            for (const s of scans) {
                map.set(s.projectId, s as ScanData);
            }
        }
        return map;
    }, [scans]);

    // Filter projects
    const filteredProjects = useMemo(() => {
        let list = [...projects];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.lane.toLowerCase().includes(q));
        }
        if (filterLane) {
            list = list.filter(p => p.lane === filterLane);
        }
        if (filterScore) {
            list = list.filter(p => {
                const scan = scanMap.get((p as unknown as { id: string }).id);
                if (!scan) return filterScore === 'unscanned';
                if (filterScore === '100') return scan.score === 100;
                if (filterScore === '70-99') return scan.score >= 70 && scan.score < 100;
                if (filterScore === '50-69') return scan.score >= 50 && scan.score < 70;
                if (filterScore === '<50') return scan.score < 50;
                return true;
            });
        }

        // Sort by score (lowest first = most work needed)
        list.sort((a, b) => {
            const sa = scanMap.get((a as unknown as { id: string }).id)?.score ?? -1;
            const sb = scanMap.get((b as unknown as { id: string }).id)?.score ?? -1;
            return sa - sb;
        });

        return list;
    }, [projects, searchQuery, filterLane, filterScore, scanMap]);

    const BATCH_SIZE = 6; // parallel concurrency

    const handleScanAll = async () => {
        if (!typedOrgId) return;
        const projectList = projects.map(p => ({ id: (p as unknown as { id: string }).id, name: p.name }));
        if (projectList.length === 0) return;

        setScanning(true);
        setScanProgress(0);
        setScanTotal(projectList.length);
        setScanFailed(0);

        let failed = 0;

        // Process in parallel batches
        for (let i = 0; i < projectList.length; i += BATCH_SIZE) {
            const batch = projectList.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (p) => {
                    try {
                        await scanProject({ orgId: typedOrgId, projectId: p.id as Id<"projects"> });
                    } catch {
                        // Retry once after 1s delay
                        await new Promise(r => setTimeout(r, 1000));
                        try {
                            await scanProject({ orgId: typedOrgId, projectId: p.id as Id<"projects"> });
                        } catch {
                            throw new Error(`Failed: ${p.name}`);
                        }
                    }
                })
            );

            const batchFailed = results.filter(r => r.status === 'rejected').length;
            failed += batchFailed;
            setScanProgress(prev => prev + batch.length);
            setScanFailed(failed);
        }

        setScanning(false);
        toast.success(`Scanned ${projectList.length} projects${failed > 0 ? ` (${failed} failed)` : ''}`);
    };

    const handleScanProject = async (projectId: string) => {
        if (!typedOrgId) return;
        setScanningProject(projectId);
        try {
            const result = await scanProject({ orgId: typedOrgId, projectId: projectId as Id<"projects"> });
            toast.success(`Score: ${result.score}% (${result.passCount}/${result.totalCount})`);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
        setScanningProject(null);
    };

    // Summary stats
    const avgScore = summary?.avgScore ?? 0;
    const perfectCount = summary?.perfectCount ?? 0;
    const totalScanned = summary?.totalProjects ?? 0;
    const topFailures = summary?.metricFailures
        ? Object.entries(summary.metricFailures).sort((a, b) => b[1] - a[1]).slice(0, 5)
        : [];

    return (
        <div>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">📏 Compliance Gap Analysis</h1>
                        <p className="page-description">
                            Scan all projects against 60 compliance metrics. Goal: 100% across the board.
                        </p>
                    </div>
                    <div className="flex-row gap-8">
                        <button
                            className="btn btn-primary"
                            onClick={handleScanAll}
                            disabled={scanning}
                            style={{ fontWeight: 600 }}
                        >
                            {scanning ? '⏳ Scanning All...' : '🔍 Run Full Scan'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Scan Progress Bar ────────────────────────────── */}
            {scanning && scanTotal > 0 && (
                <div className="mb-20" style={{
                    padding: '16px 20px', borderRadius: 12,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                }}>
                    <div className="flex-between mb-8">
                        <span className="font-semibold text-md">
                            🔍 Scanning {scanProgress}/{scanTotal} projects...
                        </span>
                        <span className="font-mono text-sm text-tertiary">
                            {Math.round((scanProgress / scanTotal) * 100)}%
                            {scanFailed > 0 && <span style={{ color: '#f87171', marginLeft: 8 }}>⚠ {scanFailed} failed</span>}
                        </span>
                    </div>
                    <div style={{
                        width: '100%', height: 8, borderRadius: 4,
                        background: 'var(--bg-primary)', overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${(scanProgress / scanTotal) * 100}%`,
                            height: '100%', borderRadius: 4,
                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>
                    <div className="text-xs text-tertiary mt-4">
                        Running {BATCH_SIZE} scans in parallel with automatic retry
                    </div>
                </div>
            )}

            {/* ── Summary Grid ───────────────────────────────────── */}
            <div className="grid-auto gap-12 mb-24">
                <div className="stat-card" style={{ borderLeft: `3px solid ${scoreColor(avgScore)}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ScoreBadge score={avgScore} size="lg" />
                        <div>
                            <div className="stat-label">Average Score</div>
                            <div className="text-sm text-tertiary">{totalScanned} projects scanned</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#22c55e' }}>{perfectCount}</div>
                    <div className="stat-label">At 100%</div>
                    <div className="text-xs text-tertiary">
                        {totalScanned > 0 ? Math.round((perfectCount / totalScanned) * 100) : 0}% of total
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{projects.length}</div>
                    <div className="stat-label">Total Projects</div>
                    <div className="text-xs text-tertiary">
                        {projects.length - totalScanned} unscanned
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: '#ef4444' }}>60</div>
                    <div className="stat-label">Metrics Tracked</div>
                    <div className="text-xs text-tertiary">11 categories</div>
                </div>
            </div>

            {/* ── Top Failures ────────────────────────────────────── */}
            {topFailures.length > 0 && (
                <div className="mb-24" style={{
                    padding: 16, borderRadius: 10,
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.15)',
                }}>
                    <div className="text-sm font-semibold" style={{ marginBottom: 8, color: '#ef4444' }}>
                        🔥 Most Common Failures
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {topFailures.map(([metric, count]) => (
                            <span key={metric} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 6,
                                background: 'rgba(239,68,68,0.1)',
                                fontSize: 12, fontFamily: 'monospace',
                                color: '#ef4444', fontWeight: 600,
                            }}>
                                {metric}
                                <span style={{
                                    background: '#ef4444', color: '#fff',
                                    borderRadius: 8, padding: '0 5px',
                                    fontSize: 10, fontWeight: 700,
                                }}>{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Category Heatmap ────────────────────────────────── */}
            {totalScanned > 0 && (
                <div className="mb-24" style={{
                    padding: 16, borderRadius: 10,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                }}>
                    <div className="text-sm font-semibold" style={{ marginBottom: 12 }}>
                        📊 Category Overview
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {Object.entries(CATEGORIES).map(([cat, metrics]) => {
                            // Calculate overall pass rate for this category
                            let totalPass = 0;
                            let totalChecked = 0;
                            scans?.forEach(scan => {
                                try {
                                    const res = JSON.parse(scan.results) as Record<string, MetricResult>;
                                    metrics.forEach(m => {
                                        if (res[m]) {
                                            totalChecked++;
                                            if (res[m].pass) totalPass++;
                                        }
                                    });
                                } catch { /* skip */ }
                            });
                            const pct = totalChecked > 0 ? Math.round((totalPass / totalChecked) * 100) : 0;

                            return (
                                <div key={cat} style={{
                                    padding: '8px 12px', borderRadius: 8,
                                    background: scoreBg(pct),
                                    border: `1px solid ${scoreColor(pct)}20`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="text-xs font-medium" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {CATEGORY_ICONS[cat]} {cat}
                                        </span>
                                        <span className="text-sm font-bold" style={{ color: scoreColor(pct) }}>
                                            {pct}%
                                        </span>
                                    </div>
                                    <ProgressBar value={pct} height={3} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Filters ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="text" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="🔎 Search projects..."
                    style={{
                        padding: '7px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: 13, minWidth: 200,
                    }}
                />
                <select
                    value={filterLane} onChange={e => setFilterLane(e.target.value)}
                    style={{
                        padding: '7px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: 13,
                    }}
                >
                    <option value="">All Lanes</option>
                    {lanes.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                    value={filterScore} onChange={e => setFilterScore(e.target.value)}
                    style={{
                        padding: '7px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: 13,
                    }}
                >
                    <option value="">All Scores</option>
                    <option value="100">💯 100%</option>
                    <option value="70-99">🟢 70–99%</option>
                    <option value="50-69">🟡 50–69%</option>
                    <option value="<50">🔴 Below 50%</option>
                    <option value="unscanned">⬜ Unscanned</option>
                </select>
                <span className="text-sm text-tertiary">
                    {filteredProjects.length} of {projects.length} projects
                </span>
            </div>

            {/* ── Project List ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredProjects.map(p => {
                    const pId = (p as unknown as { id: string }).id;
                    return (
                        <ProjectComplianceCard
                            key={pId}
                            project={{
                                id: pId,
                                name: p.name,
                                tier: p.tier,
                                lane: p.lane,
                                repo: p.repo,
                                deploy_url: p.deploy_url,
                                project_type: (p as unknown as { project_type?: string }).project_type,
                                vercelProjectId: (p as unknown as { vercelProjectId?: string }).vercelProjectId,
                                projectCategory: (p as unknown as { projectCategory?: string }).projectCategory,
                            }}
                            scan={scanMap.get(pId)}
                            orgId={typedOrgId!}
                            onScan={() => handleScanProject(pId)}
                        />
                    );
                })}
            </div>

            {filteredProjects.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: 40,
                    color: 'var(--text-tertiary)', fontSize: 14,
                }}>
                    {projects.length === 0 ? 'No projects found. Create a project first.' : 'No projects match your filters.'}
                </div>
            )}
        </div>
    );
}
