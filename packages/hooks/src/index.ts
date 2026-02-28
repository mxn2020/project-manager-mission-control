import { useState, useEffect, useCallback } from 'react';
import type { ApiClient } from '@mission-control/api';
import type { Task, StatusData } from '@mission-control/types';

// ─── useProjects ──────────────────────────────────────────────────────────────

export function useProjectsData(api: ApiClient) {
    const [data, setData] = useState<StatusData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.projects.list();
            setData(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => { load(); }, [load]);

    return { data, loading, error, reload: load };
}

// ─── useTasks ─────────────────────────────────────────────────────────────────

export function useTasksData(
    api: ApiClient,
    filters?: { status?: string; priority?: string; project?: string }
) {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.tasks.list(filters);
            setTasks(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [api, filters?.status, filters?.priority, filters?.project]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    return { tasks, loading, error, reload: load };
}

// ─── useMediaQuery ────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia(query);
        setMatches(mq.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 768px)');
}
