/**
 * React hook that wires the minions-sdk `Minions` client to Convex.
 *
 * ⚠️ STUB: ConvexStorageAdapter is not yet published in minions-sdk.
 * This returns no-op implementations until the SDK ships the adapter.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MinionRecord {
    id: string;
    type: string;
    data: Record<string, unknown>;
}

export interface MinionRegistry {
    list: () => MinionRecord[];
    types: string[];
}

export interface UseMinionsSDK {
    client: unknown;
    list: (filter?: Record<string, unknown>) => Promise<MinionRecord[]>;
    create: (typeSlug: string, input: Record<string, unknown>) => Promise<MinionRecord>;
    remove: (minion: MinionRecord) => Promise<void>;
    search: (query: string) => Promise<MinionRecord[]>;
    registry: MinionRegistry;
}

export function useMinionsSDK(): UseMinionsSDK {
    return {
        client: null,
        list: async () => [],
        create: async () => ({ id: '', type: '', data: {} }),
        remove: async () => { },
        search: async () => [],
        registry: { list: () => [], types: [] },
    };
}
