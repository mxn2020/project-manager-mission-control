import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Sessions ────────────────────────────────────────────────────────────────

export const createSession = mutation({
    args: {
        userId: v.id("users"),
        title: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("chatSessions", {
            userId: args.userId,
            title: args.title ?? "New Chat",
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const listSessions = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("chatSessions")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        // Sort by updatedAt desc
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const deleteSession = mutation({
    args: { id: v.id("chatSessions") },
    handler: async (ctx, args) => {
        // Delete all messages in session
        const messages = await ctx.db
            .query("chatMessages")
            .withIndex("by_session", (q) => q.eq("sessionId", args.id))
            .collect();
        for (const m of messages) await ctx.db.delete(m._id);
        await ctx.db.delete(args.id);
    },
});

export const renameSession = mutation({
    args: { id: v.id("chatSessions"), title: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { title: args.title, updatedAt: Date.now() });
    },
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const addMessage = mutation({
    args: {
        sessionId: v.id("chatSessions"),
        role: v.string(),
        content: v.string(),
        toolCalls: v.optional(v.string()),
        tokenCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Update session's updatedAt
        await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });

        // Auto-title session from first user message
        if (args.role === "user") {
            const session = await ctx.db.get(args.sessionId);
            if (session && session.title === "New Chat") {
                const title = args.content.slice(0, 60) + (args.content.length > 60 ? "..." : "");
                await ctx.db.patch(args.sessionId, { title });
            }
        }

        return await ctx.db.insert("chatMessages", {
            sessionId: args.sessionId,
            role: args.role,
            content: args.content,
            toolCalls: args.toolCalls,
            tokenCount: args.tokenCount,
            createdAt: Date.now(),
        });
    },
});

export const getMessages = query({
    args: { sessionId: v.id("chatSessions") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chatMessages")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();
    },
});
