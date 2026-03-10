import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './useAuth';
import { DEFAULT_DIMENSIONS, enrichLaneDimension, type Dimension } from '../lib/dimensions';
import type { Project } from '../lib/types';

/**
 * Hook to load/save dimensions + focus group config from the server.
 * Falls back to built-in defaults if server unavailable.
 */
export function useDimensions(projects?: Project[]) {
    const { orgId } = useAuth() as any;

    const [dimensions, setDimensions] = useState<Dimension[]>(DEFAULT_DIMENSIONS);

    // Convex queries
    const dimConfig = useQuery(api.focusGroups.getDimensionsConfig, orgId ? { orgId } : "skip");
    const focusGroupData = useQuery(api.focusGroups.get, orgId ? { orgId } : "skip");

    const updateDimConfig = useMutation(api.focusGroups.updateDimensionsConfig);
    const updateFocusGroup = useMutation(api.focusGroups.update);

    const focusGroup = useMemo(() => focusGroupData?.projectIds || [], [focusGroupData]);
    // For pins, let's use focusGroup as the pinned projects for now, or use a separate pins array if we had one in dimConfig.
    // The previous code had focusPins on dimensions config.
    const focusPins = useMemo(() => {
        if (!dimConfig?.customDimensions) return []; // Fallback, we'll store pins in customDimensions or add a dedicated field if needed.
        try {
            const parsed = JSON.parse(dimConfig.customDimensions);
            return parsed.focusPins || [];
        } catch {
            return [];
        }
    }, [dimConfig]);

    const loaded = dimConfig !== undefined && focusGroupData !== undefined;

    useEffect(() => {
        if (dimConfig?.customDimensions) {
            try {
                const parsed = JSON.parse(dimConfig.customDimensions);
                if (parsed.dimensions?.length > 0) {
                    const builtInIds = new Set(DEFAULT_DIMENSIONS.map(d => d.id));
                    const customDims = parsed.dimensions.filter((d: Dimension) => !builtInIds.has(d.id));
                    setDimensions([...DEFAULT_DIMENSIONS, ...customDims]);
                }
            } catch {
                // Ignore parsing errors
            }
        }
    }, [dimConfig]);

    // Enrich lane dimension with actual project data
    useEffect(() => {
        if (projects && projects.length > 0) {
            setDimensions(prev => prev.map(d => enrichLaneDimension(d, projects)));
        }
    }, [projects]);

    const saveDimensions = useCallback(async (dims: Dimension[]) => {
        setDimensions(dims);
        if (!orgId) return;

        // Save to customDimensions stringified
        try {
            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) : {};
            currentParsed.dimensions = dims;
            await updateDimConfig({ orgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save dimensions:', err);
        }
    }, [orgId, dimConfig, updateDimConfig]);

    const saveFocusGroup = useCallback(async (paths: string[]) => {
        if (!orgId) return;
        try {
            await updateFocusGroup({ orgId, action: 'set', projectIds: paths as any });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [orgId, updateFocusGroup]);

    const addToFocus = useCallback(async (path: string) => {
        if (!orgId || focusGroup.includes(path)) return;
        try {
            await updateFocusGroup({ orgId, action: 'add', projectIds: [path] as any });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [orgId, focusGroup, updateFocusGroup]);

    const removeFromFocus = useCallback(async (path: string) => {
        if (!orgId) return;

        // Unpin if removed
        const nextPins = focusPins.filter((p: string) => p !== path);

        try {
            await updateFocusGroup({ orgId, action: 'remove', projectIds: [path as any] });

            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) : {};
            currentParsed.focusPins = nextPins;
            await updateDimConfig({ orgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [orgId, focusPins, dimConfig, updateFocusGroup, updateDimConfig]);

    const togglePin = useCallback(async (path: string) => {
        if (!orgId) return;
        const next = focusPins.includes(path)
            ? focusPins.filter((p: string) => p !== path)
            : [...focusPins, path];

        try {
            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) : {};
            currentParsed.focusPins = next;
            await updateDimConfig({ orgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save pins:', err);
        }
    }, [orgId, focusPins, dimConfig, updateDimConfig]);

    const isPinned = useCallback((path: string) => focusPins.includes(path), [focusPins]);

    return {
        dimensions,
        focusGroup,
        focusPins,
        loaded,
        saveDimensions,
        saveFocusGroup,
        addToFocus,
        removeFromFocus,
        togglePin,
        isPinned,
        getDimension: (id: string) => dimensions.find(d => d.id === id),
    };
}
