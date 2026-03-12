import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Campaigns ──────────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.string()),
        strategyId: v.optional(v.id("marketingStrategies")),
    },
    handler: async (ctx, args) => {
        let campaigns;
        if (args.status) {
            campaigns = await ctx.db
                .query("campaigns")
                .withIndex("by_org_status", (idx) =>
                    idx.eq("orgId", args.orgId).eq("status", args.status!)
                )
                .collect();
        } else {
            campaigns = await ctx.db
                .query("campaigns")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }

        if (args.strategyId) {
            campaigns = campaigns.filter((c) => c.strategyId === args.strategyId);
        }
        return campaigns.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const get = query({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.campaignId);
    },
});

// ─── Campaign Stats ──────────────────────────────────────────────────────

export const getStats = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const campaigns = await ctx.db
            .query("campaigns")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byStatus: Record<string, number> = {};
        for (const c of campaigns) {
            byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        }
        return { total: campaigns.length, byStatus };
    },
});

// ─── Create Campaign ─────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        strategyId: v.optional(v.id("marketingStrategies")),
        projectId: v.optional(v.id("projects")),
        name: v.string(),
        description: v.optional(v.string()),
        schedule: v.optional(v.string()),
        scheduleDays: v.optional(v.array(v.string())),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        sourceFeatureId: v.optional(v.id("features")),
        sourceIdeaId: v.optional(v.id("ideas")),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("campaigns", {
            orgId: args.orgId,
            strategyId: args.strategyId as any,
            projectId: args.projectId,
            name: args.name,
            description: args.description || "",
            schedule: args.schedule || "one-time",
            scheduleDays: args.scheduleDays,
            startDate: args.startDate,
            endDate: args.endDate,
            status: "draft",
            sourceFeatureId: args.sourceFeatureId,
            sourceIdeaId: args.sourceIdeaId,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Create from Strategy ────────────────────────────────────────────────

export const createFromStrategy = mutation({
    args: {
        orgId: v.id("organizations"),
        strategyId: v.id("marketingStrategies"),
        projectId: v.optional(v.id("projects")),
        name: v.string(),
        description: v.optional(v.string()),
        schedule: v.optional(v.string()),
        scheduleDays: v.optional(v.array(v.string())),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        sourceFeatureId: v.optional(v.id("features")),
        sourceIdeaId: v.optional(v.id("ideas")),
    },
    handler: async (ctx, args) => {
        const strategy = await ctx.db.get(args.strategyId);
        if (!strategy) throw new Error("Strategy not found");

        const now = Date.now();
        return await ctx.db.insert("campaigns", {
            orgId: args.orgId,
            strategyId: args.strategyId,
            projectId: args.projectId,
            name: args.name || `${strategy.name} Campaign`,
            description: args.description || strategy.description || "",
            schedule: args.schedule || "one-time",
            scheduleDays: args.scheduleDays,
            startDate: args.startDate,
            endDate: args.endDate,
            status: "draft",
            sourceFeatureId: args.sourceFeatureId,
            sourceIdeaId: args.sourceIdeaId,
            tags: strategy.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Campaign ─────────────────────────────────────────────────────

export const update = mutation({
    args: {
        campaignId: v.id("campaigns"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        schedule: v.optional(v.string()),
        scheduleDays: v.optional(v.array(v.string())),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        status: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { campaignId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(campaignId, clean);
        return campaignId;
    },
});

// ─── Delete Campaign ─────────────────────────────────────────────────────

export const remove = mutation({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.campaignId);
    },
});

// ─── Generate Tasks from Campaign ────────────────────────────────────────

interface Tactic {
    id: string;
    platform: string;
    contentType: string;
    tone: string;
    description: string;
    example: string;
    frequency: string;
}

export const generateTasks = mutation({
    args: {
        campaignId: v.id("campaigns"),
        orgId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) throw new Error("Campaign not found");

        if (!campaign.strategyId) throw new Error("Campaign has no linked strategy");

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
                projectPath: campaign.projectId ? "campaign" : "campaign",
                title: `[Campaign] ${tactic.description.slice(0, 80)}`,
                description: `${tactic.description}\n\n**Example:** ${tactic.example}\n\n**Frequency:** ${tactic.frequency}`,
                platform: tactic.platform,
                contentType: tactic.contentType,
                tone: tactic.tone,
                status: "idea",
                priority: "medium",
                aiGenerated: false,
                campaignId: args.campaignId,
                tags: [campaign.name.toLowerCase(), tactic.platform],
                createdAt: now,
                updatedAt: now,
            });
            created.push(taskId);
        }

        return { created: created.length, taskIds: created };
    },
});
