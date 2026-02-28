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

