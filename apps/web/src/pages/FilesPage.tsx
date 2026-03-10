import { useState, useMemo, useCallback } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

interface GitHubEntry {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size: number;
    sha: string;
}

export default function FilesPage() {
    const { data, loading: projectsLoading } = useProjects();
    const { orgId } = useAuth() as any;
    const projects = data?.projects || [];

    const [selectedProject, setSelectedProject] = useState<string>('');
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [entries, setEntries] = useState<GitHubEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileContent, setFileContent] = useState<{ name: string; content: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [githubToken, setGithubToken] = useState(localStorage.getItem('mc-github-token') || '');
    const [showTokenInput, setShowTokenInput] = useState(!localStorage.getItem('mc-github-token'));

    const linkedRepos = useQuery(api.github.list, orgId ? { orgId } : 'skip');
    const browseContents = useAction(api.github.browseContents);
    const fetchFileContentAction = useAction(api.github.fetchFileContent);

    // Get repo full name for selected project
    const getRepoForProject = useCallback((projectPath: string) => {
        const project = projects.find((p: any) => p.path === projectPath || p.name === projectPath);
        if (!project) return null;
        // Check linked repos
        const linked = linkedRepos?.find((r: any) => r.projectId === (project as any)._id);
        if (linked) return { repoFullName: linked.repoFullName, branch: linked.defaultBranch || 'main' };
        // Fall back to repo URL in project data
        if ((project as any).repo) {
            const match = (project as any).repo.match(/github\.com\/([^\/]+\/[^\/]+)/);
            if (match) return { repoFullName: match[1].replace(/\.git$/, ''), branch: 'main' };
        }
        return null;
    }, [projects, linkedRepos]);

    const fetchDir = useCallback(async (projectPath: string, subPath: string = '') => {
        if (!githubToken) { setShowTokenInput(true); return; }
        const repo = getRepoForProject(projectPath);
        if (!repo) { setError('No GitHub repo linked to this project. Link one in Admin or add a repo URL.'); return; }

        setLoading(true);
        setError(null);
        try {
            const result = await browseContents({
                repoFullName: repo.repoFullName,
                path: subPath,
                branch: repo.branch,
                githubToken,
            });

            if (result.type === 'directory') {
                setEntries(result.entries as GitHubEntry[]);
            } else {
                setFileContent({ name: result.name || subPath.split('/').pop() || '', content: result.content || '' });
            }
        } catch (err: any) {
            setError(err.message);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [githubToken, getRepoForProject, browseContents]);

    const fetchFile = useCallback(async (projectPath: string, filePath: string) => {
        if (!githubToken) { setShowTokenInput(true); return; }
        const repo = getRepoForProject(projectPath);
        if (!repo) return;

        setLoading(true);
        try {
            const result = await fetchFileContentAction({
                repoFullName: repo.repoFullName,
                path: filePath,
                branch: repo.branch,
                githubToken,
            });
            setFileContent({ name: result.name, content: result.content });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [githubToken, getRepoForProject, fetchFileContentAction]);

    const handleSelectProject = (v: string) => {
        setSelectedProject(v);
        setCurrentPath([]);
        setFileContent(null);
        setError(null);
        setEntries([]);
        if (v && githubToken) fetchDir(v, '');
    };

    const navigateToDir = (dirPath: string) => {
        const parts = dirPath.split('/');
        setCurrentPath(parts);
        setFileContent(null);
        fetchDir(selectedProject, dirPath);
    };

    const navigateUp = () => {
        const newPath = currentPath.slice(0, -1);
        setCurrentPath(newPath);
        setFileContent(null);
        fetchDir(selectedProject, newPath.join('/'));
    };

    const navigateToRoot = () => {
        setCurrentPath([]);
        setFileContent(null);
        fetchDir(selectedProject, '');
    };

    const saveToken = () => {
        if (githubToken.trim()) {
            localStorage.setItem('mc-github-token', githubToken.trim());
            setShowTokenInput(false);
            if (selectedProject) fetchDir(selectedProject, currentPath.join('/'));
        }
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    };

    const getFileIcon = (name: string, type: string) => {
        if (type === 'dir') return '📁';
        const ext = name.split('.').pop()?.toLowerCase();
        const icons: Record<string, string> = {
            ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡', json: '📋',
            md: '📝', yaml: '📄', yml: '📄', css: '🎨', html: '🌐',
            py: '🐍', sh: '⚡', env: '🔒', lock: '🔑', svg: '🖼️',
            png: '🖼️', jpg: '🖼️', gif: '🖼️', mp4: '🎬',
        };
        return icons[ext || ''] || '📄';
    };

    const projectOptions: SelectOption[] = useMemo(() => projects.map((p: any) => {
        const segments = (p.path || p.name).split('/');
        const repo = getRepoForProject(p.path || p.name);
        return {
            value: p.path || p.name,
            label: p.name,
            sublabel: repo ? `${repo.repoFullName}` : `${p.lane} · ${p.tier}`,
            group: segments[0] || 'root',
            icon: repo ? '🔗' : '📁',
        };
    }), [projects, getRepoForProject]);

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">📂 File Explorer</h1>
                        <p className="page-description">Browse GitHub repository files</p>
                    </div>
                    <div className="flex-row gap-8">
                        <button className="btn btn-secondary text-base" onClick={() => setShowTokenInput(!showTokenInput)}>
                            🔑 {githubToken ? 'Update Token' : 'Set Token'}
                        </button>
                    </div>
                </div>
            </div>

            {/* GitHub Token Input */}
            {showTokenInput && (
                <div className="section-card mb-16">
                    <div className="font-semibold text-md mb-8">🔑 GitHub Personal Access Token</div>
                    <div className="text-sm text-tertiary mb-8">
                        Required to browse repository contents. Create one at{' '}
                        <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                            github.com/settings/tokens
                        </a>{' '}
                        with <code>repo</code> scope.
                    </div>
                    <div className="flex-row gap-8">
                        <input
                            type="password"
                            value={githubToken}
                            onChange={e => setGithubToken(e.target.value)}
                            placeholder="ghp_..."
                            className="form-input flex-1"
                        />
                        <button className="btn btn-primary" onClick={saveToken} disabled={!githubToken.trim()}>Save</button>
                    </div>
                </div>
            )}

            {/* Project Selector */}
            <div className="mb-16" style={{ maxWidth: 400 }}>
                <SearchableSelect
                    options={projectOptions}
                    value={selectedProject}
                    onChange={handleSelectProject}
                    placeholder="Search and select a project..."
                    grouped
                    loading={projectsLoading}
                />
            </div>

            {/* Breadcrumb */}
            {selectedProject && (
                <div className="flex-row gap-4 mb-12 text-base">
                    <span onClick={navigateToRoot} className="text-accent" style={{ cursor: 'pointer' }}>
                        📁 {selectedProject.split('/').pop()}
                    </span>
                    {currentPath.map((seg, i) => (
                        <span key={i}>
                            <span className="text-tertiary" style={{ margin: '0 2px' }}>/</span>
                            <span
                                onClick={() => navigateToDir(currentPath.slice(0, i + 1).join('/'))}
                                style={{ cursor: 'pointer', color: i === currentPath.length - 1 ? 'inherit' : 'var(--accent)' }}
                            >
                                {seg}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-12" style={{ padding: 16, background: 'rgba(248,113,113,0.1)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)' }}>
                    <div className="text-base text-muted">{error}</div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: fileContent ? '1fr 1fr' : '1fr', gap: 16 }}>
                {/* Directory listing */}
                {selectedProject && (
                    <div>
                        {loading && !fileContent ? (
                            <div className="loading"><div className="loading-spinner" /> Loading...</div>
                        ) : (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                {currentPath.length > 0 && (
                                    <div
                                        onClick={navigateUp}
                                        className="flex-row gap-8 text-md"
                                        style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                    >
                                        <span>⬆️</span>
                                        <span className="text-muted">..</span>
                                    </div>
                                )}
                                {entries.length === 0 && !loading ? (
                                    <div className="text-center text-tertiary text-md" style={{ padding: 20 }}>
                                        {!githubToken ? 'Set GitHub token to browse files' : 'No files found'}
                                    </div>
                                ) : (
                                    [...entries]
                                        .sort((a, b) => {
                                            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(entry => (
                                            <div
                                                key={entry.name}
                                                onClick={() => {
                                                    if (entry.type === 'dir') {
                                                        navigateToDir(entry.path);
                                                    } else {
                                                        fetchFile(selectedProject, entry.path);
                                                    }
                                                }}
                                                className="flex-row gap-10 text-md"
                                                style={{
                                                    padding: '8px 14px', cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <span>{getFileIcon(entry.name, entry.type)}</span>
                                                <span className="flex-1" style={{ fontWeight: entry.type === 'dir' ? 500 : 400 }}>{entry.name}</span>
                                                {entry.size > 0 && entry.type === 'file' && <span className="text-xs text-tertiary">{formatSize(entry.size)}</span>}
                                            </div>
                                        ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* File Content Viewer */}
                {fileContent && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div className="flex-row" style={{
                            padding: '8px 14px', borderBottom: '1px solid var(--border)',
                            justifyContent: 'space-between',
                        }}>
                            <span className="font-semibold text-md">{fileContent.name}</span>
                            <button onClick={() => setFileContent(null)} className="icon-btn">✕</button>
                        </div>
                        <pre className="text-sm text-muted font-mono whitespace-pre" style={{
                            padding: 14, margin: 0, lineHeight: 1.5,
                            overflow: 'auto', maxHeight: 600,
                        }}>
                            {fileContent.content}
                        </pre>
                    </div>
                )}
            </div>

            {!selectedProject && (
                <div className="empty-state">
                    <div className="empty-state-icon">📂</div>
                    <div className="empty-state-text">Select a project to browse its GitHub repository</div>
                </div>
            )}
        </div>
    );
}
