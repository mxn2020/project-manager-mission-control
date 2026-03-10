import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Default Persona Definitions ─────────────────────────────────────────

const DEFAULT_PERSONAS = [
    {
        name: "Mission Control",
        description: "Full-stack AI assistant with access to all features",
        icon: "🤖",
        tools: [
            "list_projects", "get_project", "update_project", "get_summary",
            "search_minions", "list_by_type", "create_minion",
            "manage_task", "manage_idea", "promote_idea", "combine_ideas",
            "manage_workflow", "manage_marketing", "manage_wiki", "manage_content",
            "get_focus_group", "update_focus_group", "run_automation",
        ],
        systemPrompt: `You are Mission Control AI, a comprehensive assistant for managing a software project portfolio.

You have full access to all features: projects, tasks, ideas, workflows, marketing plans, wiki articles, content plans, focus groups, and automation.

Be concise, helpful, and proactive. When users ask about data, always use tools — never guess. Format responses with markdown for readability.`,
        isDefault: true,
    },
    {
        name: "Project Manager",
        description: "Focused on project tracking, tasks, and focus groups",
        icon: "📊",
        tools: [
            "list_projects", "get_project", "update_project", "get_summary",
            "manage_task", "search_minions",
            "get_focus_group", "update_focus_group", "run_automation",
        ],
        systemPrompt: `You are the Project Manager AI, specialized in project oversight and task management.

Your expertise is in:
- Tracking project health, tiers, and priorities
- Managing tasks (creating, updating, assigning priorities)
- Focus group management (which projects need attention)
- Running automation for stale detection and health checks
- Providing portfolio summaries and insights

Be efficient and action-oriented. Suggest next steps and flag risks proactively.`,
        isDefault: false,
    },
    {
        name: "Ideas Lab",
        description: "Brainstorming, ideation, and idea management",
        icon: "💡",
        tools: [
            "manage_idea", "promote_idea", "combine_ideas",
            "search_minions", "list_by_type",
        ],
        systemPrompt: `You are the Ideas Lab AI, your creative partner for brainstorming and innovation.

Your expertise is in:
- Capturing and organizing ideas with scores and categories
- Finding connections between ideas (combining related ones)
- Promoting mature ideas into actionable tasks
- Searching across the knowledge base for inspiration

Be creative, encouraging, and help users think bigger. Ask clarifying questions to refine ideas. Suggest categories and tags proactively.`,
        isDefault: false,
    },
    {
        name: "Marketing Strategist",
        description: "Marketing plans, content strategy, and wiki management",
        icon: "📣",
        tools: [
            "manage_marketing", "manage_content", "manage_wiki",
            "search_minions", "list_by_type", "list_projects",
        ],
        systemPrompt: `You are the Marketing Strategist AI, focused on marketing plans, content strategy, and knowledge management.

Your expertise is in:
- Creating and managing marketing plans with goals and budgets
- Content planning for releases (blog posts, social media, announcements)
- Wiki article management (standards, patterns, guides)
- Linking content to projects for organized campaigns

Be strategic and data-driven. Suggest channel strategies, content calendars, and measurable goals.`,
        isDefault: false,
    },
    {
        name: "DevOps Engineer",
        description: "Workflows, automation, and project health monitoring",
        icon: "🔧",
        tools: [
            "list_projects", "get_project",
            "manage_workflow", "run_automation",
            "search_minions", "list_by_type",
        ],
        systemPrompt: `You are the DevOps Engineer AI, specialized in workflows, automation, and system health.

Your expertise is in:
- Creating and managing workflows with ordered steps
- Running automation pipelines (project scanning, stale detection, health checks)
- Monitoring project health scores and identifying issues
- Setting up repeatable processes and templates

Be systematic and thorough. Focus on efficiency, reliability, and process improvement.`,
        isDefault: false,
    },
];

// ─── Queries ─────────────────────────────────────────────────────────────

