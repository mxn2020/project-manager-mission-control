import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Tasks ──────────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        projectPath: v.optional(v.string()),
        category: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let tasks;
        if (args.status) {
            tasks = await ctx.db
                .query("tasks")
                .withIndex("by_org_status", (idx) =>
                    idx.eq("orgId", args.orgId).eq("status", args.status!)
                )
                .collect();
        } else if (args.projectPath) {
            tasks = await ctx.db
                .query("tasks")
                .withIndex("by_org_project", (idx) =>
                    idx.eq("orgId", args.orgId).eq("projectPath", args.projectPath!)
                )
                .collect();
        } else {
            tasks = await ctx.db
                .query("tasks")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }

        if (args.priority) {
            tasks = tasks.filter((t) => t.priority === args.priority);
        }
        if (args.category) {
            tasks = tasks.filter((t) => t.category === args.category);
        }
        return tasks.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const get = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.taskId);
    },
});

// ─── Task Stats ──────────────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byProject: Record<string, number> = {};

        for (const t of tasks) {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            const proj = t.projectPath || "(none)";
            byProject[proj] = (byProject[proj] || 0) + 1;
        }
        return { total: tasks.length, byStatus, byPriority, byProject };
    },
});

// ─── Create Task ─────────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        projectPath: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        taskType: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        githubIssueUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        category: v.optional(v.string()),
        featureId: v.optional(v.id("features")),
        sprintId: v.optional(v.id("devSprints")),
        campaignId: v.optional(v.id("campaigns")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("tasks", {
            orgId: args.orgId,
            projectId: args.projectId,
            projectPath: args.projectPath || "",
            title: args.title,
            description: args.description,
            taskType: args.taskType || "feature",
            status: args.status || "todo",
            priority: args.priority || "medium",
            effort: args.effort,
            dueDate: args.dueDate,
            githubIssueUrl: args.githubIssueUrl,
            tags: args.tags || [],
            category: args.category || "general",
            featureId: args.featureId,
            sprintId: args.sprintId,
            campaignId: args.campaignId,
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Task ─────────────────────────────────────────────────────────

export const update = mutation({
    args: {
        taskId: v.id("tasks"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        taskType: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        githubIssueUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        projectPath: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const { taskId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(taskId, clean);
        return taskId;
    },
});

// ─── Delete Task ─────────────────────────────────────────────────────────

export const remove = mutation({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.taskId);
    },
});
