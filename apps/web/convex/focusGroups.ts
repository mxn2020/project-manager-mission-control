import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Get Focus Group ─────────────────────────────────────────────────────

export const get = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("focusGroups")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .first();
    },
});

// ─── Update Focus Group ──────────────────────────────────────────────────

export const update = mutation({
    args: {
        orgId: v.id("organizations"),
        action: v.string(), // add | remove | set | clear
        projectIds: v.optional(v.array(v.id("projects"))),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("focusGroups")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .first();

        let currentIds = existing?.projectIds || [];

        switch (args.action) {
            case "add": {
                const toAdd = args.projectIds || [];
                const idSet = new Set([...currentIds.map(String), ...toAdd.map(String)]);
                currentIds = [...idSet] as typeof currentIds;
                break;
            }
            case "remove": {
                const toRemove = new Set((args.projectIds || []).map(String));
                currentIds = currentIds.filter((id) => !toRemove.has(String(id)));
                break;
            }
            case "set":
                currentIds = args.projectIds || [];
                break;
            case "clear":
                currentIds = [];
                break;
            default:
                throw new Error(`Unknown action: ${args.action}. Use add, remove, set, or clear.`);
        }

        if (existing) {
            await ctx.db.patch(existing._id, {
                projectIds: currentIds,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert("focusGroups", {
                orgId: args.orgId,
                projectIds: currentIds,
                updatedAt: Date.now(),
            });
        }

        return { projectIds: currentIds, total: currentIds.length };
    },
});

// ─── Dimensions Config ───────────────────────────────────────────────────

export const getDimensionsConfig = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("dimensionsConfig")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .first();
    },
});

export const updateDimensionsConfig = mutation({
    args: {
        orgId: v.id("organizations"),
        customDimensions: v.optional(v.string()),
        sortConfig: v.optional(v.string()),
        groupConfig: v.optional(v.string()),
        focusGroup: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("dimensionsConfig")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .first();

        const { orgId, ...updates } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }

        if (existing) {
            await ctx.db.patch(existing._id, clean);
            return existing._id;
        } else {
            return await ctx.db.insert("dimensionsConfig", {
                orgId,
                updatedAt: Date.now(),
                ...clean,
            } as any);
        }
    },
});
