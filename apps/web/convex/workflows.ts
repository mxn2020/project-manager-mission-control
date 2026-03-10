import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Workflows ──────────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const workflows = await ctx.db
            .query("workflows")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return workflows.map((w) => ({
            ...w,
            steps: safeParseJson(w.steps, []),
        }));
    },
});

export const get = query({
    args: { workflowId: v.id("workflows") },
    handler: async (ctx, args) => {
        const w = await ctx.db.get(args.workflowId);
        if (!w) return null;
        return { ...w, steps: safeParseJson(w.steps, []) };
    },
});

// ─── Create Workflow ─────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        title: v.string(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        steps: v.optional(v.array(v.any())),
        linkedProjects: v.optional(v.array(v.string())),
        isTemplate: v.optional(v.boolean()),
        schedule: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("workflows", {
            orgId: args.orgId,
            title: args.title,
            description: args.description || "",
            category: args.category || "custom",
            steps: JSON.stringify(args.steps || []),
            linkedProjects: args.linkedProjects || [],
            isTemplate: args.isTemplate || false,
            schedule: args.schedule,
            status: "active",
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Workflow ─────────────────────────────────────────────────────

export const update = mutation({
    args: {
        workflowId: v.id("workflows"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        steps: v.optional(v.array(v.any())),
        linkedProjects: v.optional(v.array(v.string())),
        isTemplate: v.optional(v.boolean()),
        schedule: v.optional(v.string()),
        status: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { workflowId, steps, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        if (steps !== undefined) clean.steps = JSON.stringify(steps);
        await ctx.db.patch(workflowId, clean);
        return workflowId;
    },
});

// ─── Delete Workflow ─────────────────────────────────────────────────────

export const remove = mutation({
    args: { workflowId: v.id("workflows") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.workflowId);
    },
});

// ─── Step Operations ─────────────────────────────────────────────────────

export const addStep = mutation({
    args: {
        workflowId: v.id("workflows"),
        stepTitle: v.string(),
        stepDescription: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const wf = await ctx.db.get(args.workflowId);
        if (!wf) throw new Error("Workflow not found");
        const steps = safeParseJson(wf.steps, []) as StepObj[];
        steps.push({
            id: `step_${Date.now()}`,
            title: args.stepTitle,
            description: args.stepDescription || "",
            order: steps.length,
            done: false,
        });
        await ctx.db.patch(args.workflowId, {
            steps: JSON.stringify(steps),
            updatedAt: Date.now(),
        });
        return steps;
    },
});

export const toggleStep = mutation({
    args: {
        workflowId: v.id("workflows"),
        stepId: v.string(),
    },
    handler: async (ctx, args) => {
        const wf = await ctx.db.get(args.workflowId);
        if (!wf) throw new Error("Workflow not found");
        const steps = (safeParseJson(wf.steps, []) as StepObj[]).map((s) =>
            s.id === args.stepId ? { ...s, done: !s.done } : s
        );
        await ctx.db.patch(args.workflowId, {
            steps: JSON.stringify(steps),
            updatedAt: Date.now(),
        });
        return steps;
    },
});

export const removeStep = mutation({
    args: {
        workflowId: v.id("workflows"),
        stepId: v.string(),
    },
    handler: async (ctx, args) => {
        const wf = await ctx.db.get(args.workflowId);
        if (!wf) throw new Error("Workflow not found");
        const steps = (safeParseJson(wf.steps, []) as StepObj[]).filter(
            (s) => s.id !== args.stepId
        );
        await ctx.db.patch(args.workflowId, {
            steps: JSON.stringify(steps),
            updatedAt: Date.now(),
        });
        return steps;
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────

interface StepObj {
    id: string;
    title: string;
    description: string;
    order: number;
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
