const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const TOKEN_KEY = 'mc_auth_token';

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export const api = {
    projects: {
        list: () => request<import('./types').StatusData>('/api/projects'),
        get: (path: string) => request<{ project: Record<string, unknown>; raw_yaml: string }>(`/api/projects/${encodeURIComponent(path)}`),
        update: (path: string, yaml: string) => request('/api/projects/' + encodeURIComponent(path), { method: 'PUT', body: JSON.stringify({ yaml }) }),
    },
    scan: () => request<import('./types').StatusData>('/api/scan', { method: 'POST' }),
    health: () => request<{ status: string }>('/api/health'),
};

export { getAuthHeaders, API_BASE };

