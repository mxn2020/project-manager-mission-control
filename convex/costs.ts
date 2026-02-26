import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listCosts = query({
    args: {
        projectPath: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (args.projectPath) {
            return await ctx.db.query("costEntries")
                .withIndex("by_project", (qb) => qb.eq("projectPath", args.projectPath!))
                .collect();
        }
        return await ctx.db.query("costEntries").collect();
    },
});

export const getCostSummary = query({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("costEntries").collect();

        let totalMonthly = 0;
        const byCategory: Record<string, number> = {};
        const byProject: Record<string, number> = {};
        const byCurrency: Record<string, number> = {};

        for (const e of all) {
            totalMonthly += e.monthlyCost;
            byCategory[e.category] = (byCategory[e.category] || 0) + e.monthlyCost;
            byProject[e.projectPath] = (byProject[e.projectPath] || 0) + e.monthlyCost;
            byCurrency[e.currency] = (byCurrency[e.currency] || 0) + e.monthlyCost;
        }

        return {
            totalMonthly,
            totalAnnual: totalMonthly * 12,
            entryCount: all.length,
            byCategory,
            byProject,
            byCurrency,
        };
    },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const createCost = mutation({
    args: {
        projectPath: v.string(),
        category: v.string(),
        name: v.string(),
        monthlyCost: v.number(),
        currency: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("costEntries", {
            projectPath: args.projectPath,
            category: args.category,
            name: args.name,
            monthlyCost: args.monthlyCost,
            currency: args.currency || "USD",
            notes: args.notes,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateCost = mutation({
    args: {
        id: v.id("costEntries"),
        category: v.optional(v.string()),
        name: v.optional(v.string()),
        monthlyCost: v.optional(v.number()),
        currency: v.optional(v.string()),
        notes: v.optional(v.string()),
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

export const deleteCost = mutation({
    args: { id: v.id("costEntries") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
