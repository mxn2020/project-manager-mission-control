import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Features ───────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
        priority: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let features;
        if (args.status) {
            features = await ctx.db
                .query("features")
                .withIndex("by_org_status", (idx) =>
                    idx.eq("orgId", args.orgId).eq("status", args.status!)
                )
                .collect();
        } else {
            features = await ctx.db
                .query("features")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }

        if (args.projectId) {
            features = features.filter((f) => f.projectId === args.projectId);
        }
        if (args.priority) {
            features = features.filter((f) => f.priority === args.priority);
        }
        return features.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("features")
            .withIndex("by_project", (idx) => idx.eq("projectId", args.projectId))
            .collect();
    },
});

export const get = query({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.featureId);
    },
});

// ─── Feature Stats ───────────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const features = await ctx.db
            .query("features")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byProject: Record<string, number> = {};

        for (const f of features) {
            byStatus[f.status] = (byStatus[f.status] || 0) + 1;
            byPriority[f.priority] = (byPriority[f.priority] || 0) + 1;
            const proj = f.projectId || "(none)";
            byProject[proj] = (byProject[proj] || 0) + 1;
        }
        return { total: features.length, byStatus, byPriority, byProject };
    },
});

// ─── Create Feature ──────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        title: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        category: v.optional(v.string()),
        targetRelease: v.optional(v.string()),
        sourceIdeaId: v.optional(v.id("ideas")),
        tags: v.optional(v.array(v.string())),
        acceptanceCriteria: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("features", {
            orgId: args.orgId,
            projectId: args.projectId,
            title: args.title,
            description: args.description || "",
            status: args.status || "proposed",
            priority: args.priority || "medium",
            effort: args.effort,
            category: args.category,
            targetRelease: args.targetRelease,
            sourceIdeaId: args.sourceIdeaId,
            tags: args.tags || [],
            acceptanceCriteria: args.acceptanceCriteria,
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Feature ──────────────────────────────────────────────────────

export const update = mutation({
    args: {
        featureId: v.id("features"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        category: v.optional(v.string()),
        targetRelease: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        acceptanceCriteria: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const { featureId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(featureId, clean);
        return featureId;
    },
});

// ─── Delete Feature ──────────────────────────────────────────────────────

export const remove = mutation({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.featureId);
    },
});

// ─── Promote Idea → Feature ─────────────────────────────────────────────

export const promoteFromIdea = mutation({
    args: {
        ideaId: v.id("ideas"),
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        category: v.optional(v.string()),
        targetRelease: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const idea = await ctx.db.get(args.ideaId);
        if (!idea) throw new Error("Idea not found");

        const now = Date.now();
        const featureId = await ctx.db.insert("features", {
            orgId: args.orgId,
            projectId: args.projectId,
            title: idea.title,
            description: idea.body || "",
            status: "proposed",
            priority: args.priority || ((idea.score || 5) >= 8 ? "high" : (idea.score || 5) >= 5 ? "medium" : "low"),
            effort: args.effort,
            category: args.category,
            targetRelease: args.targetRelease,
            sourceIdeaId: args.ideaId,
            tags: idea.tags || [],
            createdAt: now,
            updatedAt: now,
        });

        // Mark idea as promoted
        await ctx.db.patch(args.ideaId, {
            promotedTo: "feature",
            promotedEntityId: featureId,
            updatedAt: now,
        });

        return { featureId, ideaId: args.ideaId };
    },
});
