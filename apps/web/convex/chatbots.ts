import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Chatbot Configurations ──────────────────────────────────────────────

export const listConfigs = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chatbotConfigs")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
    },
});

export const getConfig = query({
    args: { configId: v.id("chatbotConfigs") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.configId);
    },
});

export const getDefaultConfig = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const configs = await ctx.db
            .query("chatbotConfigs")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return configs.find((c) => c.isDefault) || configs[0] || null;
    },
});

export const createConfig = mutation({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        systemPromptId: v.optional(v.id("systemPrompts")),
        modelId: v.optional(v.id("aiModels")),
        toolSetIds: v.optional(v.array(v.id("toolDefinitions"))),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        isDefault: v.optional(v.boolean()),
        isAgentic: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // If setting as default, unset others
        if (args.isDefault) {
            const existing = await ctx.db
                .query("chatbotConfigs")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();
            for (const c of existing) {
                if (c.isDefault) await ctx.db.patch(c._id, { isDefault: false });
            }
        }

        return await ctx.db.insert("chatbotConfigs", {
            orgId: args.orgId,
            name: args.name,
            description: args.description,
            systemPromptId: args.systemPromptId,
            modelId: args.modelId,
            toolSetIds: args.toolSetIds || [],
            temperature: args.temperature,
            maxTokens: args.maxTokens,
            isDefault: args.isDefault || false,
            isAgentic: args.isAgentic || false,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateConfig = mutation({
    args: {
        configId: v.id("chatbotConfigs"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        systemPromptId: v.optional(v.id("systemPrompts")),
        modelId: v.optional(v.id("aiModels")),
        toolSetIds: v.optional(v.array(v.id("toolDefinitions"))),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        isDefault: v.optional(v.boolean()),
        isAgentic: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { configId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }

        // If setting as default, unset others
        if (args.isDefault) {
            const config = await ctx.db.get(configId);
            if (config) {
                const others = await ctx.db
                    .query("chatbotConfigs")
                    .withIndex("by_org", (idx) => idx.eq("orgId", config.orgId))
                    .collect();
                for (const c of others) {
                    if (c._id !== configId && c.isDefault) {
                        await ctx.db.patch(c._id, { isDefault: false });
                    }
                }
            }
        }

        await ctx.db.patch(configId, clean);
        return configId;
    },
});

export const deleteConfig = mutation({
    args: { configId: v.id("chatbotConfigs") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.configId);
    },
});

// ─── System Prompts ──────────────────────────────────────────────────────

export const listPrompts = query({
    args: { orgId: v.optional(v.id("organizations")) },
    handler: async (ctx, args) => {
        // Get org-specific prompts
        const prompts = [];
        if (args.orgId) {
            const orgPrompts = await ctx.db
                .query("systemPrompts")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId!))
                .collect();
            prompts.push(...orgPrompts);
        }
        // Also get global (orgId = null) prompts
        const globalPrompts = await ctx.db
            .query("systemPrompts")
            .withIndex("by_org", (idx) => idx.eq("orgId", undefined!))
            .collect();
        prompts.push(...globalPrompts);
        return prompts;
    },
});

export const createPrompt = mutation({
    args: {
        orgId: v.optional(v.id("organizations")),
        name: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        // Determine version (auto-increment)
        const existing = await ctx.db.query("systemPrompts").collect();
        const sameName = existing.filter((p) => p.name === args.name);
        const version = sameName.length > 0 ? Math.max(...sameName.map((p) => p.version)) + 1 : 1;

        // Deactivate previous versions
        for (const p of sameName) {
            if (p.isActive) await ctx.db.patch(p._id, { isActive: false });
        }

        return await ctx.db.insert("systemPrompts", {
            orgId: args.orgId,
            name: args.name,
            content: args.content,
            version,
            isActive: true,
            createdAt: Date.now(),
        });
    },
});

export const updatePrompt = mutation({
    args: {
        promptId: v.id("systemPrompts"),
        content: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { promptId, ...rest } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(promptId, clean);
    },
});

export const deletePrompt = mutation({
    args: { promptId: v.id("systemPrompts") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.promptId);
    },
});

// ─── Tool Definitions ────────────────────────────────────────────────────

export const listTools = query({
    args: { orgId: v.optional(v.id("organizations")) },
    handler: async (ctx, args) => {
        const tools = [];
        if (args.orgId) {
            const orgTools = await ctx.db
                .query("toolDefinitions")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId!))
                .collect();
            tools.push(...orgTools);
        }
        // Also get built-in (global) tools
        const globalTools = await ctx.db
            .query("toolDefinitions")
            .withIndex("by_org", (idx) => idx.eq("orgId", undefined!))
            .collect();
        tools.push(...globalTools);
        return tools;
    },
});

export const createTool = mutation({
    args: {
        orgId: v.optional(v.id("organizations")),
        name: v.string(),
        description: v.string(),
        parameters: v.string(), // JSON schema
        handlerType: v.optional(v.string()),
        isEnabled: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("toolDefinitions", {
            orgId: args.orgId,
            name: args.name,
            description: args.description,
            parameters: args.parameters,
            handlerType: args.handlerType || "built-in",
            isEnabled: args.isEnabled ?? true,
            createdAt: Date.now(),
        });
    },
});

export const updateTool = mutation({
    args: {
        toolId: v.id("toolDefinitions"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        parameters: v.optional(v.string()),
        isEnabled: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { toolId, ...rest } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(toolId, clean);
    },
});

export const deleteTool = mutation({
    args: { toolId: v.id("toolDefinitions") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.toolId);
    },
});
