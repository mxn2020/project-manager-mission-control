/**
 * AI Chat endpoint with Minions SDK tool-calling.
 *
 * Reads model/provider/settings from Convex, calls the configured LLM,
 * executes tool calls via Minions SDK, and logs everything to Convex.
 *
 * Usage: imported by server/index.mjs
 */

import { getMinions, getRegistry, listByType, minionToFlat, ALL_TYPES } from './minions-adapter.mjs';

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) console.warn('⚠️  CONVEX_URL not set — AI chat Convex integration will not work');

// Fallback config (used if Convex has no providers/models yet)
const FALLBACK_CONFIG = {
    model: process.env.AI_MODEL || 'meta/llama-3.1-70b-instruct',
    maxTokens: 2048,
    temperature: 0.7,
    historyLength: 10,
    toolsEnabled: true,
    enabledTools: null,
    systemPromptOverride: null,
    provider: {
        name: 'NVIDIA NIM',
        slug: 'nvidia',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKeyEnvVar: 'NVIDIA_API_KEY',
    },
    costs: { input: 0, output: 0, thinking: 0 },
};

// ─── Convex Helpers ─────────────────────────────────────────────────────────

async function convexQuery(path, args = {}) {
    try {
        const res = await fetch(`${CONVEX_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, args, format: 'json' }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.value;
    } catch (err) {
        console.error(`Convex query error (${path}):`, err.message);
        return null;
    }
}

async function convexMutation(path, args = {}) {
    try {
        const res = await fetch(`${CONVEX_URL}/api/mutation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, args, format: 'json' }),
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`Convex mutation error (${path}):`, errText);
            return null;
        }
        const data = await res.json();
        return data.value;
    } catch (err) {
        console.error(`Convex mutation error (${path}):`, err.message);
        return null;
    }
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const TOOLS = [
    {
        name: 'list_projects',
        description: 'List all projects. Optionally filter by tier, lane, or priority.',
        parameters: {
            type: 'object',
            properties: {
                tier: { type: 'string', description: 'Filter by tier: idea, prototype, building, shipped, maintaining, archived' },
                lane: { type: 'string', description: 'Filter by lane/category' },
                priority: { type: 'string', description: 'Filter by priority: low, medium, high, critical' },
                limit: { type: 'number', description: 'Max results to return (default 20)' },
            },
        },
    },
    {
        name: 'get_project',
        description: 'Get detailed info about a specific project by name or path.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Project name to search for' },
            },
            required: ['name'],
        },
    },
    {
        name: 'search_minions',
        description: 'Full-text search across all minions data (projects, tasks, ideas, etc).',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
        },
    },
    {
        name: 'list_by_type',
        description: 'List all minions of a specific type. Available types: project, mc-task, contentBrief, draft, channel, campaign, budget, expense, idea, featureSpec, roadmapDoc',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', description: 'The minion type slug' },
                limit: { type: 'number', description: 'Max results (default 20)' },
            },
            required: ['type'],
        },
    },
    {
        name: 'create_minion',
        description: 'Create a new minion of any type (task, idea, expense, etc).',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', description: 'The minion type slug (e.g. mc-task, idea, expense)' },
                title: { type: 'string', description: 'Title of the new minion' },
                description: { type: 'string', description: 'Description' },
                fields: { type: 'object', description: 'Additional fields specific to the type' },
            },
            required: ['type', 'title'],
        },
    },
    {
        name: 'update_project',
        description: 'Update fields on an existing project.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Project name to update' },
                updates: { type: 'object', description: 'Fields to update (e.g. tier, priority, notes)' },
            },
            required: ['name', 'updates'],
        },
    },
    {
        name: 'get_summary',
        description: 'Get a summary of the entire portfolio: total projects, breakdown by tier/lane/priority, top stacks.',
        parameters: { type: 'object', properties: {} },
    },
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeTool(name, args) {
    const mc = getMinions();

    switch (name) {
        case 'list_projects': {
            const projects = await listByType('project');
            let filtered = projects;
            if (args.tier) filtered = filtered.filter(p => p.fields?.tier === args.tier);
            if (args.lane) filtered = filtered.filter(p => p.fields?.lane === args.lane);
            if (args.priority) filtered = filtered.filter(p => (p.fields?.priority || p.priority) === args.priority);
            const limit = args.limit || 20;
            return filtered.slice(0, limit).map(p => ({
                name: p.title,
                tier: p.fields?.tier,
                lane: p.fields?.lane,
                priority: p.fields?.priority || p.priority,
                stack: p.fields?.stack,
                healthScore: p.fields?.healthScore,
                path: p.fields?.path,
            }));
        }

        case 'get_project': {
            const projects = await listByType('project');
            const query = (args.name || '').toLowerCase();
            const match = projects.find(p =>
                p.title.toLowerCase().includes(query) ||
                (p.fields?.path || '').toLowerCase().includes(query)
            );
            if (!match) return { error: `Project "${args.name}" not found` };
            return minionToFlat(match);
        }

        case 'search_minions': {
            const results = await mc.searchMinions(args.query || '');
            return results.slice(0, 15).map(m => ({
                id: m.id,
                title: m.title,
                type: m.minionTypeId,
                status: m.status,
                fields: m.fields,
            }));
        }

        case 'list_by_type': {
            try {
                const items = await listByType(args.type);
                const limit = args.limit || 20;
                return items.slice(0, limit).map(minionToFlat);
            } catch (err) {
                return { error: err.message };
            }
        }

        case 'create_minion': {
            try {
                const wrapper = await mc.create(args.type, {
                    title: args.title,
                    description: args.description || '',
                    fields: args.fields || {},
                });
                await mc.save(wrapper.data);
                return { success: true, id: wrapper.data.id, title: wrapper.data.title };
            } catch (err) {
                return { error: err.message };
            }
        }

        case 'update_project': {
            const projects = await listByType('project');
            const query = (args.name || '').toLowerCase();
            const match = projects.find(p => p.title.toLowerCase().includes(query));
            if (!match) return { error: `Project "${args.name}" not found` };
            try {
                const updated = await mc.update(match, {
                    fields: { ...match.fields, ...args.updates },
                });
                await mc.save(updated.data);
                return { success: true, updated: Object.keys(args.updates) };
            } catch (err) {
                return { error: err.message };
            }
        }

        case 'get_summary': {
            const projects = await listByType('project');
            const byTier = {}, byLane = {}, byPriority = {}, byStack = {};
            for (const p of projects) {
                const t = p.fields?.tier || 'idea';
                const l = p.fields?.lane || 'uncategorized';
                const pr = p.fields?.priority || 'medium';
                byTier[t] = (byTier[t] || 0) + 1;
                byLane[l] = (byLane[l] || 0) + 1;
                byPriority[pr] = (byPriority[pr] || 0) + 1;
                for (const s of (p.fields?.stack || [])) byStack[s] = (byStack[s] || 0) + 1;
            }
            const topStacks = Object.entries(byStack).sort((a, b) => b[1] - a[1]).slice(0, 10);
            return { total: projects.length, byTier, byLane, byPriority, topStacks };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(config) {
    const enabledTools = config.toolsEnabled
        ? (config.enabledTools ? TOOLS.filter(t => config.enabledTools.includes(t.name)) : TOOLS)
        : [];

    const toolDescs = enabledTools.map(t => {
        const params = t.parameters.properties
            ? Object.entries(t.parameters.properties)
                .map(([k, v]) => `    ${k}: ${v.description}`)
                .join('\n')
            : '    (no parameters)';
        const required = t.parameters.required ? ` Required: ${t.parameters.required.join(', ')}` : '';
        return `- ${t.name}: ${t.description}${required}\n${params}`;
    }).join('\n\n');

    const base = config.systemPromptOverride || `You are Mission Control AI, an intelligent assistant for managing a software project portfolio.

You have access to the Minions database containing ${ALL_TYPES.length} data types across projects, tasks, content, costs, and ideas. You can query, create, and update data.`;

    if (enabledTools.length === 0) {
        return `${base}\n\nNote: Data tools are currently disabled. Answer based on general knowledge only.`;
    }

    return `${base}

## Available Tools

When you need to access or modify data, output a JSON tool call in this exact format:
\`\`\`tool_call
{"name": "<tool_name>", "arguments": {<args>}}
\`\`\`

Available tools:

${toolDescs}

## Rules
1. Use tools to answer data questions — don't guess about project details
2. After receiving tool results, summarize them clearly for the user
3. Be concise but helpful
4. When listing projects, format them nicely
5. You can chain multiple tool calls if needed
6. If a tool returns an error, explain it to the user
7. For project counts, tiers, or summaries, use get_summary first`;
}

// ─── Chat Handler ───────────────────────────────────────────────────────────

/**
 * Process a chat message. Handles the tool-calling loop with Convex config.
 * @param {Array} messages - Conversation messages
 * @param {Object} options - { userId, sessionId } from auth
 */
export async function handleChat(messages, options = {}) {
    const { userId, sessionId } = options;
    const startTime = Date.now();

    // 1. Fetch config from Convex (falls back to hardcoded defaults)
    const config = await convexQuery('aiConfig:getActiveConfig', { userId: userId || undefined }) || FALLBACK_CONFIG;

    // 2. Resolve API key
    const apiKeyEnvVar = config.provider?.apiKeyEnvVar || 'NVIDIA_API_KEY';
    const apiKey = process.env[apiKeyEnvVar];
    if (!apiKey) {
        throw new Error(`${apiKeyEnvVar} not configured`);
    }

    const baseUrl = config.provider?.baseUrl || 'https://integrate.api.nvidia.com/v1';
    const model = config.model || FALLBACK_CONFIG.model;
    const temperature = config.temperature ?? 0.7;
    const maxTokens = config.maxTokens ?? 2048;

    // 3. Build messages with system prompt (respect historyLength)
    const historyLength = config.historyLength ?? 10;
    const trimmedMessages = messages.slice(-historyLength);
    const fullMessages = [
        { role: 'system', content: buildSystemPrompt(config) },
        ...trimmedMessages,
    ];

    const toolCallsLog = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // 4. First LLM call
    let llmResult = await callLLM(baseUrl, apiKey, model, fullMessages, temperature, maxTokens);
    let response = llmResult.content;
    totalPromptTokens += llmResult.promptTokens || 0;
    totalCompletionTokens += llmResult.completionTokens || 0;

    // 5. Tool-calling loop (up to 3 rounds, skip if tools disabled)
    if (config.toolsEnabled !== false) {
        for (let round = 0; round < 3; round++) {
            const toolCall = extractToolCall(response);
            if (!toolCall) break;

            // Check if tool is enabled
            if (config.enabledTools && !config.enabledTools.includes(toolCall.name)) {
                break; // Tool not enabled
            }

            console.log(`🔧 Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
            const result = await executeTool(toolCall.name, toolCall.arguments);
            console.log(`📋 Tool result: ${JSON.stringify(result).slice(0, 200)}...`);

            toolCallsLog.push({ name: toolCall.name, args: toolCall.arguments, result });

            fullMessages.push({ role: 'assistant', content: response });
            fullMessages.push({
                role: 'user',
                content: `Tool "${toolCall.name}" returned:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nPlease summarize this for the user.`,
            });

            llmResult = await callLLM(baseUrl, apiKey, model, fullMessages, temperature, maxTokens);
            response = llmResult.content;
            totalPromptTokens += llmResult.promptTokens || 0;
            totalCompletionTokens += llmResult.completionTokens || 0;
        }
    }

    // 6. Strip remaining tool_call blocks
    response = response.replace(/```tool_call[\s\S]*?```/g, '').trim();

    // 7. Calculate cost
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const costCents = config.costs
        ? ((totalPromptTokens / 1_000_000) * config.costs.input) +
        ((totalCompletionTokens / 1_000_000) * config.costs.output)
        : 0;

    const durationMs = Date.now() - startTime;

    // 8. Save AI log to Convex (fire-and-forget)
    convexMutation('aiLogs:saveLog', {
        userId: userId || undefined,
        sessionId: sessionId || undefined,
        model,
        provider: config.provider?.slug || 'nvidia',
        caller: 'chat',
        promptMessages: JSON.stringify(trimmedMessages).slice(0, 8000),
        responseContent: response.slice(0, 8000),
        toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog).slice(0, 8000) : undefined,
        promptTokens: totalPromptTokens || undefined,
        completionTokens: totalCompletionTokens || undefined,
        totalTokens: totalTokens || undefined,
        costCents: costCents > 0 ? Math.round(costCents * 100) / 100 : undefined,
        durationMs,
        status: 'success',
    }).catch(err => console.error('Failed to save AI log:', err.message));

    // 9. Save messages to session (if session exists)
    if (sessionId) {
        const userMsg = messages[messages.length - 1];
        if (userMsg) {
            convexMutation('chatSessions:addMessage', {
                sessionId,
                role: 'user',
                content: userMsg.content,
            }).catch(() => { });
        }
        convexMutation('chatSessions:addMessage', {
            sessionId,
            role: 'assistant',
            content: response,
            toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog.map(t => t.name)) : undefined,
            tokenCount: totalTokens || undefined,
        }).catch(() => { });
    }

    return {
        response,
        model,
        provider: config.provider?.slug || 'nvidia',
        tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalTokens },
        costCents: Math.round(costCents * 100) / 100,
        durationMs,
        toolCalls: toolCallsLog.map(t => t.name),
    };
}

// ─── LLM Call ───────────────────────────────────────────────────────────────

async function callLLM(baseUrl, apiKey, model, messages, temperature, maxTokens) {
    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
        stream: false,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log(`🤖 LLM [${model}]: ${data.usage?.total_tokens || '?'} tokens, ${content.length} chars`);

    return {
        content,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
    };
}

// ─── Extract Tool Call ──────────────────────────────────────────────────────

function extractToolCall(text) {
    const patterns = [
        /```tool_call\s*\n?([\s\S]*?)```/,
        /```tool_call\s+([\s\S]*?)```/,
        /```json\s*\n?\s*\{[\s\S]*?"name"\s*:/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let jsonStr = match[1] || match[0];
            jsonStr = jsonStr.replace(/^```(?:tool_call|json)?\s*\n?/, '').replace(/\n?```$/, '').trim();
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.name && parsed.arguments !== undefined) return parsed;
            } catch { /* continue */ }
        }
    }
    return null;
}
