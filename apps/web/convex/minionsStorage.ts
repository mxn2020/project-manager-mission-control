/**
 * Convex CRUD functions for the minions-sdk ConvexStorageAdapter.
 *
 * These four functions (get, list, set, remove) satisfy the contract
 * defined in `ConvexStorageAdapter` from `minions-sdk`.
 *
 * Each minion is stored as { id: string, data: string, orgId? } where
 * `data` contains the full JSON-serialised Minion object.
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Get ─────────────────────────────────────────────────────────────────────

export const get = query({
    args: { id: v.string() },
    handler: async (ctx, { id }) => {
        return await ctx.db
            .query("minions")
            .withIndex("by_minion_id", (q) => q.eq("id", id))
            .unique();
    },
});

// ─── List ────────────────────────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.optional(v.id("organizations")) },
    handler: async (ctx, args) => {
        if (args.orgId) {
            return await ctx.db
                .query("minions")
                .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
                .collect();
        }
        return await ctx.db.query("minions").collect();
    },
});

// ─── Set (upsert) ────────────────────────────────────────────────────────────

export const set = mutation({
    args: {
        id: v.string(),
        data: v.string(),
        orgId: v.optional(v.id("organizations")),
    },
    handler: async (ctx, { id, data, orgId }) => {
        const existing = await ctx.db
            .query("minions")
            .withIndex("by_minion_id", (q) => q.eq("id", id))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, { data });
        } else {
            await ctx.db.insert("minions", { id, data, orgId });
        }
    },
});

// ─── Remove ──────────────────────────────────────────────────────────────────

export const remove = mutation({
    args: { id: v.string() },
    handler: async (ctx, { id }) => {
        const existing = await ctx.db
            .query("minions")
            .withIndex("by_minion_id", (q) => q.eq("id", id))
            .unique();
        if (existing) await ctx.db.delete(existing._id);
    },
});
