import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import type { Tier, Priority, Project } from '../lib/types';
import { TIER_CONFIG, PRIORITY_CONFIG, LANE_COLORS } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect from '../components/SearchableSelect';
import { FormInput, FormCheckbox } from '../components/ui';
import type { ProjectDoc, Id } from '../lib/types';

const LANES = ['ai-agents', 'web-apps', 'mobile-apps', 'developer-tools', 'templates', 'infrastructure', 'learning', 'uncategorized'];

// Well-known root YAML files to check for
const ROOT_YAML_FILES = ['PROJECT.yaml', 'ACCOUNTS.yaml', 'ROADMAP.yaml', 'IDEAS.yaml'];

// Extract owner/repo from a GitHub URL
function extractRepoFullName(repoUrl: string | undefined): string | null {
    if (!repoUrl) return null;
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1].replace(/\.git$/, '') : null;
}

// ─── YAML Files Viewer Component ────────────────────────────────────────

interface FileEntry {
    name: string;
    path: string;
    source: 'root' | '.project';
}

function ProjectFilesCard({ repoFullName, orgId }: { repoFullName: string; orgId: Id<"organizations"> }) {
    const browseContents = useAction(api.github.browseContents);
    const fetchFileContent = useAction(api.github.fetchFileContent);

    const [files, setFiles] = useState<FileEntry[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingContent, setLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load file list on mount
    const loadFiles = useCallback(async () => {
        setLoadingFiles(true);
        setError(null);
        const foundFiles: FileEntry[] = [];

        try {
            // 1. Check root-level YAML files
            try {
                const rootResult = await browseContents({ repoFullName, path: '', orgId });
                if (rootResult.type === 'directory') {
                    for (const entry of rootResult.entries) {
                        if (entry.type === 'file' && ROOT_YAML_FILES.includes(entry.name)) {
                            foundFiles.push({ name: entry.name, path: entry.path, source: 'root' });
                        }
                    }
                }
            } catch {
                // If root browse fails, we might not have GitHub access
                setError('Could not access repository. Make sure GitHub is connected in Integrations.');
                setLoadingFiles(false);
                return;
            }

            // 2. Check .project/ folder
            try {
                const projectDirResult = await browseContents({ repoFullName, path: '.project', orgId });
                if (projectDirResult.type === 'directory') {
                    for (const entry of projectDirResult.entries) {
                        if (entry.type === 'file' && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
                            foundFiles.push({ name: entry.name, path: entry.path, source: '.project' });
                        }
                    }
                }
            } catch {
                // .project/ folder doesn't exist — that's fine
            }

            setFiles(foundFiles);
            // Auto-select first file
            if (foundFiles.length > 0 && !selectedFile) {
                setSelectedFile(foundFiles[0].path);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load files');
        } finally {
            setLoadingFiles(false);
        }
    }, [repoFullName, orgId, browseContents, selectedFile]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    // Load file content when selected file changes
    useEffect(() => {
        if (!selectedFile) {
            setFileContent('');
            return;
        }

        let cancelled = false;
        setLoadingContent(true);

        fetchFileContent({ repoFullName, path: selectedFile, orgId })
            .then(result => {
                if (!cancelled) setFileContent(result.content);
            })
            .catch(err => {
                if (!cancelled) setFileContent(`Error loading file: ${err instanceof Error ? err.message : 'Unknown error'}`);
            })
            .finally(() => {
                if (!cancelled) setLoadingContent(false);
            });

        return () => { cancelled = true; };
    }, [selectedFile, repoFullName, orgId, fetchFileContent]);

    if (error) {
        return (
            <div className="yaml-editor-section">
                <div className="yaml-editor-header">
                    <div className="yaml-editor-title">📁 Project Files</div>
                </div>
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
                    <div className="text-md">{error}</div>
                </div>
            </div>
        );
    }

    // Group files by source
    const rootFiles = files.filter(f => f.source === 'root');
    const projectFiles = files.filter(f => f.source === '.project');

    return (
        <div className="yaml-editor-section">
            <div className="yaml-editor-header">
                <div className="yaml-editor-title">📁 Project Files</div>
                <div className="yaml-editor-actions">
                    <button className="btn btn-secondary text-sm" onClick={loadFiles} disabled={loadingFiles}>
                        {loadingFiles ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </div>

            {loadingFiles ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                    <div className="text-sm text-tertiary">Scanning repository for YAML files...</div>
                </div>
            ) : files.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    <div className="text-md">No YAML files found</div>
                    <div className="text-sm mt-4">
                        Add a <code style={{ background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 4 }}>PROJECT.yaml</code> to your repo root or create a <code style={{ background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 4 }}>.project/</code> folder
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', minHeight: 300, borderTop: '1px solid var(--border)' }}>
                    {/* Left sidebar — file list */}
                    <div style={{
                        width: 200, flexShrink: 0, borderRight: '1px solid var(--border)',
                        background: 'var(--bg-primary)', overflowY: 'auto',
                    }}>
                        {rootFiles.length > 0 && (
                            <div>
                                <div style={{
                                    padding: '8px 12px', fontSize: 10, fontWeight: 600,
                                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', borderBottom: '1px solid var(--border)',
                                }}>Root</div>
                                {rootFiles.map(f => (
                                    <button
                                        key={f.path}
                                        onClick={() => setSelectedFile(f.path)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            width: '100%', padding: '8px 12px', border: 'none',
                                            background: selectedFile === f.path ? 'var(--accent-bg)' : 'transparent',
                                            color: selectedFile === f.path ? 'var(--accent)' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: 12, textAlign: 'left',
                                            borderLeft: selectedFile === f.path ? '2px solid var(--accent)' : '2px solid transparent',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <span>📄</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {projectFiles.length > 0 && (
                            <div>
                                <div style={{
                                    padding: '8px 12px', fontSize: 10, fontWeight: 600,
                                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', borderBottom: '1px solid var(--border)',
                                    borderTop: rootFiles.length > 0 ? '1px solid var(--border)' : 'none',
                                }}>.project/</div>
                                {projectFiles.map(f => (
                                    <button
                                        key={f.path}
                                        onClick={() => setSelectedFile(f.path)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            width: '100%', padding: '8px 12px', border: 'none',
                                            background: selectedFile === f.path ? 'var(--accent-bg)' : 'transparent',
                                            color: selectedFile === f.path ? 'var(--accent)' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: 12, textAlign: 'left',
                                            borderLeft: selectedFile === f.path ? '2px solid var(--accent)' : '2px solid transparent',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <span>📄</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Main content — file viewer */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {!selectedFile ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                Select a file to view its contents
                            </div>
                        ) : loadingContent ? (
                            <div style={{ padding: 40, textAlign: 'center' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                                <div className="text-sm text-tertiary">Loading {selectedFile}...</div>
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                {/* File path header */}
                                <div style={{
                                    padding: '6px 14px', fontSize: 11, fontFamily: 'monospace',
                                    color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <span>{selectedFile}</span>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(fileContent)}
                                        className="text-xs"
                                        style={{
                                            background: 'none', border: '1px solid var(--border)',
                                            borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                                            color: 'var(--text-tertiary)',
                                        }}
                                        title="Copy content"
                                    >📋 Copy</button>
                                </div>
                                {/* YAML content */}
                                <pre style={{
                                    margin: 0, padding: 14, fontSize: 12, lineHeight: 1.6,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word', overflowX: 'auto',
                                }}>{fileContent}</pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ProjectPage() {
    const { path: projectPath } = useParams<{ path: string }>();
    const navigate = useNavigate();
    const { orgId } = useAuth();

    const projectId = projectPath ? decodeURIComponent(projectPath) : '';

    // Convex queries
    const project = useQuery(api.projects.getByPath, projectId ? { path: projectId } : "skip");
    const updateProject = useMutation(api.projects.updateByPath);

    // Form state
    const [editedProject, setEditedProject] = useState<Partial<Project> & { deployUrl?: string }>({});
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
    const [idCopied, setIdCopied] = useState(false);

    // Sync form with project data once loaded
    useEffect(() => {
        if (project && Object.keys(editedProject).length === 0) {
            setEditedProject(project as Partial<ProjectDoc>);
        }
    }, [project, editedProject]);

    const handleSave = async () => {
        if (!projectId) return;
        setSaving(true);
        setSaveStatus(null);
        try {
            await updateProject({
                path: projectId,
                name: editedProject.name || undefined,
                description: editedProject.description || undefined,
                tier: editedProject.tier,
                lane: editedProject.lane,
                priority: editedProject.priority,
                oss: editedProject.oss,
                repo: editedProject.repo || undefined,
                deployUrl: editedProject.deployUrl || undefined,
            });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: string, value: string | boolean | string[] | number) => {
        setEditedProject(prev => ({ ...prev, [field]: value }));
    };

    const handleCopyId = () => {
        if (!project?._id) return;
        navigator.clipboard.writeText(project._id);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
    };

    if (project === undefined) return <div className="loading"><div className="loading-spinner" />Loading...</div>;
    if (project === null) return <div className="error-message">Project not found</div>;

    const currentProject = { ...project, ...editedProject };

    const tc = TIER_CONFIG[currentProject.tier as Tier] || TIER_CONFIG.idea;
    const pc = PRIORITY_CONFIG[(currentProject.priority as Priority)] || PRIORITY_CONFIG.medium;
    const lc = LANE_COLORS[currentProject.lane] || 'var(--text-tertiary)';

    const hasChanges = Object.keys(editedProject).some((k) => editedProject[k as keyof Project] !== (project as Record<string, unknown>)[k]);

    const repoFullName = extractRepoFullName(currentProject.repo);

    return (
        <div className="project-detail">
            <button className="detail-back" onClick={() => navigate(-1)}>← Back</button>
            <div className="detail-header">
                <h1 className="detail-name">{currentProject.name}</h1>
                <span className="tier-badge" style={{ color: tc.color, background: tc.bg, fontSize: 13, padding: '5px 14px' }}>{tc.emoji} {tc.label}</span>
                {currentProject.oss && <span className="oss-badge" style={{ fontSize: 12, padding: '4px 10px' }}>OSS</span>}
                <span className={`health-badge ${(currentProject.healthScore || 0) >= 60 ? 'health-good' : (currentProject.healthScore || 0) >= 40 ? 'health-warn' : 'health-bad'}`}>{currentProject.healthScore || 0}</span>
            </div>

            <div className="detail-meta mb-24 mt-16">
                <div className="meta-item"><div className="meta-label">Path/ID</div><div className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{projectId}</div></div>
                <div className="meta-item"><div className="meta-label">Last Active</div><div className="meta-value">{currentProject.lastActive ? new Date(currentProject.lastActive).toLocaleDateString() : '—'}</div></div>
            </div>

            {/* ─── Convex ID Card ─── */}
            <div className="detail-meta mb-24">
                <div className="meta-item" style={{ flex: 1 }}>
                    <div className="meta-label">Convex ID</div>
                    <div className="meta-value flex-row gap-8" style={{ alignItems: 'center' }}>
                        <code style={{
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: 12, padding: '4px 10px', borderRadius: 6,
                            background: 'var(--bg-primary)', border: '1px solid var(--border)',
                            letterSpacing: '0.02em', userSelect: 'all',
                        }}>{project._id}</code>
                        <button
                            onClick={handleCopyId}
                            className="text-xs"
                            style={{
                                background: idCopied ? 'rgba(52,211,153,0.15)' : 'var(--bg-primary)',
                                border: `1px solid ${idCopied ? '#34d399' : 'var(--border)'}`,
                                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                                color: idCopied ? '#34d399' : 'var(--text-tertiary)',
                                transition: 'all 0.2s', fontWeight: 500,
                            }}
                        >{idCopied ? '✓ Copied' : '📋 Copy'}</button>
                    </div>
                </div>
            </div>

            {/* ─── Project Details Form ─── */}
            <div className="yaml-editor-section">
                <div className="yaml-editor-header">
                    <div className="yaml-editor-title">📝 Project Settings {hasChanges && <span style={{ color: 'var(--warning)', fontSize: 11, fontWeight: 400 }}>(unsaved)</span>}</div>
                    <div className="yaml-editor-actions">
                        {saveStatus && <span className={`save-status ${saveStatus}`}>{saveStatus === 'success' ? '✓ Saved' : '✗ Error'}</span>}
                        {hasChanges && <button className="btn btn-secondary" onClick={() => setEditedProject(project as Partial<ProjectDoc>)}>Cancel</button>}
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasChanges}>{saving ? '⏳' : '💾'} Save</button>
                    </div>
                </div>

                <div className="gap-16 flex-col mt-16 mb-16" style={{ padding: '0 16px' }}>
                    <div className="grid-2 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Project Name</label>
                            <FormInput value={currentProject.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Description</label>
                            <FormInput value={currentProject.description || ''} onChange={(e) => handleChange('description', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid-3 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Tier</label>
                            <SearchableSelect
                                options={Object.entries(TIER_CONFIG).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))}
                                value={currentProject.tier}
                                onChange={(v) => handleChange('tier', v)}
                                clearable={false}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Lane</label>
                            <SearchableSelect
                                options={LANES.map(l => ({ value: l, label: l }))}
                                value={currentProject.lane}
                                onChange={(v) => handleChange('lane', v)}
                                clearable={false}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Priority</label>
                            <SearchableSelect
                                options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                                value={currentProject.priority}
                                onChange={(v) => handleChange('priority', v)}
                                clearable={false}
                            />
                        </div>
                    </div>

                    <div className="grid-2 gap-16">
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Repository URL</label>
                            <FormInput value={currentProject.repo || ''} onChange={(e) => handleChange('repo', e.target.value)} placeholder="https://github.com/..." />
                        </div>
                        <div>
                            <label className="text-sm text-tertiary mb-4 block">Deployment URL</label>
                            <FormInput value={currentProject.deployUrl || ''} onChange={(e) => handleChange('deployUrl', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="flex-row gap-8 mt-8">
                        <FormCheckbox checked={currentProject.oss || false} onChange={(e) => handleChange('oss', e.target.checked)} label="Open Source (OSS)" />
                    </div>
                </div>
            </div>

            {/* ─── Project Files (YAML Viewer) ─── */}
            {repoFullName && orgId && (
                <ProjectFilesCard repoFullName={repoFullName} orgId={orgId} />
            )}

            {/* GitHub not linked message */}
            {!repoFullName && (
                <div className="yaml-editor-section">
                    <div className="yaml-editor-header">
                        <div className="yaml-editor-title">📁 Project Files</div>
                    </div>
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                        <div className="text-md">Set a GitHub repository URL above to view project files</div>
                    </div>
                </div>
            )}
        </div>
    );
}
