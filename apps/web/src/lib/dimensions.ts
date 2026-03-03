// ─── Dimension System ─────────────────────────────────────────────────────────
// Provides a generalized way to group/sort projects across Grid, Tree, Kanban,
// and Focus views. Built-in dimensions: tier, priority, lane, open_tasks.

import { TIER_ORDER, TIER_CONFIG, PRIORITY_ORDER, PRIORITY_CONFIG, LANE_COLORS, type Tier, type Priority, type Project } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubDimension {
    key: string;
    label: string;
    icon?: string;
    color?: string;
    bg?: string;
    order: number;
}

export interface Dimension {
    id: string;
    label: string;
    icon: string;
    builtIn: boolean;
    field: string;            // PROJECT property name, or 'computed' for derived
    subDimensions: SubDimension[];
    colorMap?: Record<string, string>;
}

export interface DimensionConfig {
    dimensions: Dimension[];
    focusGroup: string[];     // Manually pinned project paths
}

// ─── Built-in Dimensions ──────────────────────────────────────────────────────

export const BUILTIN_TIER: Dimension = {
    id: 'tier',
    label: 'Lifecycle Tier',
    icon: '🎯',
    builtIn: true,
    field: 'tier',
    subDimensions: TIER_ORDER.map((t, i) => ({
        key: t,
        label: TIER_CONFIG[t].label,
        icon: TIER_CONFIG[t].emoji,
        color: TIER_CONFIG[t].color,
        bg: TIER_CONFIG[t].bg,
        order: i,
    })),
    colorMap: Object.fromEntries(TIER_ORDER.map(t => [t, TIER_CONFIG[t].color])),
};

export const BUILTIN_PRIORITY: Dimension = {
    id: 'priority',
    label: 'Priority',
    icon: '⚡',
    builtIn: true,
    field: 'priority',
    subDimensions: PRIORITY_ORDER.map((p, i) => ({
        key: p,
        label: PRIORITY_CONFIG[p].label,
        color: PRIORITY_CONFIG[p].color,
        order: i,
    })),
    colorMap: Object.fromEntries(PRIORITY_ORDER.map(p => [p, PRIORITY_CONFIG[p].color])),
};

export const BUILTIN_LANE: Dimension = {
    id: 'lane',
    label: 'Lane',
    icon: '🛤️',
    builtIn: true,
    field: 'lane',
    subDimensions: Object.entries(LANE_COLORS).map(([key, color], i) => ({
        key,
        label: key,
        color,
        order: i,
    })),
    colorMap: { ...LANE_COLORS },
};

export const BUILTIN_OPEN_TASKS: Dimension = {
    id: 'open_tasks',
    label: 'Open Tasks',
    icon: '📋',
    builtIn: true,
    field: 'computed',
    subDimensions: [
        { key: '0', label: 'No tasks', icon: '✨', color: '#6b7280', order: 0 },
        { key: '1-3', label: '1–3 tasks', icon: '📝', color: '#60a5fa', order: 1 },
        { key: '4-10', label: '4–10 tasks', icon: '📋', color: '#fbbf24', order: 2 },
        { key: '10+', label: '10+ tasks', icon: '🔥', color: '#f87171', order: 3 },
    ],
    colorMap: { '0': '#6b7280', '1-3': '#60a5fa', '4-10': '#fbbf24', '10+': '#f87171' },
};

export const DEFAULT_DIMENSIONS: Dimension[] = [
    BUILTIN_TIER,
    BUILTIN_PRIORITY,
    BUILTIN_LANE,
    BUILTIN_OPEN_TASKS,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the dimension value for a project.
 * For built-in dimensions this reads the corresponding field;
 * for computed dimensions (open_tasks) it needs task counts passed in.
 */
export function getProjectDimensionValue(
    project: Project,
    dimension: Dimension,
    taskCounts?: Record<string, number>,
): string {
    if (dimension.id === 'open_tasks') {
        const count = taskCounts?.[project.path] ?? 0;
        if (count === 0) return '0';
        if (count <= 3) return '1-3';
        if (count <= 10) return '4-10';
        return '10+';
    }

    const val = (project as any)[dimension.field];
    return typeof val === 'string' ? val : String(val ?? 'unknown');
}

/**
 * Group projects by a dimension, returning { subDimensionKey → projects[] }.
 * Sub-dimensions with no projects are included if they are defined in the dimension.
 */
export function groupByDimension(
    projects: Project[],
    dimension: Dimension,
    taskCounts?: Record<string, number>,
): { key: string; sub: SubDimension; projects: Project[] }[] {
    // Group projects
    const groups: Record<string, Project[]> = {};
    for (const sub of dimension.subDimensions) groups[sub.key] = [];

    for (const p of projects) {
        const val = getProjectDimensionValue(p, dimension, taskCounts);
        if (!groups[val]) groups[val] = [];
        groups[val].push(p);
    }

    // Build ordered result
    const ordered = dimension.subDimensions.map(sub => ({
        key: sub.key,
        sub,
        projects: groups[sub.key] || [],
    }));

    // Add any extra groups not in sub-dimensions
    const knownKeys = new Set(dimension.subDimensions.map(s => s.key));
    const extraKeys = Object.keys(groups).filter(k => !knownKeys.has(k) && groups[k].length > 0);
    for (const k of extraKeys.sort()) {
        ordered.push({
            key: k,
            sub: { key: k, label: k, color: '#6b7280', order: ordered.length },
            projects: groups[k],
        });
    }

    return ordered;
}

/**
 * Get a sub-dimension config by key, with fallback.
 */
export function getSubDimension(dimension: Dimension, key: string): SubDimension {
    return dimension.subDimensions.find(s => s.key === key) || {
        key,
        label: key,
        color: '#6b7280',
        order: 999,
    };
}

/**
 * Update lane sub-dimensions from actual project data (auto-discover).
 */
export function enrichLaneDimension(dimension: Dimension, projects: Project[]): Dimension {
    if (dimension.id !== 'lane') return dimension;
    const lanes = new Set(projects.map(p => p.lane));
    const existingKeys = new Set(dimension.subDimensions.map(s => s.key));
    const newSubs = [...dimension.subDimensions];
    for (const lane of lanes) {
        if (!existingKeys.has(lane)) {
            newSubs.push({
                key: lane,
                label: lane,
                color: LANE_COLORS[lane] || '#6b7280',
                order: newSubs.length,
            });
        }
    }
    return { ...dimension, subDimensions: newSubs, colorMap: { ...dimension.colorMap, ...Object.fromEntries(newSubs.map(s => [s.key, s.color || '#6b7280'])) } };
}
