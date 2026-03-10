import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Webhooks — Internal processing actions for voice memo and text webhooks.
 *
 * Called by http.ts after validating auth & logging the webhook request.
 */

// ─── Webhook Log Mutations ───────────────────────────────────────────────

export const createWebhookLog = internalMutation({
    args: {
        orgId: v.id("organizations"),
        type: v.string(),
        source: v.optional(v.string()),
        inputSummary: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("webhookLogs", {
            orgId: args.orgId,
            type: args.type,
            source: args.source,
            status: "received",
            inputSummary: args.inputSummary,
            createdAt: Date.now(),
        });
    },
});

export const updateWebhookLog = internalMutation({
    args: {
        logId: v.id("webhookLogs"),
        status: v.optional(v.string()),
        transcription: v.optional(v.string()),
        result: v.optional(v.string()),
        error: v.optional(v.string()),
        durationMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { logId, ...updates } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(logId, clean);
    },
});

// ─── Resolve Default Org ─────────────────────────────────────────────────

export const resolveDefaultOrg = internalQuery({
    args: {},
    handler: async (ctx) => {
        // Get the first admin user's default org
        const user = await ctx.db.query("users").first();
        if (!user) return null;
        if (user.defaultOrgId) return user.defaultOrgId;

        const membership = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();
        return membership?.orgId ?? null;
    },
});

// ─── List Webhook Logs (for UI) ──────────────────────────────────────────

export const listLogs = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const logs = await ctx.db
            .query("webhookLogs")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return logs.sort((a, b) => b.createdAt - a.createdAt);
    },
});

// ─── Process Voice Memo ──────────────────────────────────────────────────

export const processVoiceMemo = internalAction({
    args: {
        logId: v.id("webhookLogs"),
        orgId: v.id("organizations"),
        audioBase64: v.string(),
        mimeType: v.string(),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const startTime = Date.now();

        try {
            // 1. Update status to processing
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "processing",
            });

            // 2. Transcribe via aiVoice.transcribe
            const transcription = await ctx.runAction(internal.webhooks._transcribeAudio, {
                audioBase64: args.audioBase64,
                mimeType: args.mimeType,
                language: args.language,
            });

            const transcribedText = transcription.text;
            if (!transcribedText || transcribedText.trim().length === 0) {
                await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                    logId: args.logId,
                    status: "failed",
                    error: "Transcription returned empty text",
                    durationMs: Date.now() - startTime,
                });
                return;
            }

            // Save transcription
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                transcription: transcribedText.slice(0, 8000),
            });

            // 3. Process the transcribed text through LLM
            const extracted = await ctx.runAction(internal.webhooks._extractActions, {
                text: transcribedText,
                context: "voice memo",
            });

            // 4. Create tasks/ideas
            await ctx.runMutation(internal.webhooks._createExtractedItems, {
                orgId: args.orgId,
                extracted,
            });

            // 5. Mark complete
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "completed",
                result: extracted,
                durationMs: Date.now() - startTime,
            });
        } catch (err: unknown) {
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "failed",
                error: (err instanceof Error ? err.message : String(err) || String(err)).slice(0, 2000),
                durationMs: Date.now() - startTime,
            });
        }
    },
});

// ─── Process Text Input ──────────────────────────────────────────────────

export const processTextInput = internalAction({
    args: {
        logId: v.id("webhookLogs"),
        orgId: v.id("organizations"),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        const startTime = Date.now();

        try {
            // 1. Update status to processing
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "processing",
            });

            // 2. Process text through LLM
            const extracted = await ctx.runAction(internal.webhooks._extractActions, {
                text: args.text,
                context: "text message",
            });

            // 3. Create tasks/ideas
            await ctx.runMutation(internal.webhooks._createExtractedItems, {
                orgId: args.orgId,
                extracted,
            });

            // 4. Mark complete
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "completed",
                result: extracted,
                durationMs: Date.now() - startTime,
            });
        } catch (err: unknown) {
            await ctx.runMutation(internal.webhooks.updateWebhookLog, {
                logId: args.logId,
                status: "failed",
                error: (err instanceof Error ? err.message : String(err) || String(err)).slice(0, 2000),
                durationMs: Date.now() - startTime,
            });
        }
    },
});

// ─── Internal: Transcribe Audio ──────────────────────────────────────────

export const _transcribeAudio = internalAction({
    args: {
        audioBase64: v.string(),
        mimeType: v.string(),
        language: v.optional(v.string()),
    },
    handler: async (_ctx, args) => {
        // Resolve provider config (reuse aiVoice resolution logic)
        const provider = "nvidia";
        const baseUrl = process.env.STT_BASE_URL || "https://integrate.api.nvidia.com/v1";
        const apiKeyVar = "NVIDIA_API_KEY";
        const apiKey = process.env[apiKeyVar];
        const model = process.env.STT_MODEL || "nvidia/parakeet-ctc-1.1b-asr";

        if (!apiKey) {
            // Fallback to OpenAI
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
                throw new Error("No STT API key configured (NVIDIA_API_KEY or OPENAI_API_KEY).");
            }
            return await callSTT(
                process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
                openaiKey,
                "whisper-1",
                args.audioBase64,
                args.mimeType,
                args.language,
            );
        }

        return await callSTT(baseUrl, apiKey, model, args.audioBase64, args.mimeType, args.language);
    },
});

