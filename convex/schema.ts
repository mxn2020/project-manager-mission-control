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

    // ─── AI Providers & Models ───────────────────────────────────────────
    aiProviders: defineTable({
        name: v.string(),
        slug: v.string(),
        baseUrl: v.string(),
        apiKeyEnvVar: v.string(),
        isEnabled: v.boolean(),
        createdAt: v.number(),
    }).index("by_slug", ["slug"]),

    aiModels: defineTable({
        providerId: v.id("aiProviders"),
        modelId: v.string(),
        displayName: v.string(),
        maxTokens: v.number(),
        contextWindow: v.number(),
        costPerMillionInput: v.number(),
        costPerMillionOutput: v.number(),
        costPerMillionThinking: v.optional(v.number()),
        isEnabled: v.boolean(),
        isDefault: v.boolean(),
        createdAt: v.number(),
    }).index("by_provider", ["providerId"]),

    // ─── AI Logs ─────────────────────────────────────────────────────────
    aiLogs: defineTable({
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
        createdAt: v.number(),
    })
        .index("by_user", ["userId"])
        .index("by_session", ["sessionId"])
        .index("by_created", ["createdAt"]),

    // ─── AI Settings (per-user) ──────────────────────────────────────────
    aiSettings: defineTable({
        userId: v.id("users"),
        defaultModelId: v.optional(v.id("aiModels")),
        temperature: v.number(),
        maxResponseTokens: v.number(),
        historyLength: v.number(),
        toolsEnabled: v.boolean(),
        enabledTools: v.optional(v.array(v.string())),
        systemPromptOverride: v.optional(v.string()),
        updatedAt: v.number(),
    }).index("by_user", ["userId"]),

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
        toolCalls: v.optional(v.string()),
        tokenCount: v.optional(v.number()),
        createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    // ─── Tasks ───────────────────────────────────────────────────────────
    tasks: defineTable({
        projectPath: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        taskType: v.string(),
        status: v.string(),
        priority: v.string(),
        effort: v.optional(v.string()),
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
        relationType: v.string(),
        createdAt: v.number(),
    }).index("by_source", ["sourceTaskId"]),

    // ─── Content Planner ─────────────────────────────────────────────────
    contentPlans: defineTable({
        projectPath: v.string(),
        releaseTag: v.string(),
        releaseTitle: v.optional(v.string()),
        releaseNotes: v.optional(v.string()),
        releaseDate: v.optional(v.number()),
        status: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_project", ["projectPath"])
        .index("by_status", ["status"]),

    contentItems: defineTable({
        planId: v.id("contentPlans"),
        platform: v.string(),
        content: v.string(),
        status: v.string(),
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
