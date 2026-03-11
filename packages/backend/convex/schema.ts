import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // ─── Organizations (Multi-Tenant) ────────────────────────────────────
    organizations: defineTable({
        name: v.string(),
        slug: v.string(),
        ownerId: v.id("users"),
        planTier: v.string(), // free | pro | team
        settings: v.optional(v.string()), // JSON settings
        githubToken: v.optional(v.string()), // OAuth access token
        githubUsername: v.optional(v.string()), // Connected GitHub username
        vercelToken: v.optional(v.string()), // Vercel API token
        vercelTeamId: v.optional(v.string()), // Vercel team/scope ID
        createdAt: v.number(),
    })
        .index("by_slug", ["slug"])
        .index("by_owner", ["ownerId"]),

    orgMembers: defineTable({
        orgId: v.id("organizations"),
        userId: v.id("users"),
        role: v.string(), // owner | admin | member | viewer
        joinedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_user", ["userId"]),

    // ─── User & Auth ─────────────────────────────────────────────────────
    users: defineTable({
        email: v.string(),
        name: v.optional(v.string()),
        passwordHash: v.string(),
        role: v.optional(v.string()), // admin | viewer (legacy, per-org roles in orgMembers)
        defaultOrgId: v.optional(v.id("organizations")),
        createdAt: v.number(),
    }).index("by_email", ["email"]),

    userSessions: defineTable({
        userId: v.id("users"),
        token: v.string(),
        orgId: v.optional(v.id("organizations")),
        expiresAt: v.number(),
        createdAt: v.number(),
    })
        .index("by_token", ["token"])
        .index("by_user", ["userId"]),

    // ─── Projects ────────────────────────────────────────────────────────
    projects: defineTable({
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        tier: v.string(), // mvp | growth | scale | idea
        lane: v.string(), // category/lane
        priority: v.string(), // high | medium | low
        oss: v.boolean(),
        stack: v.array(v.string()),
        repo: v.optional(v.string()), // GitHub repo URL
        deployUrl: v.optional(v.string()),
        lastActive: v.optional(v.number()),
        tags: v.array(v.string()),
        notes: v.optional(v.string()),
        healthScore: v.optional(v.number()),
        syncStatus: v.string(), // synced | stale | error
        lastSyncedAt: v.optional(v.number()),
        // ── New fields for main/child differentiation ────────────────────
        projectScope: v.optional(v.string()), // "main" | "child"
        projectType: v.optional(v.string()), // "standalone" | "monorepo" | "package" | "library"
        projectCategory: v.optional(v.string()), // "webapp" | "fullstack-app" | "monorepo-app" | "oss-tool" | "ui-package" | "library" | "boilerplate" | "minion-toolbox" | "backend-service" | "client-project"
        childType: v.optional(v.string()),   // "web-app" | "mobile-app" | "docs" | "blog" | "cli" | "sdk" | "package" | "api" | "shared"
        parentProject: v.optional(v.string()), // parent project name (for children)
        vercelProjectId: v.optional(v.string()), // linked Vercel project ID
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_org_lane", ["orgId", "lane"])
        .index("by_org_tier", ["orgId", "tier"])
        .index("by_org_scope", ["orgId", "projectScope"]),

    // ─── GitHub Repo Links ───────────────────────────────────────────────
    githubRepos: defineTable({
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        repoFullName: v.string(), // "owner/repo"
        repoUrl: v.string(),
        defaultBranch: v.string(),
        lastSyncedAt: v.optional(v.number()),
        syncStatus: v.string(), // synced | syncing | error
        yamlContent: v.optional(v.string()), // cached PROJECT.yaml
        accountsContent: v.optional(v.string()), // cached ACCOUNTS.yaml
        lastCommitSha: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_project", ["projectId"])
        .index("by_repo", ["repoFullName"]),

    // ─── Tasks ───────────────────────────────────────────────────────────
    tasks: defineTable({
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        projectPath: v.string(), // legacy compat
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
        .index("by_org", ["orgId"])
        .index("by_org_project", ["orgId", "projectPath"])
        .index("by_org_status", ["orgId", "status"])
        .index("by_org_priority", ["orgId", "priority"]),

    taskRelations: defineTable({
        sourceTaskId: v.id("tasks"),
        targetTaskId: v.id("tasks"),
        relationType: v.string(),
        createdAt: v.number(),
    }).index("by_source", ["sourceTaskId"]),

    // ─── Workflows ───────────────────────────────────────────────────────
    workflows: defineTable({
        orgId: v.id("organizations"),
        title: v.string(),
        description: v.optional(v.string()),
        category: v.string(),
        steps: v.string(), // JSON array
        linkedProjects: v.array(v.string()),
        isTemplate: v.boolean(),
        schedule: v.optional(v.string()),
        lastRunAt: v.optional(v.number()),
        status: v.string(),
        tags: v.array(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Marketing Plans ─────────────────────────────────────────────────
    marketingPlans: defineTable({
        orgId: v.id("organizations"),
        title: v.string(),
        description: v.optional(v.string()),
        category: v.string(),
        budget: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        goals: v.string(), // JSON array
        linkedProjects: v.array(v.string()),
        channels: v.array(v.string()),
        status: v.string(),
        tags: v.array(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Ideas ───────────────────────────────────────────────────────────
    ideas: defineTable({
        orgId: v.id("organizations"),
        title: v.string(),
        body: v.optional(v.string()),
        category: v.string(),
        score: v.number(),
        tags: v.array(v.string()),
        linkedProjects: v.array(v.string()),
        linkedIdeas: v.array(v.string()),
        archived: v.boolean(),
        status: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Wiki Articles ───────────────────────────────────────────────────
    wikiArticles: defineTable({
        orgId: v.id("organizations"),
        title: v.string(),
        body: v.optional(v.string()),
        category: v.string(),
        scope: v.string(),
        tags: v.array(v.string()),
        relatedArticles: v.array(v.string()),
        linkedProjects: v.array(v.string()),
        status: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Content Planner ─────────────────────────────────────────────────
    contentPlans: defineTable({
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        projectPath: v.string(), // legacy compat
        releaseTag: v.string(),
        releaseTitle: v.optional(v.string()),
        releaseNotes: v.optional(v.string()),
        releaseDate: v.optional(v.number()),
        status: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_org_project", ["orgId", "projectPath"])
        .index("by_org_status", ["orgId", "status"]),

    contentItems: defineTable({
        planId: v.id("contentPlans"),
        platform: v.string(),
        content: v.string(),
        status: v.string(),
        scheduledAt: v.optional(v.number()),
        postedAt: v.optional(v.number()),
        metrics: v.optional(
            v.object({
                impressions: v.optional(v.number()),
                clicks: v.optional(v.number()),
                engagement: v.optional(v.number()),
                stars_delta: v.optional(v.number()),
            })
        ),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_plan", ["planId"])
        .index("by_platform", ["platform"])
        .index("by_status", ["status"]),

    // ─── Focus Groups ────────────────────────────────────────────────────
    focusGroups: defineTable({
        orgId: v.id("organizations"),
        projectIds: v.array(v.string()),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Dimensions Config ───────────────────────────────────────────────
    dimensionsConfig: defineTable({
        orgId: v.id("organizations"),
        customDimensions: v.optional(v.string()), // JSON
        sortConfig: v.optional(v.string()), // JSON
        groupConfig: v.optional(v.string()), // JSON
        focusGroup: v.optional(v.array(v.string())), // legacy compat
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Cost Tracking ───────────────────────────────────────────────────
    costEntries: defineTable({
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        projectPath: v.string(), // legacy compat
        category: v.string(),
        name: v.string(),
        monthlyCost: v.number(),
        currency: v.string(),
        notes: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_org_project", ["orgId", "projectPath"]),

    // ─── Sync Logs ───────────────────────────────────────────────────────
    syncLogs: defineTable({
        orgId: v.optional(v.id("organizations")),
        runType: v.string(),
        startedAt: v.number(),
        completedAt: v.optional(v.number()),
        status: v.string(),
        projectsScanned: v.optional(v.number()),
        projectsUpdated: v.optional(v.number()),
        newReleases: v.optional(v.number()),
        errors: v.optional(v.array(v.string())),
    })
        .index("by_status", ["status"])
        .index("by_org", ["orgId"]),

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
        orgId: v.optional(v.id("organizations")),
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
        .index("by_created", ["createdAt"])
        .index("by_org", ["orgId"]),

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
        orgId: v.optional(v.id("organizations")),
        userId: v.id("users"),
        title: v.string(),
        chatbotConfigId: v.optional(v.id("chatbotConfigs")),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_user", ["userId"])
        .index("by_org", ["orgId"]),

    chatMessages: defineTable({
        sessionId: v.id("chatSessions"),
        role: v.string(), // user | assistant | system
        content: v.string(),
        toolCalls: v.optional(v.string()),
        tokenCount: v.optional(v.number()),
        createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    // ─── Chatbot Configurations ──────────────────────────────────────────
    chatbotConfigs: defineTable({
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        systemPromptId: v.optional(v.id("systemPrompts")),
        modelId: v.optional(v.id("aiModels")),
        toolSetIds: v.array(v.id("toolDefinitions")),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        isDefault: v.boolean(),
        isAgentic: v.boolean(), // can run background workflows
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── System Prompts (versioned) ──────────────────────────────────────
    systemPrompts: defineTable({
        orgId: v.optional(v.id("organizations")), // null = global
        name: v.string(),
        content: v.string(),
        version: v.number(),
        isActive: v.boolean(),
        createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Tool Definitions (DB-driven) ────────────────────────────────────
    toolDefinitions: defineTable({
        orgId: v.optional(v.id("organizations")), // null = global/built-in
        name: v.string(),
        description: v.string(),
        parameters: v.string(), // JSON schema
        handlerType: v.string(), // built-in | custom
        isEnabled: v.boolean(),
        createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    // ─── Agent Runs (agentic background workflows) ───────────────────────
    agentRuns: defineTable({
        orgId: v.id("organizations"),
        userId: v.id("users"),
        chatbotConfigId: v.id("chatbotConfigs"),
        sessionId: v.optional(v.id("chatSessions")),
        goal: v.string(),
        status: v.string(), // pending | running | completed | failed | cancelled
        steps: v.string(), // JSON array of step objects
        currentStep: v.number(),
        totalSteps: v.optional(v.number()),
        result: v.optional(v.string()),
        error: v.optional(v.string()),
        startedAt: v.number(),
        completedAt: v.optional(v.number()),
    })
        .index("by_org", ["orgId"])
        .index("by_user", ["userId"])
        .index("by_status", ["status"]),

    // ─── Minions SDK Objects ─────────────────────────────────────────────
    minions: defineTable({
        id: v.string(),                              // Minion UUID (SDK-generated)
        data: v.string(),                            // JSON-serialised Minion object
        orgId: v.optional(v.id("organizations")),    // tenant scope
    })
        .index("by_minion_id", ["id"])
        .index("by_org", ["orgId"]),

    // ─── Voice Models (STT/TTS) ──────────────────────────────────────────
    voiceModels: defineTable({
        orgId: v.optional(v.id("organizations")),   // null = global/built-in
        name: v.string(),                           // e.g. "whisper-large-v3"
        displayName: v.string(),                    // e.g. "Whisper Large v3"
        provider: v.string(),                       // nvidia | openai | chatterbox
        type: v.string(),                           // stt | tts
        apiFormat: v.string(),                      // openai | riva-grpc | chatterbox-local
        baseUrl: v.string(),                        // API endpoint URL
        apiKeyEnvVar: v.optional(v.string()),       // env var name for API key
        languages: v.array(v.string()),             // supported language codes
        isEnabled: v.boolean(),
        isDefault: v.boolean(),
        config: v.optional(v.string()),             // JSON: voices, sample rates, etc.
        createdAt: v.number(),
    })
        .index("by_type", ["type"])
        .index("by_provider", ["provider"])
        .index("by_org", ["orgId"]),

    // ─── Webhook Logs ────────────────────────────────────────────────────
    webhookLogs: defineTable({
        orgId: v.id("organizations"),
        type: v.string(),                       // "voice" | "text"
        source: v.optional(v.string()),         // caller label, e.g. "ios-shortcut"
        status: v.string(),                     // "received" | "processing" | "completed" | "failed"
        inputSummary: v.string(),               // truncated preview of input
        transcription: v.optional(v.string()),  // STT result (voice only)
        result: v.optional(v.string()),         // JSON: tasks/ideas created
        error: v.optional(v.string()),
        durationMs: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_status", ["status"]),

    // ─── Compliance Scans ─────────────────────────────────────────────────
    complianceScans: defineTable({
        orgId: v.id("organizations"),
        projectId: v.id("projects"),
        repoFullName: v.optional(v.string()),
        results: v.string(), // JSON: Record<metricId, { pass: boolean; detail: string }>
        passCount: v.number(),
        totalCount: v.number(),
        score: v.number(), // 0-100
        scannedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_project", ["projectId"])
        .index("by_org_scanned", ["orgId", "scannedAt"]),
});
