import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

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

// ─── GitHub OAuth: Authorize ────────────────────────────────────────────

http.route({
    path: "/github/authorize",
    method: "GET",
    handler: httpAction(async (_ctx, request) => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            return jsonResponse(500, { error: "GITHUB_CLIENT_ID not configured" });
        }

        // Extract session token from query param
        const url = new URL(request.url);
        const sessionToken = url.searchParams.get("session");
        if (!sessionToken) {
            return jsonResponse(400, { error: "Missing session parameter" });
        }

        const redirectUri = process.env.GITHUB_REDIRECT_URI || `${url.origin}/github/callback`;
        const scopes = "repo,read:user,read:org";
        // Encode session token as state for the callback
        const state = btoa(sessionToken);

        const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}`;

        return new Response(null, {
            status: 302,
            headers: { Location: githubUrl },
        });
    }),
});

// ─── GitHub OAuth: Callback ─────────────────────────────────────────────

http.route({
    path: "/github/callback",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return jsonResponse(500, { error: "GitHub OAuth not configured" });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) {
            return jsonResponse(400, { error: "Missing code or state" });
        }

        // Decode session token from state
        let sessionToken: string;
        try {
            sessionToken = atob(state);
        } catch {
            return jsonResponse(400, { error: "Invalid state" });
        }

        try {
            // 1. Exchange code for access token
            const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                }),
            });

            const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
            if (!tokenData.access_token) {
                return jsonResponse(400, { error: tokenData.error || "Failed to get access token" });
            }

            // 2. Get GitHub username
            const userRes = await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "User-Agent": "MissionControl/1.0",
                },
            });
            const userData = await userRes.json() as { login?: string };

            // 3. Resolve session → user → org
            console.log('[GitHub OAuth] Resolving session token:', sessionToken.slice(0, 8) + '...');
            const session = await ctx.runQuery(internal.githubOAuth.resolveSession, {
                token: sessionToken,
            });
            console.log('[GitHub OAuth] Session resolved:', session ? `orgId=${session.orgId}` : 'null');

            if (!session?.orgId) {
                return jsonResponse(401, { error: "Invalid or expired session", debug: { tokenPrefix: sessionToken.slice(0, 8) } });
            }

            // 4. Store token on organization
            await ctx.runMutation(internal.github.saveGithubToken, {
                orgId: session.orgId as Id<"organizations">,
                githubToken: tokenData.access_token,
                githubUsername: userData.login,
            });

            // 5. Redirect back to the app
            const appUrl = process.env.APP_URL || "https://mission-control-app-green.vercel.app";
            return new Response(null, {
                status: 302,
                headers: { Location: `${appUrl}/integrations?github=connected` },
            });
        } catch (err: any) {
            console.error("GitHub OAuth callback error:", err);
            return jsonResponse(500, { error: err.message || "OAuth callback failed" });
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
