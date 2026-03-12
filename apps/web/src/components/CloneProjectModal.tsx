import { useState, useEffect, useCallback } from 'react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import type { Id } from '../lib/types';
import { getErrorMessage } from '../lib/types';
import SearchableSelect, { type SelectOption } from './SearchableSelect';
import { TIER_ORDER, PRIORITY_ORDER, TIER_CONFIG, PRIORITY_CONFIG } from '../lib/types';
import toast from 'react-hot-toast';
import { FormInput, FormTextarea } from './ui';

const CATEGORY_OPTIONS: SelectOption[] = [
    { value: 'webapp', label: 'Web App', icon: '🌐' },
    { value: 'fullstack-app', label: 'Full-Stack App', icon: '🏗️' },
    { value: 'monorepo-app', label: 'Monorepo App', icon: '📦' },
    { value: 'oss-tool', label: 'Open Source Tool', icon: '🔓' },
    { value: 'ui-package', label: 'UI Package', icon: '🎨' },
    { value: 'library', label: 'Library / Package', icon: '📚' },
    { value: 'boilerplate', label: 'Boilerplate / Template', icon: '🧩' },
    { value: 'minion-toolbox', label: 'Minion Toolbox', icon: '🤖' },
    { value: 'backend-service', label: 'Backend Service', icon: '⚙️' },
    { value: 'client-project', label: 'Client Project', icon: '💼' },
];

interface CloneProjectModalProps {
    onClose: () => void;
    onCreated: (projectId: string) => void;
    lanes: string[];
}

interface RepoInfo {
    fullName: string;
    url: string;
    defaultBranch: string;
    isPrivate: boolean;
    description: string | null;
    isLinked: boolean;
}

