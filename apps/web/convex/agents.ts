import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Agent Runs (Background Multi-Step Workflows) ────────────────────────

export const listRuns = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let runs;
        if (args.status) {
            runs = await ctx.db
                .query("agentRuns")
                .withIndex("by_status", (idx) => idx.eq("status", args.status!))
                .collect();
            runs = runs.filter((r) => r.orgId === args.orgId);
        } else {
            runs = await ctx.db
                .query("agentRuns")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
        }
        return runs.sort((a, b) => b.startedAt - a.startedAt);
    },
});

export const getRun = query({
    args: { runId: v.id("agentRuns") },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run) return null;
        return {
            ...run,
            steps: safeParseJson(run.steps, []),
        };
    },
});

// ─── Start Agent Run ─────────────────────────────────────────────────────

export const startRun = mutation({
    args: {
        orgId: v.id("organizations"),
        userId: v.id("users"),
        chatbotConfigId: v.id("chatbotConfigs"),
        sessionId: v.optional(v.id("chatSessions")),
        goal: v.string(),
    },
    handler: async (ctx, args) => {
        const runId = await ctx.db.insert("agentRuns", {
            orgId: args.orgId,
            userId: args.userId,
            chatbotConfigId: args.chatbotConfigId,
            sessionId: args.sessionId,
            goal: args.goal,
            status: "pending",
            steps: "[]",
            currentStep: 0,
            startedAt: Date.now(),
        });

        // Schedule the first step
        await ctx.scheduler.runAfter(0, internal.agents.executeStepInternal, {
            runId,
        });

        return runId;
    },
});

// ─── Cancel Agent Run ────────────────────────────────────────────────────

export const cancelRun = mutation({
    args: { runId: v.id("agentRuns") },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run) throw new Error("Run not found");
        if (run.status === "completed" || run.status === "failed") {
            throw new Error("Cannot cancel a completed or failed run");
        }
        await ctx.db.patch(args.runId, {
            status: "cancelled",
            completedAt: Date.now(),
        });
    },
});

// ─── Internal: Execute a single agent step ───────────────────────────────

export const executeStepInternal = internalMutation({
    args: { runId: v.id("agentRuns") },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run || run.status === "cancelled" || run.status === "failed") return;

        // Update status to running
        if (run.status === "pending") {
            await ctx.db.patch(args.runId, { status: "running" });
        }

        const steps = safeParseJson(run.steps, []) as StepLog[];
        const currentStep = run.currentStep;

        // Add step log
        steps.push({
            index: currentStep,
            status: "running",
            startedAt: Date.now(),
            action: `Step ${currentStep + 1}: Processing goal...`,
        });
        await ctx.db.patch(args.runId, {
            steps: JSON.stringify(steps),
            currentStep: currentStep,
        });

        // NOTE: The actual LLM call and tool execution happens in the aiChat action.
        // This is a placeholder that will be connected to the aiChat action.
        // For now, mark as completed after the first step.
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].completedAt = Date.now();
        steps[steps.length - 1].result = "Agent step execution placeholder — connect to aiChat action";

        await ctx.db.patch(args.runId, {
            steps: JSON.stringify(steps),
            currentStep: currentStep + 1,
            status: "completed",
            completedAt: Date.now(),
            result: "Agent run completed (placeholder — full LLM integration pending)",
        });
    },
});

// ─── Internal Query: Get run for action ──────────────────────────────────

export const getRunInternal = internalQuery({
    args: { runId: v.id("agentRuns") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.runId);
    },
});

export const updateRunInternal = internalMutation({
    args: {
        runId: v.id("agentRuns"),
        status: v.optional(v.string()),
        steps: v.optional(v.string()),
        currentStep: v.optional(v.number()),
        result: v.optional(v.string()),
        error: v.optional(v.string()),
        completedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { runId, ...updates } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(runId, clean);
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────

interface StepLog {
    index: number;
    status: string;
    startedAt: number;
    completedAt?: number;
    action: string;
    result?: string;
    error?: string;
}

function safeParseJson<T>(val: string | undefined | null, fallback: T): T {
    if (!val) return fallback;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}
