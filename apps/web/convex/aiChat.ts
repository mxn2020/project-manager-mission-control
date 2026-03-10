import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * AI Chat — Convex action that replaces the Express ai-chat.mjs.
 *
 * Reads model/provider/settings from Convex, calls the configured LLM,
 * executes tool calls against Convex internal functions, and logs everything.
 */

// ─── Fallback Config ─────────────────────────────────────────────────────

const FALLBACK_CONFIG = {
    model: "meta/llama-3.3-70b-instruct",
    provider: {
        name: "NVIDIA",
        slug: "nvidia",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        apiKeyEnvVar: "NVIDIA_API_KEY",
    },
    temperature: 0.7,
    maxTokens: 2048,
    historyLength: 10,
    toolsEnabled: true,
    costs: { input: 0, output: 0, thinking: 0 },
};

// ─── Main Chat Action ────────────────────────────────────────────────────

export const chat = action({
    args: {
        messages: v.array(
            v.object({
                role: v.string(),
                content: v.string(),
            })
        ),
        userId: v.optional(v.id("users")),
        sessionId: v.optional(v.id("chatSessions")),
        orgId: v.optional(v.id("organizations")),
        chatbotConfigId: v.optional(v.id("chatbotConfigs")),
        personaId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const startTime = Date.now();

        // 1. Fetch config from Convex
        const config = await ctx.runQuery(internal.aiChat.getActiveChatConfig, {
            userId: args.userId,
            orgId: args.orgId,
            chatbotConfigId: args.chatbotConfigId,
            personaId: args.personaId,
        });

        const activeConfig = config || FALLBACK_CONFIG;

        // 2. Resolve API key from environment
        const apiKeyEnvVar = activeConfig.provider?.apiKeyEnvVar || "NVIDIA_API_KEY";
        const apiKey = process.env[apiKeyEnvVar];
        if (!apiKey) {
            throw new Error(`${apiKeyEnvVar} not configured. Set it in Convex environment variables.`);
        }

        const baseUrl = activeConfig.provider?.baseUrl || "https://integrate.api.nvidia.com/v1";
        const model = activeConfig.model || FALLBACK_CONFIG.model;
        const temperature = activeConfig.temperature ?? 0.7;
        const maxTokens = activeConfig.maxTokens ?? 2048;

        // 3. Build messages with system prompt
        const historyLength = activeConfig.historyLength ?? 10;
        const trimmedMessages = args.messages.slice(-historyLength);

        // Get system prompt from DB or use default
        const systemPrompt = activeConfig.systemPrompt || buildDefaultSystemPrompt();

        const fullMessages = [
            { role: "system", content: systemPrompt },
            ...trimmedMessages,
        ];

        const toolCallsLog: ToolCallLog[] = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;

        // 4. First LLM call
        let llmResult = await callLLM(baseUrl, apiKey, model, fullMessages, temperature, maxTokens);
        let response = llmResult.content;
        totalPromptTokens += llmResult.promptTokens || 0;
        totalCompletionTokens += llmResult.completionTokens || 0;

        // 5. Tool-calling loop (up to 5 rounds)
        if (activeConfig.toolsEnabled !== false) {
            for (let round = 0; round < 5; round++) {
                const toolCall = extractToolCall(response);
                if (!toolCall) break;

                // Execute tool against Convex
                const result = await executeToolInConvex(ctx, toolCall.name, toolCall.arguments, args.orgId);
                toolCallsLog.push({ name: toolCall.name, args: toolCall.arguments, result });

                fullMessages.push({ role: "assistant", content: response });
                fullMessages.push({
                    role: "user",
                    content: `Tool "${toolCall.name}" returned:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nPlease summarize this for the user.`,
                });

                llmResult = await callLLM(baseUrl, apiKey, model, fullMessages, temperature, maxTokens);
                response = llmResult.content;
                totalPromptTokens += llmResult.promptTokens || 0;
                totalCompletionTokens += llmResult.completionTokens || 0;
            }
        }

        // 6. Strip remaining tool_call blocks
        response = response.replace(/```tool_call[\s\S]*?```/g, "").trim();

        // 7. Calculate cost
        const totalTokens = totalPromptTokens + totalCompletionTokens;
        const costs = activeConfig.costs || FALLBACK_CONFIG.costs;
        const costCents =
            (totalPromptTokens / 1_000_000) * (costs.input || 0) +
            (totalCompletionTokens / 1_000_000) * (costs.output || 0);

        const durationMs = Date.now() - startTime;

        // 8. Save AI log (fire-and-forget via internal mutation)
        try {
            await ctx.runMutation(internal.aiChat.saveAiLog, {
                orgId: args.orgId,
                userId: args.userId,
                sessionId: args.sessionId,
                model,
                provider: activeConfig.provider?.slug || "nvidia",
                caller: "chat",
                promptMessages: JSON.stringify(trimmedMessages).slice(0, 8000),
                responseContent: response.slice(0, 8000),
                toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog).slice(0, 8000) : undefined,
                promptTokens: totalPromptTokens || undefined,
                completionTokens: totalCompletionTokens || undefined,
                totalTokens: totalTokens || undefined,
                costCents: costCents > 0 ? Math.round(costCents * 100) / 100 : undefined,
                durationMs,
                status: "success",
            });
        } catch { /* best effort */ }

        // 9. Save messages to session
        if (args.sessionId) {
            try {
                const userMsg = args.messages[args.messages.length - 1];
                if (userMsg) {
                    await ctx.runMutation(internal.aiChat.saveChatMessage, {
                        sessionId: args.sessionId,
                        role: "user",
                        content: userMsg.content,
                    });
                }
                await ctx.runMutation(internal.aiChat.saveChatMessage, {
                    sessionId: args.sessionId,
                    role: "assistant",
                    content: response,
                    toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog.map((t) => t.name)) : undefined,
                    tokenCount: totalTokens || undefined,
                });
            } catch { /* best effort */ }
        }

        return {
            response,
            model,
            provider: activeConfig.provider?.slug || "nvidia",
            tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalTokens },
            costCents: Math.round(costCents * 100) / 100,
            durationMs,
            toolCalls: toolCallsLog.map((t) => t.name),
        };
    },
});

