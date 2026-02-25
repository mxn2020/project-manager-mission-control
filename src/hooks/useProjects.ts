import { useState, useEffect, useCallback } from 'react';
import type { StatusData } from '../lib/types';
import { api } from '../lib/api';

export function useProjects() {
    const [data, setData] = useState<StatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await api.projects.list();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    const runScan = useCallback(async () => {
        try {
            setLoading(true);
            const result = await api.scan();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Scan failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return { data, loading, error, refresh: load, runScan };
}
