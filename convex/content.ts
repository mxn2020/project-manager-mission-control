import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Content Plans ───────────────────────────────────────────────────────────

export const listPlans = query({
    args: {
        status: v.optional(v.string()),
        projectPath: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let plans;

        if (args.status) {
            plans = await ctx.db.query("contentPlans")
                .withIndex("by_status", (qb) => qb.eq("status", args.status!))
                .collect();
        } else if (args.projectPath) {
            plans = await ctx.db.query("contentPlans")
                .withIndex("by_project", (qb) => qb.eq("projectPath", args.projectPath!))
                .collect();
        } else {
            plans = await ctx.db.query("contentPlans").collect();
        }

        return plans.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const getPlan = query({
    args: { id: v.id("contentPlans") },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.id);
        if (!plan) return null;
        const items = await ctx.db
            .query("contentItems")
            .withIndex("by_plan", (q) => q.eq("planId", args.id))
            .collect();
        return { ...plan, items };
    },
});

export const createPlan = mutation({
    args: {
        projectPath: v.string(),
        releaseTag: v.string(),
        releaseTitle: v.optional(v.string()),
        releaseNotes: v.optional(v.string()),
        releaseDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("contentPlans", {
            projectPath: args.projectPath,
            releaseTag: args.releaseTag,
            releaseTitle: args.releaseTitle,
            releaseNotes: args.releaseNotes,
            releaseDate: args.releaseDate,
            status: "draft",
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updatePlan = mutation({
    args: {
        id: v.id("contentPlans"),
        status: v.optional(v.string()),
        releaseTitle: v.optional(v.string()),
        releaseNotes: v.optional(v.string()),
        releaseDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const clean: Record<string, any> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        clean.updatedAt = Date.now();
        await ctx.db.patch(id, clean);
    },
});

export const deletePlan = mutation({
    args: { id: v.id("contentPlans") },
    handler: async (ctx, args) => {
        const items = await ctx.db
            .query("contentItems")
            .withIndex("by_plan", (q) => q.eq("planId", args.id))
            .collect();
        for (const item of items) await ctx.db.delete(item._id);
        await ctx.db.delete(args.id);
    },
});

// ─── Content Items ───────────────────────────────────────────────────────────

export const addItem = mutation({
    args: {
        planId: v.id("contentPlans"),
        platform: v.string(),
        content: v.string(),
        scheduledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("contentItems", {
            planId: args.planId,
            platform: args.platform,
            content: args.content,
            status: "draft",
            scheduledAt: args.scheduledAt,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateItem = mutation({
    args: {
        id: v.id("contentItems"),
        content: v.optional(v.string()),
        status: v.optional(v.string()),
        scheduledAt: v.optional(v.number()),
        postedAt: v.optional(v.number()),
        metrics: v.optional(v.object({
            impressions: v.optional(v.number()),
            clicks: v.optional(v.number()),
            engagement: v.optional(v.number()),
            stars_delta: v.optional(v.number()),
        })),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const clean: Record<string, any> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        clean.updatedAt = Date.now();
        await ctx.db.patch(id, clean);
    },
});

export const deleteItem = mutation({
    args: { id: v.id("contentItems") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ─── Stats ───────────────────────────────────────────────────────────────────

export const getContentStats = query({
    args: {},
    handler: async (ctx) => {
        const plans = await ctx.db.query("contentPlans").collect();
        const items = await ctx.db.query("contentItems").collect();
        const byStatus: Record<string, number> = {};
        const byPlatform: Record<string, number> = {};

        for (const p of plans) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        for (const i of items) byPlatform[i.platform] = (byPlatform[i.platform] || 0) + 1;

        return { totalPlans: plans.length, totalItems: items.length, byStatus, byPlatform };
    },
});
