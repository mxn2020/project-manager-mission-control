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
        getAccounts: (path: string) => request<{ accounts: Record<string, string>; exists: boolean }>(`/api/projects/${encodeURIComponent(path)}/accounts`),
        updateAccounts: (path: string, accounts: Record<string, string>) => request<{ success: boolean }>(`/api/projects/${encodeURIComponent(path)}/accounts`, { method: 'PUT', body: JSON.stringify({ accounts }) }),
    },
    tasks: {
        list: (filters?: { status?: string; priority?: string; project?: string }) => {
            const params = new URLSearchParams();
            if (filters?.status) params.set('status', filters.status);
            if (filters?.priority) params.set('priority', filters.priority);
            if (filters?.project) params.set('project', filters.project);
            const qs = params.toString();
            return request<any[]>(`/api/tasks${qs ? '?' + qs : ''}`);
        },
        stats: () => request<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; byProject: Record<string, number> }>('/api/tasks/stats'),
        create: (data: Record<string, unknown>) => request<any>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    },
    content: {
        list: (filters?: { status?: string; project?: string }) => {
            const params = new URLSearchParams();
            if (filters?.status) params.set('status', filters.status);
            if (filters?.project) params.set('project', filters.project);
            const qs = params.toString();
            return request<any[]>(`/api/content${qs ? '?' + qs : ''}`);
        },
        stats: () => request<{ totalPlans: number; totalItems: number; byStatus: Record<string, number>; byPlatform: Record<string, number> }>('/api/content/stats'),
        create: (data: Record<string, unknown>) => request<any>('/api/content', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/content/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/content/${id}`, { method: 'DELETE' }),
        addItem: (planId: string, data: Record<string, unknown>) => request<any>(`/api/content/${planId}/items`, { method: 'POST', body: JSON.stringify(data) }),
        updateItem: (planId: string, itemId: string, data: Record<string, unknown>) => request<any>(`/api/content/${planId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    scan: () => request<import('./types').StatusData>('/api/scan', { method: 'POST' }),
    health: () => request<{ status: string }>('/api/health'),
    workflows: {
        list: (filters?: { category?: string; project?: string }) => {
            const p = new URLSearchParams();
            if (filters?.category) p.set('category', filters.category);
            if (filters?.project) p.set('project', filters.project);
            const qs = p.toString();
            return request<any[]>(`/api/workflows${qs ? '?' + qs : ''}`);
        },
        create: (data: Record<string, unknown>) => request<any>('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
    },
    marketing: {
        list: (filters?: { category?: string; project?: string }) => {
            const p = new URLSearchParams();
            if (filters?.category) p.set('category', filters.category);
            if (filters?.project) p.set('project', filters.project);
            const qs = p.toString();
            return request<any[]>(`/api/marketing${qs ? '?' + qs : ''}`);
        },
        create: (data: Record<string, unknown>) => request<any>('/api/marketing', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/marketing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/marketing/${id}`, { method: 'DELETE' }),
    },
    ideas: {
        list: (filters?: { category?: string; search?: string; archived?: string }) => {
            const p = new URLSearchParams();
            if (filters?.category) p.set('category', filters.category);
            if (filters?.search) p.set('search', filters.search);
            if (filters?.archived) p.set('archived', filters.archived);
            const qs = p.toString();
            return request<any[]>(`/api/ideas${qs ? '?' + qs : ''}`);
        },
        create: (data: Record<string, unknown>) => request<any>('/api/ideas', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/ideas/${id}`, { method: 'DELETE' }),
        promote: (id: string) => request<any>(`/api/ideas/${id}/promote`, { method: 'POST' }),
        combine: (ids: string[], title?: string) => request<any>('/api/ideas/combine', { method: 'POST', body: JSON.stringify({ ids, title }) }),
    },
    wiki: {
        list: (filters?: { category?: string; scope?: string; search?: string }) => {
            const p = new URLSearchParams();
            if (filters?.category) p.set('category', filters.category);
            if (filters?.scope) p.set('scope', filters.scope);
            if (filters?.search) p.set('search', filters.search);
            const qs = p.toString();
            return request<any[]>(`/api/wiki${qs ? '?' + qs : ''}`);
        },
        create: (data: Record<string, unknown>) => request<any>('/api/wiki', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Record<string, unknown>) => request<any>(`/api/wiki/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ success: boolean }>(`/api/wiki/${id}`, { method: 'DELETE' }),
    },
    dimensions: {
        get: () => request<{ dimensions: any[]; focusGroup: string[] }>('/api/dimensions'),
        update: (data: { dimensions: any[] }) => request<any>('/api/dimensions', { method: 'PUT', body: JSON.stringify(data) }),
    },
    focusGroup: {
        get: () => request<{ focusGroup: string[] }>('/api/focus-group'),
        set: (focusGroup: string[]) => request<{ focusGroup: string[] }>('/api/focus-group', { method: 'PUT', body: JSON.stringify({ focusGroup }) }),
    },
};

export { getAuthHeaders, API_BASE };