export default function CloneProjectModal({ onClose, onCreated, lanes }: CloneProjectModalProps) {
    const { orgId } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;

    // Connections
    const githubConnection = useQuery(api.github.getGithubConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');
    const vercelConnection = useQuery(api.vercel.getVercelConnection, typedOrgId ? { orgId: typedOrgId } : 'skip');

    // Form state
    const [name, setName] = useState('');
    const [lane, setLane] = useState('');
    const [tier, setTier] = useState('idea');
    const [priority, setPriority] = useState('medium');
    const [description, setDescription] = useState('');
    const [selectedRepo, setSelectedRepo] = useState('');
    const [newRepoName, setNewRepoName] = useState('');
    const [deployToVercel, setDeployToVercel] = useState(false);
    const [projectCategory, setProjectCategory] = useState('webapp');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Repo name uniqueness check
    const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
    const [repoSlug, setRepoSlug] = useState('');
    const [repoFullName, setRepoFullName] = useState('');
    const [repoError, setRepoError] = useState('');
    const [checkTimer, setCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Repo listing
    const [repos, setRepos] = useState<RepoInfo[]>([]);
    const [loadingRepos, setLoadingRepos] = useState(false);
    const listOrgRepos = useAction(api.github.listOrgRepos);

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

    // Fetch repos on mount
    useEffect(() => {
        if (!typedOrgId || !githubConnection?.connected) return;
        setLoadingRepos(true);
        listOrgRepos({ orgId: typedOrgId })
            .then((data) => setRepos(data as RepoInfo[]))
            .catch((err) => toast.error(getErrorMessage(err)))
            .finally(() => setLoadingRepos(false));
    }, [typedOrgId, githubConnection?.connected, listOrgRepos]);

    // Build repo options for SearchableSelect
    const repoOptions: SelectOption[] = repos.map(r => ({
        value: r.fullName,
        label: r.fullName.split('/').pop() || r.fullName,
        sublabel: r.description || (r.isPrivate ? '🔒 Private' : '🌍 Public'),
        icon: r.isLinked ? '🔗' : r.isPrivate ? '🔒' : '📦',
        group: r.fullName.split('/')[0],
    }));

    // Debounced new repo name uniqueness check
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
            setRepoCheckStatus(result.available ? 'available' : 'taken');
            setRepoError(result.error || '');
        } catch (err) {
            setRepoCheckStatus('error');
            setRepoError(getErrorMessage(err));
        }
    }, [typedOrgId, checkAvailability]);

    useEffect(() => {
        if (checkTimer) clearTimeout(checkTimer);
        if (!newRepoName.trim()) { setRepoCheckStatus('idle'); return; }
        const timer = setTimeout(() => checkRepoName(newRepoName), 500);
        setCheckTimer(timer);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newRepoName]);

    // Auto-populate name from selected repo
    useEffect(() => {
        if (selectedRepo) {
            const repoShortName = selectedRepo.split('/').pop() || selectedRepo;
            setName(repoShortName);
            const selected = repos.find(r => r.fullName === selectedRepo);
            if (selected?.description) setDescription(selected.description);
            // Clear new repo name when existing repo selected
            setNewRepoName('');
            setRepoCheckStatus('idle');
        }
    }, [selectedRepo, repos]);

    // When typing a new repo name, clear the selected repo
    useEffect(() => {
        if (newRepoName.trim()) {
            setSelectedRepo('');
        }
    }, [newRepoName]);

    // Determine which repo mode: existing or new
    const isNewRepo = !!newRepoName.trim();
    const hasValidRepo = isNewRepo ? repoCheckStatus === 'available' : !!selectedRepo;

    const handleSubmit = async () => {
        if (!name.trim() || !lane) { setError('Name and lane are required'); return; }
        if (!typedOrgId) { setError('Organization not found'); return; }
        if (!hasValidRepo) {
            setError(isNewRepo ? 'Choose an available repo name' : 'Please select a repository');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            let repoFullNameFinal = selectedRepo;
            let repoUrl = '';
            let isPrivate = false;

            if (isNewRepo) {
                // Create new GitHub repo
                toast.loading('Creating GitHub repository...', { id: 'clone-progress' });
                const repoResult = await createRepo({
                    orgId: typedOrgId,
                    name: newRepoName,
                    description: description.trim(),
                    isPrivate: true,
                    projectId: undefined,
                }) as { repoFullName: string; repoUrl: string; slug: string };
                repoFullNameFinal = repoResult.repoFullName;
                repoUrl = repoResult.repoUrl;
                isPrivate = true;
                toast.loading('Repository created!', { id: 'clone-progress' });
            } else {
                const selected = repos.find(r => r.fullName === selectedRepo);
                if (!selected) { setError('Selected repo not found'); return; }
                repoUrl = selected.url;
                isPrivate = selected.isPrivate;
            }

            // Create the project in our DB
            const newProjectId = await createProject({
                orgId: typedOrgId,
                name: name.trim(),
                lane,
                tier,
                priority,
                description: description.trim(),
                stack: [],
                oss: !isPrivate,
                repo: repoUrl,
                projectCategory,
            });

            toast.success('Project created!', { id: 'clone-progress' });

            // 2. Optionally deploy to Vercel
            if (deployToVercel && vercelConnection?.connected) {
                toast.loading('Creating Vercel project...', { id: 'clone-progress' });
                const repoSlugForVercel = repoFullNameFinal.split('/').pop() || repoFullNameFinal;
                const vercelProject = await createVercelProject({
                    orgId: typedOrgId,
                    name: repoSlugForVercel,
                    gitRepo: repoFullNameFinal,
                }) as { id: string; name: string; repoId?: number; linked: boolean };

                if (vercelProject.linked) {
                    toast.loading('Triggering deployment...', { id: 'clone-progress' });
                    await deployVercel({
                        orgId: typedOrgId,
                        vercelProjectId: vercelProject.name,
                        gitRepo: repoFullNameFinal,
                        branch: isNewRepo ? 'main' : (repos.find(r => r.fullName === selectedRepo)?.defaultBranch || 'main'),
                    });
                }

                toast.success('Project created & deployed to Vercel! 🚀', { id: 'clone-progress' });
            } else {
                toast.success('Project created from repo! 🎉', { id: 'clone-progress' });
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
                    {/* Repository Selector */}
                    <div>
                        <label className="form-label">GitHub Repository *</label>
                        <SearchableSelect
                            options={repoOptions}
                            value={selectedRepo}
                            onChange={setSelectedRepo}
                            placeholder="Search repositories..."
                            loading={loadingRepos}
                            grouped
                            maxHeight={280}
                            clearable
                        />
                        {selectedRepo && (
                            <div className="text-xs text-tertiary mt-4" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                📁 {selectedRepo}
                                {repos.find(r => r.fullName === selectedRepo)?.isLinked && (
                                    <span style={{ color: 'var(--warning)', fontWeight: 500 }}> (already linked)</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Or Create New Repo */}
                    <div>
                        <label className="form-label">Or create a new repository</label>
                        <FormInput
                            value={newRepoName}
                            onChange={e => setNewRepoName(e.target.value)}
                            placeholder="my-new-project"
                            style={{ fontFamily: 'monospace' }}
                        />
                        {repoCheckStatus === 'checking' && (
                            <div className="text-xs text-tertiary" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="ss-loading-spinner" style={{ width: 12, height: 12 }} /> Checking availability...
                            </div>
                        )}
                        {repoCheckStatus === 'available' && (
                            <div className="text-xs" style={{ marginTop: 4, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ✅ <code>{repoSlug}</code> is available — {repoFullName}
                            </div>
                        )}
                        {repoCheckStatus === 'taken' && (
                            <div className="text-xs" style={{ marginTop: 4, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ❌ <code>{repoSlug}</code> is already taken
                            </div>
                        )}
                        {repoCheckStatus === 'error' && (
                            <div className="text-xs" style={{ marginTop: 4, color: '#f87171' }}>
                                ⚠️ {repoError}
                            </div>
                        )}
                    </div>

                    {/* Name + Lane */}
                    <div className="grid-2 gap-12">
                        <div>
                            <label className="form-label">Project Name *</label>
                            <FormInput value={name} onChange={e => setName(e.target.value)} placeholder="my-awesome-project" />
                        </div>
                        <div>
                            <label className="form-label">Lane *</label>
                            <SearchableSelect options={laneOptions} value={lane} onChange={setLane} placeholder="Select lane..." allowCreate onCreateNew={setLane} clearable={false} />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="form-label">Description</label>
                        <FormTextarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this project do?"
                            rows={2} />
                    </div>

                    {/* Tier + Priority */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="form-label">Tier</label>
                            <SearchableSelect options={tierOptions} value={tier} onChange={setTier} placeholder="Tier" clearable={false} />
                        </div>
                        <div>
                            <label className="form-label">Priority</label>
                            <SearchableSelect options={priorityOptions} value={priority} onChange={setPriority} placeholder="Priority" clearable={false} />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="form-label">Project Category</label>
                        <SearchableSelect options={CATEGORY_OPTIONS} value={projectCategory} onChange={setProjectCategory} placeholder="Select category..." clearable={false} />
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
                                <div className="text-xs text-tertiary" style={{ marginTop: 2 }}>Creates a Vercel project linked to this repo</div>
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
                        disabled={submitting || !name.trim() || !lane || !hasValidRepo}
                    >
                        {submitting ? '⏳ Creating...' : '🔗 Clone & Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}
