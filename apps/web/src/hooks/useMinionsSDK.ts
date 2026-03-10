/**
 * React hook that wires the minions-sdk `Minions` client to Convex.
 *
 * Uses the `ConvexStorageAdapter` from `minions-sdk` with the CRUD
 * functions deployed in `convex/minionsStorage.ts`.
 */
import { useMemo, useCallback, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
    Minions,
    ConvexStorageAdapter,
    TypeRegistry,
    type Minion,
    type CreateMinionInput,
    type StorageFilter,
} from 'minions-sdk';

/**
 * Hook return value.
 */
export interface UseMinionsSDK {
    /** The singleton Minions client instance. */
    client: Minions;
    /** List minions from Convex (with optional filter). */
    list: (filter?: StorageFilter) => Promise<Minion[]>;
    /** Create a new minion by type slug (e.g. "agent", "task", "note"). */
    create: (typeSlug: string, input: CreateMinionInput) => Promise<Minion>;
    /** Remove a minion from storage. */
    remove: (minion: Minion) => Promise<void>;
    /** Full-text search across stored minions. */
    search: (query: string) => Promise<Minion[]>;
    /** The built-in type registry. */
    registry: TypeRegistry;
}

export function useMinionsSDK(): UseMinionsSDK {
    const convex = useConvex();

    const { client, registry } = useMemo(() => {
        const storage = new ConvexStorageAdapter(convex as any, {
            functions: {
                get: api.minionsStorage.get as any,
                list: api.minionsStorage.list as any,
                set: api.minionsStorage.set as any,
                delete: api.minionsStorage.remove as any,
            },
        });

        const minions = new Minions({ storage });
        return { client: minions, registry: minions.types };
    }, [convex]);

    const list = useCallback(
        (filter?: StorageFilter) => client.listMinions(filter),
        [client],
    );

    const create = useCallback(
        async (typeSlug: string, input: CreateMinionInput) => {
            const wrapper = await client.create(typeSlug, input);
            return wrapper.data;
        },
        [client],
    );

    const remove = useCallback(
        (minion: Minion) => client.remove(minion),
        [client],
    );

    const search = useCallback(
        (query: string) => client.searchMinions(query),
        [client],
    );

    return { client, list, create, remove, search, registry };
}