export const listPersonas = query({
    args: { orgId: v.optional(v.id("organizations")) },
    handler: async (ctx, args) => {
        // Get org-specific personas
        let personas: any[] = [];
        if (args.orgId) {
            personas = await ctx.db
                .query("chatbotConfigs")
                .withIndex("by_org", (q) => q.eq("orgId", args.orgId!))
                .collect();
        }

        // Also get global personas (no orgId, built-in)
        // For orgs without custom personas, return defaults from the code
        if (personas.length === 0) {
            return DEFAULT_PERSONAS.map((p, i) => ({
                _id: `default_${i}` as any,
                name: p.name,
                description: p.description,
                icon: p.icon,
                tools: p.tools,
                systemPrompt: p.systemPrompt,
                isDefault: p.isDefault,
                isBuiltIn: true,
            }));
        }

        // Resolve system prompts and tools for each persona
        const resolved = await Promise.all(
            personas.map(async (p) => {
                let systemPrompt = "";
                if (p.systemPromptId) {
                    const prompt = await ctx.db.get(p.systemPromptId);
                    systemPrompt = prompt?.content || "";
                }

                // Resolve tool names from toolSetIds
                const tools: string[] = [];
                for (const toolId of p.toolSetIds || []) {
                    const tool = await ctx.db.get(toolId);
                    if (tool) tools.push(tool.name);
                }

                return {
                    _id: p._id,
                    name: p.name,
                    description: p.description || "",
                    icon: (p as any).icon || "🤖",
                    tools,
                    systemPrompt,
                    isDefault: p.isDefault,
                    isAgentic: p.isAgentic,
                    isBuiltIn: false,
                    modelId: p.modelId,
                    temperature: p.temperature,
                    maxTokens: p.maxTokens,
                };
            })
        );

        return resolved;
    },
});

export const getPersona = query({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        // Check if it's a built-in default
        if (args.id.startsWith("default_")) {
            const idx = parseInt(args.id.replace("default_", ""));
            const p = DEFAULT_PERSONAS[idx];
            if (!p) return null;
            return {
                _id: args.id,
                name: p.name,
                description: p.description,
                icon: p.icon,
                tools: p.tools,
                systemPrompt: p.systemPrompt,
                isDefault: p.isDefault,
                isBuiltIn: true,
            };
        }

        // DB-stored persona
        const persona = await ctx.db.get(args.id as any);
        if (!persona) return null;

        let systemPrompt = "";
        if ((persona as any).systemPromptId) {
            const prompt = await ctx.db.get((persona as any).systemPromptId);
            systemPrompt = prompt?.content || "";
        }

        const tools: string[] = [];
        for (const toolId of (persona as any).toolSetIds || []) {
            const tool = await ctx.db.get(toolId);
            if (tool) tools.push(tool.name);
        }

        return {
            _id: persona._id,
            name: (persona as any).name,
            description: (persona as any).description || "",
            icon: (persona as any).icon || "🤖",
            tools,
            systemPrompt,
            isDefault: (persona as any).isDefault,
            isBuiltIn: false,
        };
    },
});

// ─── Get persona config for chat (used by aiChat action) ────────────────

export const getPersonaForChat = query({
    args: { personaId: v.optional(v.string()) },
    handler: async (_ctx, args) => {
        if (!args.personaId) {
            // Return default Mission Control
            return DEFAULT_PERSONAS[0];
        }

        // Check built-in defaults
        if (args.personaId.startsWith("default_")) {
            const idx = parseInt(args.personaId.replace("default_", ""));
            return DEFAULT_PERSONAS[idx] || DEFAULT_PERSONAS[0];
        }

        // For DB personas, return null (caller will handle via chatbotConfigId)
        return null;
    },
});

// ─── Mutations ───────────────────────────────────────────────────────────

