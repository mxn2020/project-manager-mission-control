import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Marketing Plans ────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const plans = await ctx.db
            .query("marketingPlans")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return plans.map((p) => ({
            ...p,
            goals: safeParseJson(p.goals, []),
        }));
    },
});

export const get = query({
    args: { planId: v.id("marketingPlans") },
    handler: async (ctx, args) => {
        const p = await ctx.db.get(args.planId);
        if (!p) return null;
        return { ...p, goals: safeParseJson(p.goals, []) };
    },
});

// ─── Create Marketing Plan ───────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        title: v.string(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        budget: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        goals: v.optional(v.array(v.any())),
        linkedProjects: v.optional(v.array(v.string())),
        channels: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("marketingPlans", {
            orgId: args.orgId,
            title: args.title,
            description: args.description || "",
            category: args.category || "custom",
            budget: args.budget,
            startDate: args.startDate,
            endDate: args.endDate,
            goals: JSON.stringify(args.goals || []),
            linkedProjects: args.linkedProjects || [],
            channels: args.channels || [],
            status: "draft",
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Marketing Plan ───────────────────────────────────────────────

export const update = mutation({
    args: {
        planId: v.id("marketingPlans"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        budget: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        goals: v.optional(v.array(v.any())),
        linkedProjects: v.optional(v.array(v.string())),
        channels: v.optional(v.array(v.string())),
        status: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { planId, goals, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        if (goals !== undefined) clean.goals = JSON.stringify(goals);
        await ctx.db.patch(planId, clean);
        return planId;
    },
});

// ─── Delete Marketing Plan ───────────────────────────────────────────────

export const remove = mutation({
    args: { planId: v.id("marketingPlans") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.planId);
    },
});

// ─── Goal Operations ─────────────────────────────────────────────────────

export const addGoal = mutation({
    args: {
        planId: v.id("marketingPlans"),
        goalTitle: v.string(),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) throw new Error("Plan not found");
        const goals = safeParseJson(plan.goals, []) as GoalObj[];
        goals.push({
            id: `goal_${Date.now()}`,
            title: args.goalTitle,
            done: false,
        });
        await ctx.db.patch(args.planId, {
            goals: JSON.stringify(goals),
            updatedAt: Date.now(),
        });
        return goals;
    },
});

export const toggleGoal = mutation({
    args: {
        planId: v.id("marketingPlans"),
        goalId: v.string(),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) throw new Error("Plan not found");
        const goals = (safeParseJson(plan.goals, []) as GoalObj[]).map((g) =>
            g.id === args.goalId ? { ...g, done: !g.done } : g
        );
        await ctx.db.patch(args.planId, {
            goals: JSON.stringify(goals),
            updatedAt: Date.now(),
        });
        return goals;
    },
});

export const removeGoal = mutation({
    args: {
        planId: v.id("marketingPlans"),
        goalId: v.string(),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) throw new Error("Plan not found");
        const goals = (safeParseJson(plan.goals, []) as GoalObj[]).filter(
            (g) => g.id !== args.goalId
        );
        await ctx.db.patch(args.planId, {
            goals: JSON.stringify(goals),
            updatedAt: Date.now(),
        });
        return goals;
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────

interface GoalObj {
    id: string;
    title: string;
    done: boolean;
}

function safeParseJson<T>(val: string | undefined | null, fallback: T): T {
    if (!val) return fallback;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}
