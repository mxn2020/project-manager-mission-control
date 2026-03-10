import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Projects ───────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        lane: v.optional(v.string()),
        tier: v.optional(v.string()),
        priority: v.optional(v.string()),
        scope: v.optional(v.string()), // "main" | "child" | undefined (all)
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
        } else if (args.scope) {
            q = ctx.db
                .query("projects")
                .withIndex("by_org_scope", (idx) =>
                    idx.eq("orgId", args.orgId).eq("projectScope", args.scope!)
                );
        } else {
            q = ctx.db
                .query("projects")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId));
        }

        let projects = await q.collect();

        // Filter by priority if specified
        if (args.priority) {
            projects = projects.filter((p) => p.priority === args.priority);
        }
        // Filter by scope if used with lane/tier index
        if (args.scope && (args.lane || args.tier)) {
            projects = projects.filter((p) => p.projectScope === args.scope);
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

// ─── Get Project by Path (repo URL) ─────────────────────────────────────

export const getByPath = query({
    args: { path: v.string() },
    handler: async (ctx, args) => {
        // path in the frontend is the project's repo field
        const projects = await ctx.db.query("projects").collect();
        return projects.find(p => p.repo === args.path) || null;
    },
});

// ─── Update Project by Path ─────────────────────────────────────────────

export const updateByPath = mutation({
    args: {
        path: v.string(),
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
        const { path, ...updates } = args;
        const projects = await ctx.db.query("projects").collect();
        const project = projects.find(p => p.repo === path) || projects.find(p => p.name === path);
        if (!project) throw new Error(`Project not found: ${path}`);
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(project._id, clean);
        return project._id;
    },
});

export const getStats = query({
    args: {
        orgId: v.id("organizations"),
        scope: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let projects;
        if (args.scope) {
            projects = await ctx.db
                .query("projects")
                .withIndex("by_org_scope", (idx) =>
                    idx.eq("orgId", args.orgId).eq("projectScope", args.scope!)
                )
                .collect();
        } else {
            projects = await ctx.db
                .query("projects")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }

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
            projectScope: "main",
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

// ─── Bulk Sync Repos from PROJECT.yaml ───────────────────────────────────

export const bulkSyncRepos = mutation({
    args: {
        orgId: v.id("organizations"),
        entries: v.array(
            v.object({
                name: v.string(),
                repo: v.string(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const nameMap = new Map(projects.map((p) => [p.name.toLowerCase(), p]));
        let updated = 0;
        let skipped = 0;
        const unmatched: string[] = [];

        for (const entry of args.entries) {
            const project = nameMap.get(entry.name.toLowerCase());
            if (project) {
                if (project.repo !== entry.repo) {
                    await ctx.db.patch(project._id, {
                        repo: entry.repo,
                        updatedAt: Date.now(),
                    });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                unmatched.push(entry.name);
            }
        }

        return { updated, skipped, unmatched };
    },
});