export const seedDefaults = mutation({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        // Check if org already has personas
        const existing = await ctx.db
            .query("chatbotConfigs")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .collect();

        if (existing.length > 0) return { seeded: 0, message: "Personas already exist" };

        const now = Date.now();
        let seeded = 0;

        for (const p of DEFAULT_PERSONAS) {
            // Create system prompt
            const promptId = await ctx.db.insert("systemPrompts", {
                orgId: args.orgId,
                name: `${p.name} Prompt`,
                content: p.systemPrompt,
                version: 1,
                isActive: true,
                createdAt: now,
            });

            // Create tool definitions
            const toolIds = [];
            for (const toolName of p.tools) {
                const toolId = await ctx.db.insert("toolDefinitions", {
                    orgId: args.orgId,
                    name: toolName,
                    description: toolName,
                    parameters: "{}",
                    handlerType: "built-in",
                    isEnabled: true,
                    createdAt: now,
                });
                toolIds.push(toolId);
            }

            // Create chatbot config
            await ctx.db.insert("chatbotConfigs", {
                orgId: args.orgId,
                name: p.name,
                description: p.description,
                systemPromptId: promptId,
                toolSetIds: toolIds,
                isDefault: p.isDefault,
                isAgentic: false,
                createdAt: now,
                updatedAt: now,
            });

            seeded++;
        }

        return { seeded, message: `Seeded ${seeded} default personas` };
    },
});

export const upsertPersona = mutation({
    args: {
        id: v.optional(v.id("chatbotConfigs")),
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        systemPrompt: v.string(),
        tools: v.array(v.string()),
        modelId: v.optional(v.id("aiModels")),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        isDefault: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        if (args.id) {
            // Update existing
            const existing = await ctx.db.get(args.id);
            if (!existing) throw new Error("Persona not found");

            // Update system prompt
            if (existing.systemPromptId) {
                await ctx.db.patch(existing.systemPromptId, {
                    content: args.systemPrompt,
                    version: ((await ctx.db.get(existing.systemPromptId))?.version || 0) + 1,
                });
            }

            // Update tool definitions — delete old, create new
            for (const toolId of existing.toolSetIds) {
                await ctx.db.delete(toolId);
            }
            const toolIds = [];
            for (const toolName of args.tools) {
                const toolId = await ctx.db.insert("toolDefinitions", {
                    orgId: args.orgId,
                    name: toolName,
                    description: toolName,
                    parameters: "{}",
                    handlerType: "built-in",
                    isEnabled: true,
                    createdAt: now,
                });
                toolIds.push(toolId);
            }

            await ctx.db.patch(args.id, {
                name: args.name,
                description: args.description,
                toolSetIds: toolIds,
                modelId: args.modelId,
                temperature: args.temperature,
                maxTokens: args.maxTokens,
                isDefault: args.isDefault ?? false,
                updatedAt: now,
            });

            return args.id;
        }

        // Create new
        const promptId = await ctx.db.insert("systemPrompts", {
            orgId: args.orgId,
            name: `${args.name} Prompt`,
            content: args.systemPrompt,
            version: 1,
            isActive: true,
            createdAt: now,
        });

        const toolIds = [];
        for (const toolName of args.tools) {
            const toolId = await ctx.db.insert("toolDefinitions", {
                orgId: args.orgId,
                name: toolName,
                description: toolName,
                parameters: "{}",
                handlerType: "built-in",
                isEnabled: true,
                createdAt: now,
            });
            toolIds.push(toolId);
        }

        return await ctx.db.insert("chatbotConfigs", {
            orgId: args.orgId,
            name: args.name,
            description: args.description,
            systemPromptId: promptId,
            toolSetIds: toolIds,
            modelId: args.modelId,
            temperature: args.temperature,
            maxTokens: args.maxTokens,
            isDefault: args.isDefault ?? false,
            isAgentic: false,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const deletePersona = mutation({
    args: { id: v.id("chatbotConfigs") },
    handler: async (ctx, args) => {
        const persona = await ctx.db.get(args.id);
        if (!persona) throw new Error("Persona not found");

        // Delete associated system prompt
        if (persona.systemPromptId) {
            await ctx.db.delete(persona.systemPromptId);
        }

        // Delete associated tool definitions
        for (const toolId of persona.toolSetIds) {
            try { await ctx.db.delete(toolId); } catch { /* already deleted */ }
        }

        await ctx.db.delete(args.id);
    },
});
