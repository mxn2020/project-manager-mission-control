import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAuthHeaders, API_BASE } from '../lib/api';

export default function DeleteProjectPage() {
    const params = useParams<{ '*': string }>();
    const path = params['*'] ? decodeURIComponent(params['*']) : '';
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        if (!path) return;
        setDeleting(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(path)}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as { error?: string }).error || 'Failed to delete project');
            }
            navigate('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete project');
            setDeleting(false);
        }
    };

    return (
        <div>
            <div className="mobile-page-header">
                <button className="mobile-page-back" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <span className="mobile-page-title">Delete Project</span>
            </div>

            <div className="delete-confirm">
                <div className="delete-confirm-icon">🗑️</div>
                <div className="delete-confirm-title">Delete Project?</div>
                <div className="delete-confirm-message">
                    Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{path}</strong>?
                    This action cannot be undone.
                </div>

                {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: 8, color: 'var(--error)', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <div className="delete-confirm-actions">
                    <button className="btn btn-danger mobile-form-submit" onClick={handleDelete} disabled={deleting}>
                        {deleting ? '⏳ Deleting...' : '🗑️ Yes, Delete Project'}
                    </button>
                    <button className="btn btn-secondary mobile-form-submit" onClick={() => navigate(-1)}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
