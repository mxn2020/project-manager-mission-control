/**
 * React hook that wires the minions-sdk `Minions` client to Convex.
 *
 * ⚠️ STUB: ConvexStorageAdapter is not yet published in minions-sdk.
 * This returns no-op implementations until the SDK ships the adapter.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UseMinionsSDK {
    client: any;
    list: (filter?: any) => Promise<any[]>;
    create: (typeSlug: string, input: any) => Promise<any>;
    remove: (minion: any) => Promise<void>;
    search: (query: string) => Promise<any[]>;
    registry: any;
}

export function useMinionsSDK(): UseMinionsSDK {
    return {
        client: null,
        list: async () => [],
        create: async () => ({ id: '', type: '', data: {} }),
        remove: async () => { },
        search: async () => [],
        registry: { types: [] },
    };
}
