import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listTasks = query({
    args: {
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        projectPath: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let tasks;

        if (args.status) {
            tasks = await ctx.db.query("tasks")
                .withIndex("by_status", (qb) => qb.eq("status", args.status!))
                .collect();
        } else if (args.priority) {
            tasks = await ctx.db.query("tasks")
                .withIndex("by_priority", (qb) => qb.eq("priority", args.priority!))
                .collect();
        } else if (args.projectPath) {
            tasks = await ctx.db.query("tasks")
                .withIndex("by_project", (qb) => qb.eq("projectPath", args.projectPath!))
                .collect();
        } else {
            tasks = await ctx.db.query("tasks").collect();
        }

        return tasks.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const getTask = query({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const getTaskStats = query({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("tasks").collect();
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byProject: Record<string, number> = {};

        for (const t of all) {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            byProject[t.projectPath] = (byProject[t.projectPath] || 0) + 1;
        }

        return { total: all.length, byStatus, byPriority, byProject };
    },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const createTask = mutation({
    args: {
        projectPath: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        taskType: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("tasks", {
            projectPath: args.projectPath,
            title: args.title,
            description: args.description || "",
            taskType: args.taskType || "feature",
            status: args.status || "todo",
            priority: args.priority || "medium",
            effort: args.effort || "M",
            dueDate: args.dueDate,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateTask = mutation({
    args: {
        id: v.id("tasks"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        taskType: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        effort: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        githubIssueUrl: v.optional(v.string()),
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

export const deleteTask = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        // Delete relations
        const rels = await ctx.db
            .query("taskRelations")
            .withIndex("by_source", (q) => q.eq("sourceTaskId", args.id))
            .collect();
        for (const r of rels) await ctx.db.delete(r._id);
        await ctx.db.delete(args.id);
    },
});

export const bulkUpdateStatus = mutation({
    args: {
        ids: v.array(v.id("tasks")),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        for (const id of args.ids) {
            await ctx.db.patch(id, { status: args.status, updatedAt: now });
        }
    },
});
