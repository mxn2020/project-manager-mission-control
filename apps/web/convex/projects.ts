import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Projects ───────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        lane: v.optional(v.string()),
        tier: v.optional(v.string()),
        priority: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let q;
        if (args.lane) {
            q = ctx.db
                .query("projects")
                .withIndex("by_org_lane", (idx) =>
                    idx.eq("orgId", args.orgId).eq("lane", args.lane!)
                );
        } else if (args.tier) {
            q = ctx.db
                .query("projects")
                .withIndex("by_org_tier", (idx) =>
                    idx.eq("orgId", args.orgId).eq("tier", args.tier!)
                );
        } else {
            q = ctx.db
                .query("projects")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId));
        }

        const projects = await q.collect();

        // Filter by priority if specified
        if (args.priority) {
            return projects.filter((p) => p.priority === args.priority);
        }
        return projects;
    },
});

// ─── Get Single Project ──────────────────────────────────────────────────

export const get = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.projectId);
    },
});

// ─── Get Project Stats ───────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byTier: Record<string, number> = {};
        const byLane: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byStack: Record<string, number> = {};

        for (const p of projects) {
            const tier = p.tier || "idea";
            const lane = p.lane || "uncategorized";
            const prio = p.priority || "medium";
            byTier[tier] = (byTier[tier] || 0) + 1;
            byLane[lane] = (byLane[lane] || 0) + 1;
            byPriority[prio] = (byPriority[prio] || 0) + 1;
            for (const s of p.stack || []) {
                byStack[s] = (byStack[s] || 0) + 1;
            }
        }

        return {
            total: projects.length,
            byTier,
            byLane,
            byPriority,
            byStack,
        };
    },
});

// ─── Create Project ──────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        tier: v.optional(v.string()),
        lane: v.string(),
        priority: v.optional(v.string()),
        oss: v.optional(v.boolean()),
        stack: v.optional(v.array(v.string())),
        repo: v.optional(v.string()),
        deployUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("projects", {
            orgId: args.orgId,
            name: args.name,
            description: args.description || "",
            tier: args.tier || "idea",
            lane: args.lane,
            priority: args.priority || "medium",
            oss: args.oss || false,
            stack: args.stack || [],
            repo: args.repo,
            deployUrl: args.deployUrl,
            lastActive: now,
            tags: args.tags || [],
            notes: args.notes,
            healthScore: 0,
            syncStatus: "synced",
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Project ──────────────────────────────────────────────────────

export const update = mutation({
    args: {
        projectId: v.id("projects"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        tier: v.optional(v.string()),
        lane: v.optional(v.string()),
        priority: v.optional(v.string()),
        oss: v.optional(v.boolean()),
        stack: v.optional(v.array(v.string())),
        repo: v.optional(v.string()),
        deployUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        notes: v.optional(v.string()),
        healthScore: v.optional(v.number()),
        syncStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { projectId, ...updates } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(projectId, clean);
        return projectId;
    },
});

// ─── Delete Project ──────────────────────────────────────────────────────

export const remove = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.projectId);
    },
});

// ─── Search Projects ─────────────────────────────────────────────────────

export const search = query({
    args: {
        orgId: v.id("organizations"),
        query: v.string(),
    },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const q = args.query.toLowerCase();
        return projects.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.description || "").toLowerCase().includes(q) ||
                p.tags.some((t) => t.toLowerCase().includes(q))
        );
    },
});
