import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Tasks ──────────────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("marketingTasks")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
    },
});

export const listByStatus = query({
    args: {
        orgId: v.id("organizations"),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("marketingTasks")
            .withIndex("by_org_status", (idx) =>
                idx.eq("orgId", args.orgId).eq("status", args.status)
            )
            .collect();
    },
});

export const listByProject = query({
    args: {
        orgId: v.id("organizations"),
        projectPath: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("marketingTasks")
            .withIndex("by_org_project", (idx) =>
                idx.eq("orgId", args.orgId).eq("projectPath", args.projectPath)
            )
            .collect();
    },
});

export const listByPlatform = query({
    args: {
        orgId: v.id("organizations"),
        platform: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("marketingTasks")
            .withIndex("by_org_platform", (idx) =>
                idx.eq("orgId", args.orgId).eq("platform", args.platform)
            )
            .collect();
    },
});

export const get = query({
    args: { taskId: v.id("marketingTasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.taskId);
    },
});

// ─── Stats ───────────────────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const tasks = await ctx.db
            .query("marketingTasks")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byStatus: Record<string, number> = {};
        const byPlatform: Record<string, number> = {};
        const byProject: Record<string, number> = {};
        let overdue = 0;
        let upcoming = 0;
        const now = Date.now();
        const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

        for (const t of tasks) {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPlatform[t.platform] = (byPlatform[t.platform] || 0) + 1;
            byProject[t.projectPath] = (byProject[t.projectPath] || 0) + 1;
            if (t.dueDate && t.dueDate < now && t.status !== "posted" && t.status !== "archived") overdue++;
            if (t.dueDate && t.dueDate >= now && t.dueDate <= weekFromNow && t.status !== "posted" && t.status !== "archived") upcoming++;
        }

        return {
            total: tasks.length,
            byStatus,
            byPlatform,
            byProject,
            overdue,
            upcoming,
        };
    },
});

// ─── Create Task ─────────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        strategyId: v.optional(v.id("marketingStrategies")),
        planId: v.optional(v.id("marketingPlans")),
        projectId: v.optional(v.id("projects")),
        projectPath: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        platform: v.string(),
        contentType: v.string(),
        tone: v.optional(v.string()),
        priority: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        scheduledDate: v.optional(v.number()),
        contentDraft: v.optional(v.string()),
        aiGenerated: v.optional(v.boolean()),
        aiPrompt: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("marketingTasks", {
            orgId: args.orgId,
            strategyId: args.strategyId,
            planId: args.planId,
            projectId: args.projectId,
            projectPath: args.projectPath,
            title: args.title,
            description: args.description || "",
            platform: args.platform,
            contentType: args.contentType,
            tone: args.tone || "educational",
            status: "idea",
            priority: args.priority || "medium",
            dueDate: args.dueDate,
            scheduledDate: args.scheduledDate,
            contentDraft: args.contentDraft,
            aiGenerated: args.aiGenerated || false,
            aiPrompt: args.aiPrompt,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Task ─────────────────────────────────────────────────────────

export const update = mutation({
    args: {
        taskId: v.id("marketingTasks"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        platform: v.optional(v.string()),
        contentType: v.optional(v.string()),
        tone: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        scheduledDate: v.optional(v.number()),
        postedDate: v.optional(v.number()),
        contentDraft: v.optional(v.string()),
        assets: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
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
    args: { taskId: v.id("marketingTasks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.taskId);
    },
});

// ─── Bulk Status Update ──────────────────────────────────────────────────

export const bulkUpdateStatus = mutation({
    args: {
        taskIds: v.array(v.id("marketingTasks")),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        for (const taskId of args.taskIds) {
            const updates: Record<string, unknown> = { status: args.status, updatedAt: now };
            if (args.status === "posted") {
                updates.postedDate = now;
            }
            await ctx.db.patch(taskId, updates);
        }
        return { updated: args.taskIds.length };
    },
});

// ─── Generate Tasks from Strategy ────────────────────────────────────────

interface Tactic {
    id: string;
    platform: string;
    contentType: string;
    tone: string;
    description: string;
    example: string;
    frequency: string;
}

export const generateFromStrategy = mutation({
    args: {
        orgId: v.id("organizations"),
        strategyId: v.id("marketingStrategies"),
        projectId: v.optional(v.id("projects")),
        projectPath: v.string(),
        projectName: v.string(),
    },
    handler: async (ctx, args) => {
        const strategy = await ctx.db.get(args.strategyId);
        if (!strategy) throw new Error("Strategy not found");

        let tactics: Tactic[] = [];
        try {
            tactics = JSON.parse(strategy.tactics);
        } catch {
            throw new Error("Invalid strategy tactics");
        }

        const now = Date.now();
        const created: string[] = [];

        for (const tactic of tactics) {
            const taskId = await ctx.db.insert("marketingTasks", {
                orgId: args.orgId,
                strategyId: args.strategyId,
                projectId: args.projectId,
                projectPath: args.projectPath,
                title: `[${args.projectName}] ${tactic.description.slice(0, 80)}`,
                description: `${tactic.description}\n\n**Example:** ${tactic.example}\n\n**Frequency:** ${tactic.frequency}`,
                platform: tactic.platform,
                contentType: tactic.contentType,
                tone: tactic.tone,
                status: "idea",
                priority: "medium",
                aiGenerated: false,
                tags: [args.projectName.toLowerCase(), tactic.platform],
                createdAt: now,
                updatedAt: now,
            });
            created.push(taskId);
        }

        return { created: created.length, taskIds: created };
    },
});

// ─── List by Campaign ────────────────────────────────────────────────────

export const listByCampaign = query({
    args: {
        campaignId: v.id("campaigns"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("marketingTasks")
            .withIndex("by_campaign", (idx) => idx.eq("campaignId", args.campaignId))
            .collect();
    },
});

// ─── Generate Tasks from Campaign ────────────────────────────────────────

export const generateFromCampaign = mutation({
    args: {
        campaignId: v.id("campaigns"),
        projectPath: v.string(),
        projectName: v.string(),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) throw new Error("Campaign not found");

        const strategy = await ctx.db.get(campaign.strategyId);
        if (!strategy) throw new Error("Strategy not found");

        let tactics: Tactic[] = [];
        try {
            tactics = JSON.parse(strategy.tactics);
        } catch {
            throw new Error("Invalid strategy tactics");
        }

        const now = Date.now();
        const created: string[] = [];

        for (const tactic of tactics) {
            const taskId = await ctx.db.insert("marketingTasks", {
                orgId: campaign.orgId,
                strategyId: campaign.strategyId,
                projectId: campaign.projectId,
                projectPath: args.projectPath,
                title: `[${args.projectName}] ${tactic.description.slice(0, 80)}`,
                description: `${tactic.description}\n\n**Example:** ${tactic.example}\n\n**Frequency:** ${tactic.frequency}`,
                platform: tactic.platform,
                contentType: tactic.contentType,
                tone: tactic.tone,
                status: "idea",
                priority: "medium",
                aiGenerated: false,
                campaignId: args.campaignId,
                tags: [args.projectName.toLowerCase(), tactic.platform],
                createdAt: now,
                updatedAt: now,
            });
            created.push(taskId);
        }

        return { created: created.length, taskIds: created };
    },
});
