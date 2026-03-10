import { useState, useEffect, useCallback } from 'react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';
import { getErrorMessage } from '../lib/types';
import SearchableSelect, { type SelectOption } from './SearchableSelect';
import { TIER_ORDER, PRIORITY_ORDER, TIER_CONFIG, PRIORITY_CONFIG } from '../lib/types';
import toast from 'react-hot-toast';

interface CloneProjectModalProps {
    onClose: () => void;
    onCreated: (projectId: string) => void;
    lanes: string[];
}

export default function CloneProjectModal({ onClose, onCreated, lanes }: CloneProjectModalProps) {
    const { user, orgId } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;

    // Check if GitHub is connected
    const githubConnection = useQuery(api.github.getGithubConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const vercelConnection = useQuery(api.vercel.getVercelConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');

    // Form state
    const [name, setName] = useState('');
    const [lane, setLane] = useState('');
    const [tier, setTier] = useState('idea');
    const [priority, setPriority] = useState('medium');
    const [description, setDescription] = useState('');
    const [repoName, setRepoName] = useState('');
    const [isPrivate, setIsPrivate] = useState(true);
    const [deployToVercel, setDeployToVercel] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Repo availability check
    const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
    const [repoSlug, setRepoSlug] = useState('');
    const [repoFullName, setRepoFullName] = useState('');
    const [repoError, setRepoError] = useState('');
    const [checkTimer, setCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const createProject = useMutation(api.projects.create);
    const createRepo = useAction(api.github.createRepo);
    const checkAvailability = useAction(api.github.checkRepoAvailability);
    const createVercelProject = useAction(api.vercel.createProject);
    const deployVercel = useAction(api.vercel.deploy);

    const laneOptions: SelectOption[] = [...new Set(lanes)].sort().map(l => ({ value: l, label: l }));
    const tierOptions: SelectOption[] = TIER_ORDER.map(t => ({
        value: t, label: TIER_CONFIG[t].label, icon: TIER_CONFIG[t].emoji,
    }));
    const priorityOptions: SelectOption[] = PRIORITY_ORDER.map(p => ({
        value: p, label: PRIORITY_CONFIG[p].label,
    }));

    // Debounced repo name check
    const checkRepoName = useCallback(async (repoNameValue: string) => {
        if (!typedOrgId || !repoNameValue.trim()) {
            setRepoCheckStatus('idle');
            return;
        }

        setRepoCheckStatus('checking');
        try {
            const result = await checkAvailability({
                orgId: typedOrgId,
                name: repoNameValue,
            }) as { available: boolean; slug: string; fullName: string; error?: string };

            setRepoSlug(result.slug);
            setRepoFullName(result.fullName);
            if (result.available) {
                setRepoCheckStatus('available');
                setRepoError('');
            } else {
                setRepoCheckStatus('taken');
                setRepoError(result.error || 'Name taken');
            }
        } catch (err) {
            setRepoCheckStatus('error');
            setRepoError(getErrorMessage(err));
        }
    }, [typedOrgId, checkAvailability]);

    useEffect(() => {
        if (checkTimer) clearTimeout(checkTimer);
        if (!repoName.trim()) {
            setRepoCheckStatus('idle');
            return;
        }
        const timer = setTimeout(() => checkRepoName(repoName), 500);
        setCheckTimer(timer);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoName]);

    // Auto-generate repo name from project name
    useEffect(() => {
        if (!repoName || repoName === slugify(name.slice(0, -1))) {
            setRepoName(slugify(name));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    const handleSubmit = async () => {
        if (!name.trim() || !lane) { setError('Name and lane are required'); return; }
        if (!typedOrgId) { setError('Organization not found'); return; }
        if (!repoName.trim()) { setError('Repository name is required'); return; }
        if (repoCheckStatus !== 'available') { setError('Choose an available repo name'); return; }

        setSubmitting(true);
        setError('');
        try {
            // 1. Create the project in our DB
            const newProjectId = await createProject({
                orgId: typedOrgId,
                name: name.trim(),
                lane,
                tier,
                priority,
                description: description.trim(),
                stack: [],
                oss: !isPrivate,
            });

            // 2. Create the GitHub repo
            toast.loading('Creating GitHub repository...', { id: 'clone-progress' });
            const repoResult = await createRepo({
                orgId: typedOrgId,
                name: repoName,
                description: description.trim(),
                isPrivate,
                projectId: newProjectId as Id<"projects">,
            }) as { repoFullName: string; repoUrl: string; slug: string };

            toast.loading('Repository created!', { id: 'clone-progress' });

            // 3. Optionally deploy to Vercel
            if (deployToVercel && vercelConnection?.connected) {
                toast.loading('Creating Vercel project...', { id: 'clone-progress' });
                const vercelProject = await createVercelProject({
                    orgId: typedOrgId,
                    name: repoResult.slug,
                    gitRepo: repoResult.repoFullName,
                }) as { id: string; name: string };

                toast.loading('Deploying to Vercel (preview)...', { id: 'clone-progress' });
                await deployVercel({
                    orgId: typedOrgId,
                    vercelProjectId: vercelProject.id,
                    gitRepo: repoResult.repoFullName,
                    branch: 'main',
                });

                toast.success('Project created, repo cloned & deployed! 🚀', { id: 'clone-progress' });
            } else {
                toast.success('Project created & repo cloned! 🎉', { id: 'clone-progress' });
            }

            onCreated(newProjectId as string);
            onClose();
        } catch (err) {
            toast.dismiss('clone-progress');
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    // If GitHub is not connected, show connect prompt
    if (githubConnection && !githubConnection.connected) {
        return (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="modal-content" style={{ maxWidth: 460 }}>
                    <div className="modal-header">
                        <h2 className="modal-title">🔗 Clone Project</h2>
                        <button onClick={onClose} className="icon-btn text-tertiary text-2xl">✕</button>
                    </div>
                    <div className="modal-body flex-col gap-16" style={{ textAlign: 'center', padding: '32px 24px' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
                        <p className="text-base text-secondary" style={{ lineHeight: 1.6 }}>
                            Connect your GitHub account to clone projects and create repositories.
                        </p>
                        <a href="/integrations" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            🔗 Go to Integrations
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const repoStatusIcon = repoCheckStatus === 'checking' ? '⏳' :
        repoCheckStatus === 'available' ? '✅' :
        repoCheckStatus === 'taken' ? '❌' :
        repoCheckStatus === 'error' ? '⚠️' : '';

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-content" style={{ maxWidth: 560 }}>
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">🔗 Clone Project</h2>
                    <button onClick={onClose} className="icon-btn text-tertiary text-2xl">✕</button>
                </div>

                {/* Form */}
                <div className="modal-body flex-col gap-16">
                    {/* Name + Lane */}
                    <div className="grid-2 gap-12">
                        <div>
                            <label className="form-label">Project Name *</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-awesome-project"
                                className="form-input" />
                        </div>
                        <div>
                            <label className="form-label">Lane *</label>
                            <SearchableSelect options={laneOptions} value={lane} onChange={setLane} placeholder="Select lane..." allowCreate onCreateNew={setLane} clearable={false} />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="form-label">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this project do?"
                            rows={2} className="form-textarea" />
                    </div>

                    {/* Tier + Priority */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        <div>
                            <label className="form-label">Tier</label>
                            <SearchableSelect options={tierOptions} value={tier} onChange={setTier} placeholder="Tier" clearable={false} />
                        </div>
                        <div>
                            <label className="form-label">Priority</label>
                            <SearchableSelect options={priorityOptions} value={priority} onChange={setPriority} placeholder="Priority" clearable={false} />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPrivate(!isPrivate)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                                background: isPrivate ? 'var(--accent)' : 'var(--bg-primary)',
                                color: isPrivate ? '#fff' : 'var(--text-secondary)',
                                border: `1px solid ${isPrivate ? 'var(--accent)' : 'var(--border)'}`,
                                fontSize: 13, fontWeight: 500, transition: 'all 0.2s ease',
                            }}
                        >
                            {isPrivate ? '🔒' : '🌍'} {isPrivate ? 'Private' : 'Public'}
                        </button>
                    </div>

                    {/* Repo Name */}
                    <div>
                        <label className="form-label">GitHub Repository Name * {repoStatusIcon}</label>
                        <input value={repoName} onChange={e => setRepoName(e.target.value)}
                            placeholder="my-repo-name"
                            className="form-input"
                            style={{
                                borderColor: repoCheckStatus === 'available' ? 'var(--success)' :
                                    repoCheckStatus === 'taken' ? 'var(--error)' : undefined
                            }}
                        />
                        {repoCheckStatus === 'available' && (
                            <div className="text-xs mt-4" style={{ color: 'var(--success)' }}>
                                ✅ {repoFullName} is available
                            </div>
                        )}
                        {repoCheckStatus === 'taken' && (
                            <div className="text-xs mt-4" style={{ color: 'var(--error)' }}>
                                ❌ {repoError}
                            </div>
                        )}
                        {repoCheckStatus === 'error' && (
                            <div className="text-xs mt-4" style={{ color: 'var(--warning)' }}>
                                ⚠️ {repoError}
                            </div>
                        )}
                        {repoSlug && repoSlug !== repoName && repoCheckStatus !== 'idle' && (
                            <div className="text-xs text-tertiary mt-4">
                                Slug: <code>{repoSlug}</code>
                            </div>
                        )}
                    </div>

                    {/* Deploy to Vercel */}
                    <div
                        onClick={() => vercelConnection?.connected && setDeployToVercel(!deployToVercel)}
                        style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: deployToVercel ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-primary)',
                            border: `1px solid ${deployToVercel ? 'var(--accent)' : 'var(--border)'}`,
                            cursor: vercelConnection?.connected ? 'pointer' : 'default',
                            opacity: vercelConnection?.connected ? 1 : 0.5,
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {/* Toggle Switch */}
                        <div style={{
                            width: 44, height: 24, borderRadius: 12,
                            background: deployToVercel ? 'var(--accent)' : 'var(--bg-tertiary, #3f3f46)',
                            position: 'relative', flexShrink: 0,
                            transition: 'background 0.2s ease',
                        }}>
                            <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#fff',
                                position: 'absolute', top: 3,
                                left: deployToVercel ? 23 : 3,
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="text-base font-semibold">▲ Deploy to Vercel</div>
                            {vercelConnection?.connected ? (
                                <div className="text-xs text-tertiary" style={{ marginTop: 2 }}>Creates a Vercel project and deploys the preview branch</div>
                            ) : (
                                <div className="text-xs text-tertiary" style={{ marginTop: 2 }}>
                                    <a href="/integrations" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}>Connect Vercel</a> to enable deployments
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-base" style={{ padding: '8px 12px', background: '#f8717115', borderRadius: 6, color: '#f87171' }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !name.trim() || !lane || repoCheckStatus !== 'available'}
                    >
                        {submitting ? '⏳ Creating...' : '🔗 Clone & Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function slugify(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
