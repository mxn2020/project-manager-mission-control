/**
 * AI Chat endpoint with Minions SDK tool-calling.
 *
 * The LLM (NVIDIA NIM / Llama 3.1) receives Minions CRUD operations as
 * tool descriptions in the system prompt. When it needs data, it returns
 * a JSON tool call which this module executes via the Minions SDK, then
 * feeds the result back for a final answer.
 *
 * Usage: imported by server/index.mjs
 */

import { getMinions, getRegistry, listByType, minionToFlat, ALL_TYPES } from './minions-adapter.mjs';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = process.env.AI_MODEL || 'meta/llama-3.1-70b-instruct';

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
            // Top 10 stacks
            const topStacks = Object.entries(byStack).sort((a, b) => b[1] - a[1]).slice(0, 10);
            return { total: projects.length, byTier, byLane, byPriority, topStacks };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt() {
    const toolDescs = TOOLS.map(t => {
        const params = t.parameters.properties
            ? Object.entries(t.parameters.properties)
                .map(([k, v]) => `    ${k}: ${v.description}`)
                .join('\n')
            : '    (no parameters)';
        const required = t.parameters.required ? ` Required: ${t.parameters.required.join(', ')}` : '';
        return `- ${t.name}: ${t.description}${required}\n${params}`;
    }).join('\n\n');

    return `You are Mission Control AI, an intelligent assistant for managing a software project portfolio.

You have access to the Minions database containing ${ALL_TYPES.length} data types across projects, tasks, content, costs, and ideas. You can query, create, and update data.

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
 * Process a chat message. Handles the tool-calling loop:
 * 1. Send to LLM with tool descriptions
 * 2. If response contains tool_call, execute it
 * 3. Feed result back to LLM for final answer
 * 4. Return the final response
 */
export async function handleChat(messages) {
    if (!NVIDIA_API_KEY) {
        throw new Error('NVIDIA_API_KEY not configured');
    }

    // Build full messages with system prompt
    const fullMessages = [
        { role: 'system', content: buildSystemPrompt() },
        ...messages,
    ];

    // First LLM call
    let response = await callNvidia(fullMessages);

    // Check for tool calls (up to 3 rounds)
    for (let round = 0; round < 3; round++) {
        const toolCall = extractToolCall(response);
        if (!toolCall) break;

        console.log(`🔧 Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
        const result = await executeTool(toolCall.name, toolCall.arguments);
        console.log(`📋 Tool result: ${JSON.stringify(result).slice(0, 200)}...`);

        // Feed result back to LLM
        fullMessages.push({ role: 'assistant', content: response });
        fullMessages.push({
            role: 'user',
            content: `Tool "${toolCall.name}" returned:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\nPlease summarize this for the user.`,
        });

        response = await callNvidia(fullMessages);
    }

    // Strip any remaining tool_call blocks from final response
    response = response.replace(/```tool_call\n[\s\S]*?```/g, '').trim();

    return response;
}

// ─── NVIDIA API Call ────────────────────────────────────────────────────────

async function callNvidia(messages) {
    const body = {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
        stream: false,
    };

    const res = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`NVIDIA API error (${res.status}): ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log(`🤖 LLM [${MODEL}]: ${data.usage?.total_tokens || '?'} tokens, ${content.length} chars`);

    return content;
}

// ─── Extract Tool Call ──────────────────────────────────────────────────────

function extractToolCall(text) {
    const match = text.match(/```tool_call\n([\s\S]*?)```/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.name && parsed.arguments !== undefined) return parsed;
    } catch { /* not valid JSON */ }
    return null;
}
