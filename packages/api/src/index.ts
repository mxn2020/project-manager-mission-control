import type { StatusData, Task } from '@mission-control/types';

// ─── API Client Factory ───────────────────────────────────────────────────────
// Creates a platform-agnostic API client that works in both web and mobile.

export interface ApiClientConfig {
    baseUrl: string;
    getAuthToken: () => string | null;
}

async function request<T>(
    config: ApiClientConfig,
    url: string,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): Promise<T> {
    const token = config.getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
    };

    const res = await fetch(`${config.baseUrl}${url}`, {
        method: options?.method ?? 'GET',
        headers,
        body: options?.body != null ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
}

export function createApiClient(config: ApiClientConfig) {
    const req = <T>(url: string, options?: Parameters<typeof request>[2]) =>
        request<T>(config, url, options);

    return {
        projects: {
            list: () => req<StatusData>('/api/projects'),
            get: (path: string) =>
                req<{ project: Record<string, unknown>; raw_yaml: string }>(
                    `/api/projects/${encodeURIComponent(path)}`
                ),
            update: (path: string, yaml: string) =>
                req('/api/projects/' + encodeURIComponent(path), { method: 'PUT', body: { yaml } }),
            create: (data: Record<string, unknown>) =>
                req<{ path: string }>('/api/projects', { method: 'POST', body: data }),
        },
        tasks: {
            list: (filters?: { status?: string; priority?: string; project?: string }) => {
                const params = new URLSearchParams();
                if (filters?.status) params.set('status', filters.status);
                if (filters?.priority) params.set('priority', filters.priority);
                if (filters?.project) params.set('project', filters.project);
                const qs = params.toString();
                return req<Task[]>(`/api/tasks${qs ? '?' + qs : ''}`);
            },
            stats: () =>
                req<{
                    total: number;
                    byStatus: Record<string, number>;
                    byPriority: Record<string, number>;
                    byProject: Record<string, number>;
                }>('/api/tasks/stats'),
            create: (data: Record<string, unknown>) => req<Task>('/api/tasks', { method: 'POST', body: data }),
            update: (id: string, data: Record<string, unknown>) =>
                req<Task>(`/api/tasks/${id}`, { method: 'PUT', body: data }),
            delete: (id: string) =>
                req<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
        },
        health: () => req<{ status: string }>('/api/health'),
    };
}

export type ApiClient = ReturnType<typeof createApiClient>;
