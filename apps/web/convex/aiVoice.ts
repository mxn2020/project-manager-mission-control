import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * AI Voice — Convex actions for Speech-to-Text and Text-to-Speech.
 *
 * Supports multiple providers:
 * - OpenAI-compatible REST: Whisper (NVIDIA, OpenAI, Groq)
 * - Chatterbox local: Local Python server for TTS
 * - Riva gRPC: NVIDIA Parakeet/Magpie (requires proxy, returns error if unavailable)
 */

// ─── Speech-to-Text ──────────────────────────────────────────────────────

export const transcribe = action({
    args: {
        audioBase64: v.string(),
        mimeType: v.optional(v.string()),
        language: v.optional(v.string()),
        model: v.optional(v.string()),          // model name override
        provider: v.optional(v.string()),       // "nvidia" | "openai" | etc.
        baseUrl: v.optional(v.string()),        // API base URL override
        apiKeyEnvVar: v.optional(v.string()),   // env var override
    },
    handler: async (_ctx, args) => {
        // Resolve provider config
        const provider = args.provider || "nvidia";
        const baseUrl = args.baseUrl || resolveSTTBaseUrl(provider);
        const apiKeyVar = args.apiKeyEnvVar || resolveSTTApiKeyVar(provider);
        const apiKey = process.env[apiKeyVar];
        const model = args.model || resolveSTTModel(provider);

        if (!apiKey) {
            throw new Error(`${apiKeyVar} not configured. Set it in Convex environment variables.`);
        }

        // Check if this is a Riva gRPC model
        if (baseUrl.startsWith("grpc.")) {
            throw new Error(
                `Model "${model}" uses NVIDIA Riva gRPC protocol which requires a proxy server. ` +
                `Use Whisper (whisper-large-v3) for REST-based transcription, or set up a gRPC proxy.`
            );
        }

        // Convert base64 to binary
        const binaryStr = atob(args.audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        // Determine file extension
        const ext = (args.mimeType || "audio/webm").split("/")[1] || "webm";

        // Build multipart form data
        const boundary = "----ConvexSTTBoundary" + Date.now();
        const parts: Uint8Array[] = [];
        const enc = new TextEncoder();

        // File part
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${args.mimeType || "audio/webm"}\r\n\r\n`));
        parts.push(bytes);
        parts.push(enc.encode("\r\n"));

        // Model part
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`));

        // Language part
        if (args.language) {
            parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${args.language}\r\n`));
        }

        // Response format
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`));

        // Timestamps (verbose)
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nword\r\n`));

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

        const data = await res.json() as { text?: string; words?: any[]; duration?: number; language?: string };
        return {
            text: data.text || "",
            words: data.words,
            duration: data.duration,
            language: data.language,
            model,
            provider,
        };
    },
});

// ─── Text-to-Speech ──────────────────────────────────────────────────────

export const synthesize = action({
    args: {
        text: v.string(),
        voice: v.optional(v.string()),
        model: v.optional(v.string()),
        speed: v.optional(v.number()),
        provider: v.optional(v.string()),
        baseUrl: v.optional(v.string()),
        apiKeyEnvVar: v.optional(v.string()),
        language: v.optional(v.string()),
        referenceAudioBase64: v.optional(v.string()),  // For voice cloning
    },
    handler: async (_ctx, args) => {
        const provider = args.provider || "openai";
        const baseUrl = args.baseUrl || resolveTTSBaseUrl(provider);
        const model = args.model || resolveTTSModel(provider);

        // ─── Chatterbox Local ────────────────────────────────────────
        if (provider === "chatterbox") {
            return await callChatterbox(baseUrl, args.text, {
                model,
                language: args.language,
                referenceAudioBase64: args.referenceAudioBase64,
            });
        }

        // ─── Riva gRPC (not directly supported) ─────────────────────
        if (baseUrl.startsWith("grpc.")) {
            throw new Error(
                `Model "${model}" uses NVIDIA Riva gRPC protocol. ` +
                `Use Chatterbox (local) or OpenAI TTS for REST-based synthesis, or set up a gRPC proxy.`
            );
        }

        // ─── OpenAI-compatible REST ──────────────────────────────────
        const apiKeyVar = args.apiKeyEnvVar || resolveTTSApiKeyVar(provider);
        const apiKey = process.env[apiKeyVar];
        if (!apiKey) {
            throw new Error(`${apiKeyVar} not configured.`);
        }

        const res = await fetch(`${baseUrl}/audio/speech`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input: args.text.slice(0, 4096),
                voice: args.voice || "alloy",
                speed: args.speed ?? 1.0,
                response_format: "mp3",
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`TTS API error (${res.status}): ${errText.slice(0, 500)}`);
        }

        const buffer = await res.arrayBuffer();
        return {
            audioBase64: arrayBufferToBase64(buffer),
            mimeType: "audio/mpeg",
            model,
            provider,
        };
    },
});

// ─── File Processing ─────────────────────────────────────────────────────

export const processFile = action({
    args: {
        fileBase64: v.string(),
        fileName: v.string(),
        mimeType: v.string(),
    },
    handler: async (_ctx, args) => {
        const { fileName, mimeType, fileBase64 } = args;

        // Audio files → return for client-side handling
        if (mimeType.startsWith("audio/")) {
            return { type: "audio", fileName, content: fileBase64, mimeType };
        }

        // Text/Markdown/JSON/CSV/YAML → decode
        if (
            mimeType.startsWith("text/") ||
            mimeType === "application/json" ||
            mimeType === "application/x-yaml" ||
            fileName.match(/\.(md|json|yaml|yml|csv|txt)$/i)
        ) {
            const binaryStr = atob(fileBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            return { type: "text", fileName, content: new TextDecoder().decode(bytes).slice(0, 50000) };
        }

        // Images → data URL
        if (mimeType.startsWith("image/")) {
            return { type: "image", fileName, content: `data:${mimeType};base64,${fileBase64}` };
        }

        return { type: "unsupported", fileName, content: `Unsupported file type: ${mimeType}` };
    },
});

// ─── Chatterbox HTTP Client ──────────────────────────────────────────────

async function callChatterbox(
    baseUrl: string,
    text: string,
    opts: { model?: string; language?: string; referenceAudioBase64?: string }
): Promise<{ audioBase64: string; mimeType: string; model: string; provider: string }> {
    const body: Record<string, unknown> = {
        text,
        model: opts.model || "chatterbox",
        language: opts.language || "en",
    };
    if (opts.referenceAudioBase64) {
        body.reference_audio = opts.referenceAudioBase64;
    }

    let res: Response;
    try {
        res = await fetch(`${baseUrl}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (err: any) {
        throw new Error(
            `Chatterbox server not reachable at ${baseUrl}. ` +
            `Start it with: python scripts/chatterbox-server.py\n` +
            `Error: ${err.message}`
        );
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Chatterbox error (${res.status}): ${errText.slice(0, 500)}`);
    }

    const buffer = await res.arrayBuffer();
    return {
        audioBase64: arrayBufferToBase64(buffer),
        mimeType: "audio/wav",
        model: opts.model || "chatterbox",
        provider: "chatterbox",
    };
}

// ─── Provider Resolution Helpers ─────────────────────────────────────────

function resolveSTTBaseUrl(provider: string): string {
    if (provider === "nvidia") return process.env.STT_BASE_URL || "https://integrate.api.nvidia.com/v1";
    if (provider === "openai") return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    return process.env.STT_BASE_URL || "https://api.openai.com/v1";
}

function resolveSTTApiKeyVar(provider: string): string {
    if (provider === "nvidia") return "NVIDIA_API_KEY";
    if (provider === "openai") return "OPENAI_API_KEY";
    return process.env.STT_API_KEY ? "STT_API_KEY" : "OPENAI_API_KEY";
}

function resolveSTTModel(provider: string): string {
    if (provider === "nvidia") return process.env.STT_MODEL || "nvidia/parakeet-ctc-1.1b-asr";
    return process.env.STT_MODEL || "whisper-1";
}

function resolveTTSBaseUrl(provider: string): string {
    if (provider === "chatterbox") return process.env.CHATTERBOX_URL || "http://localhost:8100";
    if (provider === "openai") return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    return process.env.TTS_BASE_URL || "https://api.openai.com/v1";
}

function resolveTTSApiKeyVar(provider: string): string {
    if (provider === "openai") return "OPENAI_API_KEY";
    return process.env.TTS_API_KEY ? "TTS_API_KEY" : "OPENAI_API_KEY";
}

function resolveTTSModel(provider: string): string {
    if (provider === "chatterbox") return "chatterbox";
    return process.env.TTS_MODEL || "tts-1";
}

// ─── Utility ─────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
