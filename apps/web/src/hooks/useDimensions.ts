import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './useAuth';
import { DEFAULT_DIMENSIONS, enrichLaneDimension, type Dimension } from '../lib/dimensions';
import type { Project, Id } from '../lib/types';

/**
 * Hook to load/save dimensions + focus group config from the server.
 * Falls back to built-in defaults if server unavailable.
 */
export function useDimensions(projects?: Project[]) {
    const { orgId } = useAuth();
    const typedOrgId = orgId as Id<"organizations"> | undefined;

    const [dimensions, setDimensions] = useState<Dimension[]>(DEFAULT_DIMENSIONS);

    // Convex queries
    const dimConfig = useQuery(api.focusGroups.getDimensionsConfig, typedOrgId ? { orgId: typedOrgId } : "skip");
    const focusGroupData = useQuery(api.focusGroups.get, typedOrgId ? { orgId: typedOrgId } : "skip");

    const updateDimConfig = useMutation(api.focusGroups.updateDimensionsConfig);
    const updateFocusGroup = useMutation(api.focusGroups.update);

    const focusGroup = useMemo(() => focusGroupData?.projectIds || [], [focusGroupData]);
    // For pins, let's use focusGroup as the pinned projects for now, or use a separate pins array if we had one in dimConfig.
    // The previous code had focusPins on dimensions config.
    const focusPins = useMemo(() => {
        if (!dimConfig?.customDimensions) return [] as string[]; // Fallback, we'll store pins in customDimensions or add a dedicated field if needed.
        try {
            const parsed = JSON.parse(dimConfig.customDimensions) as { focusPins?: string[] };
            return parsed.focusPins || [];
        } catch {
            return [] as string[];
        }
    }, [dimConfig]);

    const loaded = dimConfig !== undefined && focusGroupData !== undefined;

    useEffect(() => {
        if (dimConfig?.customDimensions) {
            try {
                const parsed = JSON.parse(dimConfig.customDimensions) as { dimensions?: Dimension[] };
                if (parsed.dimensions?.length && parsed.dimensions.length > 0) {
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
        if (!typedOrgId) return;

        // Save to customDimensions stringified
        try {
            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) as Record<string, unknown> : {} as Record<string, unknown>;
            currentParsed.dimensions = dims;
            await updateDimConfig({ orgId: typedOrgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save dimensions:', err);
        }
    }, [typedOrgId, dimConfig, updateDimConfig]);

    const saveFocusGroup = useCallback(async (paths: string[]) => {
        if (!typedOrgId) return;
        try {
            await updateFocusGroup({ orgId: typedOrgId, action: 'set', projectIds: paths });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [typedOrgId, updateFocusGroup]);

    const addToFocus = useCallback(async (path: string) => {
        if (!typedOrgId || focusGroup.includes(path)) return;
        try {
            await updateFocusGroup({ orgId: typedOrgId, action: 'add', projectIds: [path] });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [typedOrgId, focusGroup, updateFocusGroup]);

    const removeFromFocus = useCallback(async (path: string) => {
        if (!typedOrgId) return;

        // Unpin if removed
        const nextPins = focusPins.filter((p: string) => p !== path);

        try {
            await updateFocusGroup({ orgId: typedOrgId, action: 'remove', projectIds: [path] });

            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) as Record<string, unknown> : {} as Record<string, unknown>;
            currentParsed.focusPins = nextPins;
            await updateDimConfig({ orgId: typedOrgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save focus group:', err);
        }
    }, [typedOrgId, focusPins, dimConfig, updateFocusGroup, updateDimConfig]);

    const togglePin = useCallback(async (path: string) => {
        if (!typedOrgId) return;
        const next = focusPins.includes(path)
            ? focusPins.filter((p: string) => p !== path)
            : [...focusPins, path];

        try {
            const currentParsed = dimConfig?.customDimensions ? JSON.parse(dimConfig.customDimensions) as Record<string, unknown> : {} as Record<string, unknown>;
            currentParsed.focusPins = next;
            await updateDimConfig({ orgId: typedOrgId, customDimensions: JSON.stringify(currentParsed) });
        } catch (err) {
            console.error('Failed to save pins:', err);
        }
    }, [typedOrgId, focusPins, dimConfig, updateDimConfig]);

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
