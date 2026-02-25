import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Save Log ────────────────────────────────────────────────────────────────

export const saveLog = mutation({
    args: {
        userId: v.optional(v.id("users")),
        sessionId: v.optional(v.id("chatSessions")),
        model: v.string(),
        provider: v.string(),
        caller: v.string(),
        promptMessages: v.string(),
        responseContent: v.string(),
        toolCalls: v.optional(v.string()),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        costCents: v.optional(v.number()),
        durationMs: v.number(),
        status: v.string(),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("aiLogs", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

// ─── List Logs ───────────────────────────────────────────────────────────────

export const listLogs = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        const logs = await ctx.db
            .query("aiLogs")
            .withIndex("by_created")
            .order("desc")
            .take(limit);
        return logs;
    },
});

export const listLogsBySession = query({
    args: { sessionId: v.id("chatSessions") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("aiLogs")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();
    },
});

// ─── Log Stats ───────────────────────────────────────────────────────────────

export const getStats = query({
    args: {},
    handler: async (ctx) => {
        const allLogs = await ctx.db.query("aiLogs").collect();

        let totalCalls = 0;
        let totalTokens = 0;
        let totalCostCents = 0;
        let errorCount = 0;
        let totalDurationMs = 0;
        const byModel: Record<string, number> = {};
        const byDay: Record<string, number> = {};

        for (const log of allLogs) {
            totalCalls++;
            totalTokens += log.totalTokens ?? 0;
            totalCostCents += log.costCents ?? 0;
            totalDurationMs += log.durationMs ?? 0;
            if (log.status === "error") errorCount++;
            byModel[log.model] = (byModel[log.model] || 0) + 1;

            const day = new Date(log.createdAt).toISOString().split("T")[0];
            byDay[day] = (byDay[day] || 0) + 1;
        }

        return {
            totalCalls,
            totalTokens,
            totalCostCents,
            errorCount,
            avgDurationMs: totalCalls > 0 ? Math.round(totalDurationMs / totalCalls) : 0,
            byModel,
            byDay,
        };
    },
});
