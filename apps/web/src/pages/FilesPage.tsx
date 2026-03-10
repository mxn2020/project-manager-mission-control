import { useState, useEffect, useMemo } from 'react';

import { useProjects } from '../hooks/useProjects';
import SearchableSelect, { type SelectOption } from '../components/SearchableSelect';

interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    children?: FileEntry[];
}

export default function FilesPage() {
    const { data, loading: projectsLoading } = useProjects();
    const projects = data?.projects || [];
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileContent, setFileContent] = useState<{ name: string; content: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchDir = async (projectPath: string, subPath: string = '') => {
        setLoading(false);
        setError("Local File Explorer has been deprecated in favor of GitHub integration.");
        setEntries([]);
    };

    const fetchFile = async (filePath: string) => {
        setLoading(false);
        setError("Local File Explorer has been deprecated in favor of GitHub integration.");
    };

    useEffect(() => {
        if (selectedProject) {
            setError("Local File Explorer has been deprecated in favor of GitHub integration.");
        }
    }, [selectedProject, currentPath.join('/')]);

    const navigateToDir = (dirName: string) => {
        setCurrentPath(prev => [...prev, dirName]);
    };

    const navigateUp = () => {
        setCurrentPath(prev => prev.slice(0, -1));
        setFileContent(null);
    };

    const navigateToRoot = () => {
        setCurrentPath([]);
        setFileContent(null);
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    };

    const getFileIcon = (name: string, type: string) => {
        if (type === 'directory') return '📁';
        const ext = name.split('.').pop()?.toLowerCase();
        const icons: Record<string, string> = {
            ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡', json: '📋',
            md: '📝', yaml: '📄', yml: '📄', css: '🎨', html: '🌐',
            py: '🐍', sh: '⚡', env: '🔒', lock: '🔑', svg: '🖼️',
            png: '🖼️', jpg: '🖼️', gif: '🖼️', mp4: '🎬',
        };
        return icons[ext || ''] || '📄';
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📂 File Explorer</h1>
                <p className="page-description">Browse project files and directories</p>
            </div>

            {/* Project Selector */}
            <div className="mb-16" style={{ maxWidth: 400 }}>
                <SearchableSelect
                    options={useMemo(() => projects.map((p: any) => {
                        const segments = (p.path || p.name).split('/');
                        return {
                            value: p.path || p.name,
                            label: p.name,
                            sublabel: `${p.lane} · ${p.tier}`,
                            group: segments[0] || 'root',
                            icon: '📁',
                        };
                    }), [projects])}
                    value={selectedProject}
                    onChange={(v) => { setSelectedProject(v); setCurrentPath([]); setFileContent(null); setError(null); }}
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
                                onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                                style={{ cursor: 'pointer', color: i === currentPath.length - 1 ? 'inherit' : 'var(--accent)' }}
                            >
                                {seg}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {/* Deprecation Error */}
            {selectedProject && (
                <div className="mb-12" style={{ padding: 16, background: 'rgba(251,191,36,0.1)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)' }}>
                    <div className="font-semibold text-md mb-4" style={{ color: '#fbbf24' }}>🔒 Local File Explorer Deprecated</div>
                    <div className="text-base text-muted">
                        This feature is being rewritten to integrate directly with GitHub. Local file scanning via the Express API is no longer supported.
                    </div>
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
                                        style={{
                                            padding: '8px 14px', cursor: 'pointer',
                                            borderBottom: '1px solid var(--border)',
                                        }}
                                    >
                                        <span>⬆️</span>
                                        <span className="text-muted">..</span>
                                    </div>
                                )}
                                {entries.length === 0 && !loading ? (
                                    <div className="text-center text-tertiary text-md" style={{ padding: 20 }}>
                                        {error ? 'Could not load files' : 'Empty directory'}
                                    </div>
                                ) : (
                                    [...entries]
                                        .sort((a, b) => {
                                            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(entry => (
                                            <div
                                                key={entry.name}
                                                onClick={() => {
                                                    if (entry.type === 'directory') {
                                                        navigateToDir(entry.name);
                                                    } else {
                                                        const fullPath = [selectedProject, ...currentPath, entry.name].join('/');
                                                        fetchFile(fullPath);
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
                                                <span className="flex-1" style={{ fontWeight: entry.type === 'directory' ? 500 : 400 }}>{entry.name}</span>
                                                {entry.size && <span className="text-xs text-tertiary">{formatSize(entry.size)}</span>}
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
                            <button
                                onClick={() => setFileContent(null)}
                                className="icon-btn"
                            >✕</button>
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
                    <div className="empty-state-text">Select a project to browse its files</div>
                </div>
            )}
        </div>
    );
}
