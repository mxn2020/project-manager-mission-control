import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { DEFAULT_DIMENSIONS, enrichLaneDimension, type Dimension, type DimensionConfig } from '../lib/dimensions';
import type { Project } from '../lib/types';

/**
 * Hook to load/save dimensions + focus group config from the server.
 * Falls back to built-in defaults if server unavailable.
 */
export function useDimensions(projects?: Project[]) {
    const [dimensions, setDimensions] = useState<Dimension[]>(DEFAULT_DIMENSIONS);
    const [focusGroup, setFocusGroup] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const focusRef = useRef<string[]>([]);

    // Keep ref in sync
    useEffect(() => { focusRef.current = focusGroup; }, [focusGroup]);

    useEffect(() => {
        loadConfig();
    }, []);

    // Enrich lane dimension with actual project data
    useEffect(() => {
        if (projects && projects.length > 0) {
            setDimensions(prev => prev.map(d => enrichLaneDimension(d, projects)));
        }
    }, [projects]);

    const loadConfig = async () => {
        try {
            const config = await api.dimensions.get();
            if (config.dimensions?.length > 0) {
                const builtInIds = new Set(DEFAULT_DIMENSIONS.map(d => d.id));
                const customDims = config.dimensions.filter((d: Dimension) => !builtInIds.has(d.id));
                setDimensions([...DEFAULT_DIMENSIONS, ...customDims]);
            }
            if (config.focusGroup) {
                setFocusGroup(config.focusGroup);
                focusRef.current = config.focusGroup;
            }
        } catch {
            // Use defaults
        } finally {
            setLoaded(true);
        }
    };

    const saveDimensions = useCallback(async (dims: Dimension[]) => {
        setDimensions(dims);
        try {
            await api.dimensions.update({ dimensions: dims });
        } catch (err) {
            console.error('Failed to save dimensions:', err);
        }
    }, []);

    const saveFocusGroup = useCallback(async (paths: string[]) => {
        setFocusGroup(paths);
        focusRef.current = paths;
        try {
            await api.focusGroup.set(paths);
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, []);

    const addToFocus = useCallback(async (path: string) => {
        const current = focusRef.current;
        if (current.includes(path)) return;
        const next = [...current, path];
        setFocusGroup(next);
        focusRef.current = next;
        try {
            await api.focusGroup.set(next);
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, []);

    const removeFromFocus = useCallback(async (path: string) => {
        const current = focusRef.current;
        const next = current.filter(p => p !== path);
        setFocusGroup(next);
        focusRef.current = next;
        try {
            await api.focusGroup.set(next);
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, []);

    return {
        dimensions,
        focusGroup,
        loaded,
        saveDimensions,
        saveFocusGroup,
        addToFocus,
        removeFromFocus,
        getDimension: (id: string) => dimensions.find(d => d.id === id),
    };
}
