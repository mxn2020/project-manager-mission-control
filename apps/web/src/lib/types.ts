// ─── Re-export from shared types package ─────────────────────────────────────
// All shared types and config are defined in @mission-control/types.
// Web-app-specific additions (e.g. Workspace nav config) are also there.

export type {
    Tier,
    Priority,
    TaskStatus,
    Project,
    StatusData,
    Task,
    Workspace,
} from '@mission-control/types';

export {
    TIER_ORDER,
    PRIORITY_ORDER,
    TIER_CONFIG,
    PRIORITY_CONFIG,
    LANE_COLORS,
    colors,
    WORKSPACES,
} from '@mission-control/types';

// ─── Convex-specific types ───────────────────────────────────────────────────

import type { Doc, Id } from '../../convex/_generated/dataModel';
export type { Doc, Id };

/**
 * Shape returned by `api.auth.me` query.
 */
export interface AuthUser {
    id: Id<'users'>;
    email: string;
    name?: string;
    role?: string;
    orgId?: Id<'organizations'>;
    orgName?: string;
    orgSlug?: string;
}

/**
 * A project document from Convex, including the `_id` and `_creationTime` fields.
 */
export type ConvexProject = Doc<'projects'>;

/**
 * A task document from Convex.
 */
export type ConvexTask = Doc<'tasks'>;

/**
 * A cost entry document from Convex.
 */
export type ConvexCostEntry = Doc<'costEntries'>;

/**
 * Safely extract an error message from an unknown error value.
 * Use in `catch (err: unknown)` blocks.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}
