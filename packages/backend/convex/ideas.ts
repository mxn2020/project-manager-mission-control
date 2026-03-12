import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Ideas ──────────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        category: v.optional(v.string()),
        includeArchived: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        let ideas = await ctx.db
            .query("ideas")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        if (!args.includeArchived) {
            ideas = ideas.filter((i) => !i.archived);
        }
        if (args.category) {
            ideas = ideas.filter((i) => i.category === args.category);
        }
        return ideas.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const get = query({
    args: { ideaId: v.id("ideas") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.ideaId);
    },
});

// ─── Create Idea ─────────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        title: v.string(),
        body: v.optional(v.string()),
        category: v.optional(v.string()),
        score: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        linkedProjects: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("ideas", {
            orgId: args.orgId,
            title: args.title,
            body: args.body || "",
            category: args.category || "other",
            score: args.score || 5,
            tags: args.tags || [],
            linkedProjects: args.linkedProjects || [],
            linkedIdeas: [],
            archived: false,
            status: "active",
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Idea ─────────────────────────────────────────────────────────

export const update = mutation({
    args: {
        ideaId: v.id("ideas"),
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        category: v.optional(v.string()),
        score: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        linkedProjects: v.optional(v.array(v.string())),
        linkedIdeas: v.optional(v.array(v.string())),
        archived: v.optional(v.boolean()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { ideaId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(ideaId, clean);
        return ideaId;
    },
});

// ─── Delete Idea ─────────────────────────────────────────────────────────

export const remove = mutation({
    args: { ideaId: v.id("ideas") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.ideaId);
    },
});

// ─── Archive Idea ────────────────────────────────────────────────────────

export const archive = mutation({
    args: { ideaId: v.id("ideas") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.ideaId, { archived: true, updatedAt: Date.now() });
    },
});

// ─── Promote Idea → Task ─────────────────────────────────────────────────

export const promote = mutation({
    args: {
        ideaId: v.id("ideas"),
        orgId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const idea = await ctx.db.get(args.ideaId);
        if (!idea) throw new Error("Idea not found");

        const now = Date.now();
        const taskId = await ctx.db.insert("tasks", {
            orgId: args.orgId,
            projectPath: (idea.linkedProjects || [])[0] || "",
            title: idea.title,
            description: idea.body || "",
            taskType: "feature",
            status: "todo",
            priority: (idea.score || 5) >= 8 ? "high" : (idea.score || 5) >= 5 ? "medium" : "low",
            effort: "M",
            tags: idea.tags || [],
            createdAt: now,
            updatedAt: now,
        });

        // Mark idea as promoted to task
        await ctx.db.patch(args.ideaId, {
            archived: true,
            promotedTo: "task",
            promotedEntityId: taskId,
            updatedAt: now,
        });

        return { taskId, archivedIdeaId: args.ideaId };
    },
});

// ─── Combine Ideas ───────────────────────────────────────────────────────

export const combine = mutation({
    args: {
        orgId: v.id("organizations"),
        ideaIds: v.array(v.id("ideas")),
        title: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (args.ideaIds.length < 2) throw new Error("Need at least 2 ideas");

        const ideas = [];
        for (const id of args.ideaIds) {
            const idea = await ctx.db.get(id);
            if (idea) ideas.push(idea);
        }
        if (ideas.length < 2) throw new Error("Could not find enough ideas");

        const combinedBody = ideas
            .map((i) => `## ${i.title}\n${i.body || ""}`)
            .join("\n\n---\n\n");
        const allTags = [...new Set(ideas.flatMap((i) => i.tags || []))];
        const maxScore = Math.max(...ideas.map((i) => i.score || 5));
        const allProjects = [...new Set(ideas.flatMap((i) => i.linkedProjects || []))];

        const now = Date.now();
        const combinedId = await ctx.db.insert("ideas", {
            orgId: args.orgId,
            title: args.title || ideas.map((i) => i.title).join(" + "),
            body: combinedBody,
            category: ideas[0].category || "other",
            score: maxScore,
            tags: allTags,
            linkedProjects: allProjects,
            linkedIdeas: [],
            archived: false,
            status: "active",
            createdAt: now,
            updatedAt: now,
        });

        // Archive originals
        for (const id of args.ideaIds) {
            await ctx.db.patch(id, { archived: true, updatedAt: now });
        }

        return { combinedId, archivedIds: args.ideaIds };
    },
});