// ─── Internal: Extract Actions via LLM ───────────────────────────────────

export const _extractActions = internalAction({
    args: {
        text: v.string(),
        context: v.string(),
    },
    handler: async (_ctx, args) => {
        // Resolve LLM config
        const baseUrl = process.env.LLM_BASE_URL
            || process.env.OPENAI_BASE_URL
            || "https://integrate.api.nvidia.com/v1";
        const apiKey = process.env.LLM_API_KEY
            || process.env.NVIDIA_API_KEY
            || process.env.OPENAI_API_KEY;
        const model = process.env.LLM_MODEL || "meta/llama-3.3-70b-instruct";

        if (!apiKey) {
            throw new Error("No LLM API key configured.");
        }

        const systemPrompt = `You are a smart assistant that processes incoming ${args.context} content and extracts actionable items.

Analyze the following text and extract:
1. **Tasks** — concrete action items with a title, optional description, and priority (high/medium/low)
2. **Ideas** — thoughts, brainstorms, or concepts worth capturing
3. **Summary** — a brief 1-2 sentence summary of the overall content

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "tasks": [{"title": "...", "description": "...", "priority": "medium"}],
  "ideas": [{"title": "...", "body": "..."}],
  "summary": "..."
}

If there are no tasks or ideas, return empty arrays. Always include a summary.`;

        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: args.text.slice(0, 10000) },
                ],
                temperature: 0.3,
                max_tokens: 2048,
                stream: false,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 500)}`);
        }

        const data = await res.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content || "{}";

        // Try to extract JSON from the response (handle markdown wrapping)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : content;
    },
});

// ─── Internal: Create Extracted Items ────────────────────────────────────

export const _createExtractedItems = internalMutation({
    args: {
        orgId: v.id("organizations"),
        extracted: v.string(),
    },
    handler: async (ctx, args) => {
        let parsed: {
            tasks?: Array<{ title: string; description?: string; priority?: string }>;
            ideas?: Array<{ title: string; body?: string }>;
            summary?: string;
        };

        try {
            parsed = JSON.parse(args.extracted);
        } catch {
            // If JSON parsing fails, create a single task with the raw text
            const now = Date.now();
            await ctx.db.insert("tasks", {
                orgId: args.orgId,
                projectPath: "",
                title: "Webhook input (unparsed)",
                description: args.extracted.slice(0, 2000),
                taskType: "feature",
                status: "todo",
                priority: "medium",
                tags: ["webhook"],
                createdAt: now,
                updatedAt: now,
            });
            return;
        }

        const now = Date.now();

        // Create tasks
        for (const task of parsed.tasks || []) {
            if (!task.title) continue;
            await ctx.db.insert("tasks", {
                orgId: args.orgId,
                projectPath: "",
                title: task.title,
                description: task.description || parsed.summary,
                taskType: "feature",
                status: "todo",
                priority: task.priority || "medium",
                tags: ["webhook"],
                createdAt: now,
                updatedAt: now,
            });
        }

        // Create ideas
        for (const idea of parsed.ideas || []) {
            if (!idea.title) continue;
            await ctx.db.insert("ideas", {
                orgId: args.orgId,
                title: idea.title,
                body: idea.body || "",
                category: "general",
                score: 0,
                tags: ["webhook"],
                linkedProjects: [],
                linkedIdeas: [],
                archived: false,
                status: "new",
                createdAt: now,
                updatedAt: now,
            });
        }
    },
});

// ─── STT Helper ──────────────────────────────────────────────────────────

async function callSTT(
    baseUrl: string,
    apiKey: string,
    model: string,
    audioBase64: string,
    mimeType: string,
    language?: string,
): Promise<{ text: string }> {
    // Convert base64 to binary
    const binaryStr = atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = (mimeType || "audio/webm").split("/")[1] || "webm";

    // Build multipart form data
    const boundary = "----WebhookSTTBoundary" + Date.now();
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();

    // File part
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType || "audio/webm"}\r\n\r\n`));
    parts.push(bytes);
    parts.push(enc.encode("\r\n"));

    // Model part
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`));

    // Language part
    if (language) {
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`));
    }

    // Response format
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`));

    parts.push(enc.encode(`--${boundary}--\r\n`));

    // Combine
    const totalLen = parts.reduce((a, p) => a + p.length, 0);
    const body = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`STT API error (${res.status}): ${errText.slice(0, 500)}`);
    }

    const data = await res.json() as { text?: string };
    return { text: data.text || "" };
}
