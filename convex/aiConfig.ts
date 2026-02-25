import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Providers ───────────────────────────────────────────────────────────────

export const listProviders = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("aiProviders").collect();
    },
});

export const upsertProvider = mutation({
    args: {
        id: v.optional(v.id("aiProviders")),
        name: v.string(),
        slug: v.string(),
        baseUrl: v.string(),
        apiKeyEnvVar: v.string(),
        isEnabled: v.boolean(),
    },
    handler: async (ctx, args) => {
        if (args.id) {
            const { id, ...fields } = args;
            await ctx.db.patch(id, fields);
            return id;
        }
        return await ctx.db.insert("aiProviders", {
            name: args.name,
            slug: args.slug,
            baseUrl: args.baseUrl,
            apiKeyEnvVar: args.apiKeyEnvVar,
            isEnabled: args.isEnabled,
            createdAt: Date.now(),
        });
    },
});

export const toggleProvider = mutation({
    args: { id: v.id("aiProviders"), isEnabled: v.boolean() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isEnabled: args.isEnabled });
    },
});

export const deleteProvider = mutation({
    args: { id: v.id("aiProviders") },
    handler: async (ctx, args) => {
        // Also delete associated models
        const models = await ctx.db
            .query("aiModels")
            .withIndex("by_provider", (q) => q.eq("providerId", args.id))
            .collect();
        for (const m of models) await ctx.db.delete(m._id);
        await ctx.db.delete(args.id);
    },
});

// ─── Models ──────────────────────────────────────────────────────────────────

export const listModels = query({
    args: {},
    handler: async (ctx) => {
        const models = await ctx.db.query("aiModels").collect();
        const providers = await ctx.db.query("aiProviders").collect();
        const providerMap = Object.fromEntries(providers.map((p) => [p._id, p]));
        return models.map((m) => ({
            ...m,
            provider: providerMap[m.providerId] || null,
        }));
    },
});

export const listModelsByProvider = query({
    args: { providerId: v.id("aiProviders") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("aiModels")
            .withIndex("by_provider", (q) => q.eq("providerId", args.providerId))
            .collect();
    },
});

export const upsertModel = mutation({
    args: {
        id: v.optional(v.id("aiModels")),
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
    },
    handler: async (ctx, args) => {
        // If setting as default, unset other defaults
        if (args.isDefault) {
            const allModels = await ctx.db.query("aiModels").collect();
            for (const m of allModels) {
                if (m.isDefault && m._id !== args.id) {
                    await ctx.db.patch(m._id, { isDefault: false });
                }
            }
        }

        if (args.id) {
            const { id, ...fields } = args;
            await ctx.db.patch(id, fields);
            return id;
        }
        return await ctx.db.insert("aiModels", {
            ...args,
            id: undefined,
            createdAt: Date.now(),
        } as any);
    },
});

export const toggleModel = mutation({
    args: { id: v.id("aiModels"), isEnabled: v.boolean() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isEnabled: args.isEnabled });
    },
});

export const setDefaultModel = mutation({
    args: { id: v.id("aiModels") },
    handler: async (ctx, args) => {
        const allModels = await ctx.db.query("aiModels").collect();
        for (const m of allModels) {
            await ctx.db.patch(m._id, { isDefault: m._id === args.id });
        }
    },
});

export const deleteModel = mutation({
    args: { id: v.id("aiModels") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const settings = await ctx.db
            .query("aiSettings")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (!settings) {
            // Return defaults
            return {
                temperature: 0.7,
                maxResponseTokens: 2048,
                historyLength: 10,
                toolsEnabled: true,
                enabledTools: null,
                systemPromptOverride: null,
                defaultModelId: null,
            };
        }
        return settings;
    },
});

export const updateSettings = mutation({
    args: {
        userId: v.id("users"),
        temperature: v.optional(v.number()),
        maxResponseTokens: v.optional(v.number()),
        historyLength: v.optional(v.number()),
        toolsEnabled: v.optional(v.boolean()),
        enabledTools: v.optional(v.array(v.string())),
        systemPromptOverride: v.optional(v.string()),
        defaultModelId: v.optional(v.id("aiModels")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("aiSettings")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        const { userId, ...updates } = args;
        // Filter out undefined values
        const cleanUpdates: Record<string, any> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) cleanUpdates[k] = val;
        }
        cleanUpdates.updatedAt = Date.now();

        if (existing) {
            await ctx.db.patch(existing._id, cleanUpdates);
            return existing._id;
        }

        return await ctx.db.insert("aiSettings", {
            userId,
            temperature: cleanUpdates.temperature ?? 0.7,
            maxResponseTokens: cleanUpdates.maxResponseTokens ?? 2048,
            historyLength: cleanUpdates.historyLength ?? 10,
            toolsEnabled: cleanUpdates.toolsEnabled ?? true,
            enabledTools: cleanUpdates.enabledTools,
            systemPromptOverride: cleanUpdates.systemPromptOverride,
            defaultModelId: cleanUpdates.defaultModelId,
            updatedAt: Date.now(),
        });
    },
});

// ─── Active Model Config (for Express) ───────────────────────────────────────

export const getActiveConfig = query({
    args: { userId: v.optional(v.id("users")) },
    handler: async (ctx, args) => {
        let modelDoc = null;

        // Try user's preferred model first
        if (args.userId) {
            const settings = await ctx.db
                .query("aiSettings")
                .withIndex("by_user", (q) => q.eq("userId", args.userId))
                .first();
            if (settings?.defaultModelId) {
                modelDoc = await ctx.db.get(settings.defaultModelId);
            }
        }

        // Fall back to system default
        if (!modelDoc) {
            const allModels = await ctx.db.query("aiModels").collect();
            modelDoc = allModels.find((m) => m.isDefault && m.isEnabled) || allModels.find((m) => m.isEnabled);
        }

        if (!modelDoc) return null;

        const provider = await ctx.db.get(modelDoc.providerId);
        if (!provider) return null;

        // Get user settings
        let settings = null;
        if (args.userId) {
            settings = await ctx.db
                .query("aiSettings")
                .withIndex("by_user", (q) => q.eq("userId", args.userId!))
                .first();
        }

        return {
            model: modelDoc.modelId,
            displayName: modelDoc.displayName,
            maxTokens: settings?.maxResponseTokens ?? modelDoc.maxTokens,
            contextWindow: modelDoc.contextWindow,
            temperature: settings?.temperature ?? 0.7,
            historyLength: settings?.historyLength ?? 10,
            toolsEnabled: settings?.toolsEnabled ?? true,
            enabledTools: settings?.enabledTools ?? null,
            systemPromptOverride: settings?.systemPromptOverride ?? null,
            provider: {
                name: provider.name,
                slug: provider.slug,
                baseUrl: provider.baseUrl,
                apiKeyEnvVar: provider.apiKeyEnvVar,
            },
            costs: {
                input: modelDoc.costPerMillionInput,
                output: modelDoc.costPerMillionOutput,
                thinking: modelDoc.costPerMillionThinking ?? 0,
            },
        };
    },
});
