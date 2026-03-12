import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Sprints ────────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        let sprints;
        if (args.status) {
            sprints = await ctx.db
                .query("devSprints")
                .withIndex("by_org_status", (idx) =>
                    idx.eq("orgId", args.orgId).eq("status", args.status!)
                )
                .collect();
        } else {
            sprints = await ctx.db
                .query("devSprints")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }

        if (args.projectId) {
            sprints = sprints.filter((s) => s.projectId === args.projectId);
        }
        return sprints.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const get = query({
    args: { sprintId: v.id("devSprints") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.sprintId);
    },
});

// ─── Sprint Stats ────────────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const sprints = await ctx.db
            .query("devSprints")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byStatus: Record<string, number> = {};
        for (const s of sprints) {
            byStatus[s.status] = (byStatus[s.status] || 0) + 1;
        }
        return { total: sprints.length, byStatus };
    },
});

// ─── Create Sprint ───────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        name: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        featureIds: v.optional(v.array(v.id("features"))),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("devSprints", {
            orgId: args.orgId,
            projectId: args.projectId,
            name: args.name,
            description: args.description || "",
            status: args.status || "planning",
            startDate: args.startDate,
            endDate: args.endDate,
            featureIds: args.featureIds || [],
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Create from Features ────────────────────────────────────────────────

export const createFromFeatures = mutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        name: v.string(),
        description: v.optional(v.string()),
        featureIds: v.array(v.id("features")),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        // Validate all features exist
        for (const fId of args.featureIds) {
            const f = await ctx.db.get(fId);
            if (!f) throw new Error(`Feature ${fId} not found`);
        }

        const now = Date.now();
        return await ctx.db.insert("devSprints", {
            orgId: args.orgId,
            projectId: args.projectId,
            name: args.name,
            description: args.description || "",
            status: "planning",
            startDate: args.startDate,
            endDate: args.endDate,
            featureIds: args.featureIds,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Sprint ───────────────────────────────────────────────────────

export const update = mutation({
    args: {
        sprintId: v.id("devSprints"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        featureIds: v.optional(v.array(v.id("features"))),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { sprintId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(sprintId, clean);
        return sprintId;
    },
});

// ─── Delete Sprint ───────────────────────────────────────────────────────

export const remove = mutation({
    args: { sprintId: v.id("devSprints") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.sprintId);
    },
});

// ─── Generate Dev Tasks from Sprint ──────────────────────────────────────

export const generateDevTasks = mutation({
    args: {
        sprintId: v.id("devSprints"),
        orgId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const sprint = await ctx.db.get(args.sprintId);
        if (!sprint) throw new Error("Sprint not found");

        const now = Date.now();
        const created: string[] = [];

        for (const featureId of sprint.featureIds) {
            const feature = await ctx.db.get(featureId);
            if (!feature) continue;

            // Generate 3 tasks per feature: implement, test, docs
            const taskTemplates = [
                { title: `Implement: ${feature.title}`, taskType: "feature", effort: feature.effort || "M" },
                { title: `Write tests for: ${feature.title}`, taskType: "chore", effort: "S" },
                { title: `Update docs for: ${feature.title}`, taskType: "docs", effort: "S" },
            ];

            for (const tmpl of taskTemplates) {
                const taskId = await ctx.db.insert("tasks", {
                    orgId: args.orgId,
                    projectId: sprint.projectId,
                    projectPath: "",
                    title: tmpl.title,
                    description: feature.description || "",
                    taskType: tmpl.taskType,
                    status: "todo",
                    priority: feature.priority || "medium",
                    effort: tmpl.effort,
                    category: "development",
                    featureId: featureId,
                    sprintId: args.sprintId,
                    tags: feature.tags || [],
                    createdAt: now,
                    updatedAt: now,
                });
                created.push(taskId);
            }
        }

        return { created: created.length, taskIds: created };
    },
});
