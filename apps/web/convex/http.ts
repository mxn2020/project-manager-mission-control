import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * HTTP Router — Webhook endpoints for voice memos and text input.
 *
 * POST /webhooks/voice — Receive audio (base64 JSON or raw), transcribe, extract actions
 * POST /webhooks/text  — Receive text, extract actions
 *
 * Auth: Authorization: Bearer <WEBHOOK_SECRET>
 */

const http = httpRouter();

// ─── Voice Memo Webhook ──────────────────────────────────────────────────

http.route({
    path: "/webhooks/voice",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        // 1. Validate auth
        const authError = validateWebhookAuth(request);
        if (authError) return authError;

        try {
            // 2. Parse request body
            const contentType = request.headers.get("content-type") || "";
            let audioBase64: string;
            let mimeType: string;
            let source: string | undefined;
            let language: string | undefined;

            if (contentType.includes("application/json")) {
                // JSON body with base64-encoded audio
                const body = await request.json() as {
                    audioBase64?: string;
                    mimeType?: string;
                    source?: string;
                    language?: string;
                };
                if (!body.audioBase64) {
                    return jsonResponse(400, { error: "Missing audioBase64 field" });
                }
                audioBase64 = body.audioBase64;
                mimeType = body.mimeType || "audio/webm";
                source = body.source;
                language = body.language;
            } else {
                // Raw binary / form-data: read as ArrayBuffer and base64-encode
                const buffer = await request.arrayBuffer();
                if (buffer.byteLength === 0) {
                    return jsonResponse(400, { error: "Empty audio body" });
                }
                audioBase64 = arrayBufferToBase64(buffer);
                mimeType = contentType.split(";")[0] || "audio/webm";
                source = request.headers.get("x-webhook-source") || undefined;
                language = request.headers.get("x-language") || undefined;
            }

            // 3. Resolve org
            const orgId = await ctx.runQuery(internal.webhooks.resolveDefaultOrg, {}) as Id<"organizations"> | null;
            if (!orgId) {
                return jsonResponse(500, { error: "No organization found. Create a user first." });
            }

            // 4. Create webhook log
            const logId = await ctx.runMutation(internal.webhooks.createWebhookLog, {
                orgId,
                type: "voice",
                source,
                inputSummary: `Voice memo (${mimeType}, ${Math.round(audioBase64.length * 3 / 4 / 1024)}KB)`,
            });

            // 5. Schedule async processing
            await ctx.scheduler.runAfter(0, internal.webhooks.processVoiceMemo, {
                logId,
                orgId,
                audioBase64,
                mimeType,
                language,
            });

            // 6. Return accepted
            return jsonResponse(202, {
                status: "accepted",
                webhookLogId: logId,
                message: "Voice memo received. Processing in background.",
            });
        } catch (err: any) {
            return jsonResponse(500, { error: err.message || "Internal server error" });
        }
    }),
});

// ─── Text Webhook ────────────────────────────────────────────────────────

http.route({
    path: "/webhooks/text",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        // 1. Validate auth
        const authError = validateWebhookAuth(request);
        if (authError) return authError;

        try {
            // 2. Parse request body
            const body = await request.json() as {
                text?: string;
                source?: string;
            };

            if (!body.text || body.text.trim().length === 0) {
                return jsonResponse(400, { error: "Missing or empty 'text' field" });
            }

            const text = body.text.trim();

            // 3. Resolve org
            const orgId = await ctx.runQuery(internal.webhooks.resolveDefaultOrg, {}) as Id<"organizations"> | null;
            if (!orgId) {
                return jsonResponse(500, { error: "No organization found. Create a user first." });
            }

            // 4. Create webhook log
            const logId = await ctx.runMutation(internal.webhooks.createWebhookLog, {
                orgId,
                type: "text",
                source: body.source,
                inputSummary: text.slice(0, 200),
            });

            // 5. Schedule async processing
            await ctx.scheduler.runAfter(0, internal.webhooks.processTextInput, {
                logId,
                orgId,
                text,
            });

            // 6. Return accepted
            return jsonResponse(202, {
                status: "accepted",
                webhookLogId: logId,
                message: "Text received. Processing in background.",
            });
        } catch (err: any) {
            return jsonResponse(500, { error: err.message || "Internal server error" });
        }
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────

function validateWebhookAuth(request: Request): Response | null {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!expectedSecret) {
        return jsonResponse(500, { error: "WEBHOOK_SECRET not configured on server" });
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token || token !== expectedSecret) {
        return jsonResponse(401, { error: "Unauthorized. Provide valid Authorization: Bearer <secret>" });
    }

    return null; // Auth OK
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export default http;
