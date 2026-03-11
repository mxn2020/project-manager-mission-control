// ─── Re-export from shared types package ─────────────────────────────────────
// All shared types and config are defined in @mission-control/types.
// Doc, Id, ProjectDoc, TaskDoc are derived from the Convex schema.

export type {
    Doc,
    Id,
    ProjectDoc,
    TaskDoc,
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

// ─── Web-app-specific types ──────────────────────────────────────────────────

import type { Id } from '@mission-control/types';

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
 * Safely extract an error message from an unknown error value.
 * Use in `catch (err: unknown)` blocks.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}