// ─── Internal Queries/Mutations ──────────────────────────────────────────

export const getActiveChatConfig = internalQuery({
    args: {
        userId: v.optional(v.id("users")),
        orgId: v.optional(v.id("organizations")),
        chatbotConfigId: v.optional(v.id("chatbotConfigs")),
        personaId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Try chatbot config first
        let chatbotConfig = null;
        if (args.chatbotConfigId) {
            chatbotConfig = await ctx.db.get(args.chatbotConfigId);
        } else if (args.orgId) {
            // Get default config for org
            const configs = await ctx.db
                .query("chatbotConfigs")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId!))
                .collect();
            chatbotConfig = configs.find((c) => c.isDefault) || configs[0];
        }

        // Get system prompt if chatbot config has one
        let systemPrompt: string | null = null;
        if (chatbotConfig?.systemPromptId) {
            const prompt = await ctx.db.get(chatbotConfig.systemPromptId);
            if (prompt) systemPrompt = prompt.content;
        }

        // Get model config
        let modelDoc = null;
        if (chatbotConfig?.modelId) {
            modelDoc = await ctx.db.get(chatbotConfig.modelId);
        }

        // Fall back to user settings → system default
        if (!modelDoc && args.userId) {
            const settings = await ctx.db
                .query("aiSettings")
                .withIndex("by_user", (idx) => idx.eq("userId", args.userId!))
                .first();
            if (settings?.defaultModelId) {
                modelDoc = await ctx.db.get(settings.defaultModelId);
            }
        }
        if (!modelDoc) {
            const allModels = await ctx.db.query("aiModels").collect();
            modelDoc = allModels.find((m) => m.isDefault && m.isEnabled) || allModels.find((m) => m.isEnabled);
        }
        if (!modelDoc) return null;

        const provider = await ctx.db.get(modelDoc.providerId);
        if (!provider) return null;

        // Get user settings
        let userSettings = null;
        if (args.userId) {
            userSettings = await ctx.db
                .query("aiSettings")
                .withIndex("by_user", (idx) => idx.eq("userId", args.userId!))
                .first();
        }

        // Resolve persona tools (built-in defaults or from DB)
        let personaTools: string[] | null = null;
        let personaPrompt: string | null = null;

        if (args.personaId && args.personaId.startsWith("default_")) {
            // Built-in persona — import defaults
            const BUILTIN_PERSONAS = [
                {
                    tools: ["list_projects", "get_project", "update_project", "get_summary", "search_minions", "list_by_type", "create_minion", "manage_task", "manage_idea", "promote_idea", "combine_ideas", "manage_workflow", "manage_marketing", "manage_wiki", "manage_content", "get_focus_group", "update_focus_group", "run_automation"],
                    systemPrompt: "You are Mission Control AI, a comprehensive assistant for managing a software project portfolio. You have full access to all features. Be concise, helpful, and proactive.",
                },
                {
                    tools: ["list_projects", "get_project", "update_project", "get_summary", "manage_task", "search_minions", "get_focus_group", "update_focus_group", "run_automation"],
                    systemPrompt: "You are the Project Manager AI, specialized in project oversight and task management. Be efficient and action-oriented.",
                },
                {
                    tools: ["manage_idea", "promote_idea", "combine_ideas", "search_minions", "list_by_type"],
                    systemPrompt: "You are the Ideas Lab AI, your creative partner for brainstorming and innovation. Be creative and encouraging.",
                },
                {
                    tools: ["manage_marketing", "manage_content", "manage_wiki", "search_minions", "list_by_type", "list_projects"],
                    systemPrompt: "You are the Marketing Strategist AI, focused on marketing plans, content strategy, and knowledge management. Be strategic and data-driven.",
                },
                {
                    tools: ["list_projects", "get_project", "manage_workflow", "run_automation", "search_minions", "list_by_type"],
                    systemPrompt: "You are the DevOps Engineer AI, specialized in workflows, automation, and system health. Be systematic and thorough.",
                },
            ];
            const idx = parseInt(args.personaId.replace("default_", ""));
            const persona = BUILTIN_PERSONAS[idx] || BUILTIN_PERSONAS[0];
            personaTools = persona.tools;
            personaPrompt = persona.systemPrompt;
        } else if (chatbotConfig) {
            // DB persona — resolve tool names from toolSetIds
            const tools: string[] = [];
            for (const toolId of chatbotConfig.toolSetIds || []) {
                const tool = await ctx.db.get(toolId);
                if (tool) tools.push((tool as any).name);
            }
            if (tools.length > 0) personaTools = tools;
        }

        return {
            model: modelDoc.modelId,
            displayName: modelDoc.displayName,
            maxTokens: chatbotConfig?.maxTokens ?? userSettings?.maxResponseTokens ?? modelDoc.maxTokens,
            temperature: chatbotConfig?.temperature ?? userSettings?.temperature ?? 0.7,
            historyLength: userSettings?.historyLength ?? 10,
            toolsEnabled: userSettings?.toolsEnabled ?? true,
            enabledTools: personaTools ?? userSettings?.enabledTools ?? null,
            systemPrompt: personaPrompt ?? systemPrompt ?? userSettings?.systemPromptOverride ?? null,
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

export const saveAiLog = internalMutation({
    args: {
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
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("aiLogs", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

export const saveChatMessage = internalMutation({
    args: {
        sessionId: v.id("chatSessions"),
        role: v.string(),
        content: v.string(),
        toolCalls: v.optional(v.string()),
        tokenCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("chatMessages", {
            ...args,
            createdAt: Date.now(),
        });
        // Update session timestamp
        await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
    },
});

// ─── Tool Execution ──────────────────────────────────────────────────────

async function executeToolInConvex(
    ctx: any,
    name: string,
    args: Record<string, unknown>,
    orgId: string | undefined
): Promise<unknown> {
    // Route tool calls to internal Convex queries/mutations
    // This replaces the Express-based executeTool function
    switch (name) {
        case "list_projects":
            if (!orgId) return { error: "No organization context" };
            return await ctx.runQuery(internal.aiChat.toolListProjects, { orgId, ...args });
        case "get_project":
            if (!orgId) return { error: "No organization context" };
            return await ctx.runQuery(internal.aiChat.toolGetProject, { orgId, name: args.name as string });
        case "get_summary":
            if (!orgId) return { error: "No organization context" };
            return await ctx.runQuery(internal.aiChat.toolGetSummary, { orgId });
        default:
            return { error: `Tool "${name}" not yet implemented in Convex. Migration in progress.` };
    }
}

// ─── Internal Tool Handlers ──────────────────────────────────────────────

export const toolListProjects = internalQuery({
    args: {
        orgId: v.id("organizations"),
        tier: v.optional(v.string()),
        lane: v.optional(v.string()),
        priority: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        if (args.tier) projects = projects.filter((p) => p.tier === args.tier);
        if (args.lane) projects = projects.filter((p) => p.lane === args.lane);
        if (args.priority) projects = projects.filter((p) => p.priority === args.priority);

        return projects.map((p) => ({
            id: p._id,
            name: p.name,
            tier: p.tier,
            lane: p.lane,
            priority: p.priority,
            status: p.syncStatus,
            stack: p.stack,
            healthScore: p.healthScore,
        }));
    },
});

export const toolGetProject = internalQuery({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        const query = args.name.toLowerCase();
        const match = projects.find(
            (p) => p.name.toLowerCase().includes(query)
        );
        if (!match) return { error: `Project "${args.name}" not found` };
        return match;
    },
});

export const toolGetSummary = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        const byTier: Record<string, number> = {};
        const byLane: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byStack: Record<string, number> = {};

        for (const p of projects) {
            byTier[p.tier] = (byTier[p.tier] || 0) + 1;
            byLane[p.lane] = (byLane[p.lane] || 0) + 1;
            byPriority[p.priority] = (byPriority[p.priority] || 0) + 1;
            for (const s of p.stack || []) byStack[s] = (byStack[s] || 0) + 1;
        }

        const topStacks = Object.entries(byStack)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return { total: projects.length, byTier, byLane, byPriority, topStacks };
    },
});

// ─── LLM API Call ────────────────────────────────────────────────────────

interface LLMMessage {
    role: string;
    content: string;
}

interface LLMResult {
    content: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}

async function callLLM(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
): Promise<LLMResult> {
    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
        stream: false,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content || "";

    return {
        content,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
    };
}

// ─── Extract Tool Call ───────────────────────────────────────────────────

function extractToolCall(text: string): { name: string; arguments: Record<string, unknown> } | null {
    const patterns = [
        /```tool_call\s*\n?([\s\S]*?)```/,
        /```tool_call\s+([\s\S]*?)```/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const jsonStr = (match[1] || "").trim();
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.name && parsed.arguments !== undefined) return parsed;
            } catch { /* continue */ }
        }
    }
    return null;
}

// ─── Default System Prompt ───────────────────────────────────────────────

function buildDefaultSystemPrompt(): string {
    return `You are Mission Control AI, an intelligent assistant for managing a software project portfolio.

You can query, create, update, and delete data across all features: projects, tasks, ideas, workflows, marketing plans, wiki articles, content plans, and focus groups.

## Available Tools

When you need to access or modify data, output a JSON tool call in this exact format:
\`\`\`tool_call
{"name": "<tool_name>", "arguments": {<args>}}
\`\`\`

Available tools:

- list_projects: List all projects. Optionally filter by tier, lane, or priority.
- get_project: Get details for a specific project by name.
- get_summary: Get portfolio summary with counts by tier, lane, priority, and stack.

## Rules
1. Use tools to answer data questions — don't guess about project details
2. After receiving tool results, summarize them clearly for the user
3. Be concise but helpful
4. You can chain multiple tool calls if needed`;
}

// ─── Types ───────────────────────────────────────────────────────────────

interface ToolCallLog {
    name: string;
    args: Record<string, unknown>;
    result: unknown;
}
