import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Sync filter/view state with URL search params for persistence across reloads.
 * 
 * Usage:
 *   const [filters, setFilter] = useUrlFilters({ view: 'pipeline', lane: '', priority: '' });
 *   // filters.view, filters.lane, etc. come from URL or defaults
 *   // setFilter('view', 'list') updates URL param
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T): [T, (key: keyof T, value: string) => void] {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo(() => {
        const result = { ...defaults };
        for (const key of Object.keys(defaults)) {
            const urlValue = searchParams.get(key);
            if (urlValue !== null) {
                (result as Record<string, string>)[key] = urlValue;
            }
        }
        return result;
    }, [searchParams, defaults]);

    const setFilter = useCallback((key: keyof T, value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value === '' || value === defaults[key]) {
                next.delete(key as string);
            } else {
                next.set(key as string, value);
            }
            return next;
        }, { replace: true });
    }, [setSearchParams, defaults]);

    return [filters, setFilter];
}
