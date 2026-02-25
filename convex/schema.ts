import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // ─── User & Auth ─────────────────────────────────────────────────────
    users: defineTable({
        email: v.string(),
        name: v.optional(v.string()),
        passwordHash: v.string(),
        role: v.optional(v.string()), // admin | viewer
        createdAt: v.number(),
    }).index("by_email", ["email"]),

    userSessions: defineTable({
        userId: v.id("users"),
        token: v.string(),
        expiresAt: v.number(),
        createdAt: v.number(),
    })
        .index("by_token", ["token"])
        .index("by_user", ["userId"]),

    // ─── Chat / AI Workspace ─────────────────────────────────────────────
    chatSessions: defineTable({
        userId: v.id("users"),
        title: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    chatMessages: defineTable({
        sessionId: v.id("chatSessions"),
        role: v.string(), // user | assistant | system
        content: v.string(),
        createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    // ─── Tasks ───────────────────────────────────────────────────────────
    tasks: defineTable({
        projectPath: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        taskType: v.string(), // feature | bug | chore | spike
        status: v.string(), // todo | in_progress | review | done
        priority: v.string(), // high | medium | low
        effort: v.optional(v.string()), // xs | s | m | l | xl
        dueDate: v.optional(v.number()),
        githubIssueUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_project", ["projectPath"])
        .index("by_status", ["status"])
        .index("by_priority", ["priority"]),

    taskRelations: defineTable({
        sourceTaskId: v.id("tasks"),
        targetTaskId: v.id("tasks"),
        relationType: v.string(), // blocks | depends_on | relates_to
        createdAt: v.number(),
    }).index("by_source", ["sourceTaskId"]),

    // ─── Content Planner ─────────────────────────────────────────────────
    contentPlans: defineTable({
        projectPath: v.string(),
        releaseTag: v.string(),
        releaseTitle: v.optional(v.string()),
        releaseNotes: v.optional(v.string()),
        releaseDate: v.optional(v.number()),
        status: v.string(), // unprocessed | planned | published | skipped
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_project", ["projectPath"])
        .index("by_status", ["status"]),

    contentItems: defineTable({
        planId: v.id("contentPlans"),
        platform: v.string(),
        content: v.string(),
        status: v.string(), // draft | scheduled | posted | skipped
        scheduledAt: v.optional(v.number()),
        postedAt: v.optional(v.number()),
        metrics: v.optional(v.object({
            impressions: v.optional(v.number()),
            clicks: v.optional(v.number()),
            engagement: v.optional(v.number()),
            stars_delta: v.optional(v.number()),
        })),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_plan", ["planId"])
        .index("by_platform", ["platform"])
        .index("by_status", ["status"]),

    // ─── Sync Logs ───────────────────────────────────────────────────────
    syncLogs: defineTable({
        runType: v.string(),
        startedAt: v.number(),
        completedAt: v.optional(v.number()),
        status: v.string(),
        projectsScanned: v.optional(v.number()),
        projectsUpdated: v.optional(v.number()),
        newReleases: v.optional(v.number()),
        errors: v.optional(v.array(v.string())),
    }).index("by_status", ["status"]),

    // ─── Cost Tracking ───────────────────────────────────────────────────
    costEntries: defineTable({
        projectPath: v.string(),
        category: v.string(),
        name: v.string(),
        monthlyCost: v.number(),
        currency: v.string(),
        notes: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_project", ["projectPath"]),
});
