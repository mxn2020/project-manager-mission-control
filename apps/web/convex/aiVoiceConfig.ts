import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Default Voice Models ────────────────────────────────────────────────

const DEFAULTS = [
    // ─── STT Models ──────────────────────────────────────────────────
    {
        name: "whisper-large-v3",
        displayName: "Whisper Large v3 (NVIDIA)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "openai",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh", "ar", "hi", "tr", "vi"],
        isDefault: true,
        config: JSON.stringify({ description: "OpenAI Whisper Large v3 hosted on NVIDIA — best multilingual accuracy" }),
    },
    {
        name: "parakeet-ctc-1.1b-asr",
        displayName: "Parakeet CTC 1.1B (English)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en"],
        isDefault: false,
        config: JSON.stringify({ description: "Record-setting accuracy for English. Requires gRPC proxy.", functionId: "1598d209-5e27-4d3c-8079-4751568b1081" }),
    },
    {
        name: "parakeet-ctc-0.6b-asr",
        displayName: "Parakeet CTC 0.6B (English)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en"],
        isDefault: false,
        config: JSON.stringify({ description: "Fast, accurate English transcription. Requires gRPC proxy." }),
    },
    {
        name: "parakeet-1.1b-rnnt-multilingual-asr",
        displayName: "Parakeet 1.1B Multilingual (25 langs)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh", "ar", "hi", "tr", "vi", "sv", "da", "no", "fi", "el", "cs", "hu", "ro", "uk"],
        isDefault: false,
        config: JSON.stringify({ description: "High accuracy across 25 languages. Requires gRPC proxy." }),
    },
    {
        name: "parakeet-ctc-0.6b-es",
        displayName: "Parakeet CTC 0.6B (Spanish)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["es", "en"],
        isDefault: false,
        config: JSON.stringify({ description: "Optimized Spanish-English transcription. Requires gRPC proxy." }),
    },
    {
        name: "parakeet-ctc-0.6b-zh-cn",
        displayName: "Parakeet CTC 0.6B (Mandarin CN)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["zh", "en"],
        isDefault: false,
        config: JSON.stringify({ description: "Mandarin-English transcription. Requires gRPC proxy." }),
    },
    {
        name: "parakeet-ctc-0.6b-zh-tw",
        displayName: "Parakeet CTC 0.6B (Mandarin TW)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["zh", "en"],
        isDefault: false,
        config: JSON.stringify({ description: "Mandarin Taiwanese-English transcription. Requires gRPC proxy." }),
    },
    {
        name: "parakeet-ctc-0.6b-vi",
        displayName: "Parakeet CTC 0.6B (Vietnamese)",
        provider: "nvidia",
        type: "stt",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["vi", "en"],
        isDefault: false,
        config: JSON.stringify({ description: "Vietnamese-English transcription. Requires gRPC proxy." }),
    },

    // ─── TTS Models ──────────────────────────────────────────────────
    {
        name: "magpie-tts-multilingual",
        displayName: "Magpie TTS Multilingual (NVIDIA)",
        provider: "nvidia",
        type: "tts",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"],
        isDefault: false,
        config: JSON.stringify({ description: "Natural multilingual voices. Requires gRPC proxy.", voices: ["Magpie-Multilingual.EN-US.Aria", "Magpie-Multilingual.EN-US.James"] }),
    },
    {
        name: "magpie-tts-zeroshot",
        displayName: "Magpie TTS Zero-Shot (Voice Cloning)",
        provider: "nvidia",
        type: "tts",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en"],
        isDefault: false,
        config: JSON.stringify({ description: "Voice cloning from a short audio sample. Requires gRPC proxy.", supportsVoiceCloning: true }),
    },
    {
        name: "magpie-tts-flow",
        displayName: "Magpie TTS Flow (Expressive)",
        provider: "nvidia",
        type: "tts",
        apiFormat: "riva-grpc",
        baseUrl: "grpc.nvcf.nvidia.com:443",
        apiKeyEnvVar: "NVIDIA_API_KEY",
        languages: ["en"],
        isDefault: false,
        config: JSON.stringify({ description: "Expressive TTS with flow matching. Requires gRPC proxy.", supportsVoiceCloning: true }),
    },
    {
        name: "chatterbox",
        displayName: "Chatterbox (Local)",
        provider: "chatterbox",
        type: "tts",
        apiFormat: "chatterbox-local",
        baseUrl: "http://localhost:8100",
        languages: ["en"],
        isDefault: true,
        config: JSON.stringify({ description: "SoTA open-source TTS by Resemble AI. Runs locally with GPU.", supportsVoiceCloning: true }),
    },
    {
        name: "chatterbox-turbo",
        displayName: "Chatterbox Turbo (Local)",
        provider: "chatterbox",
        type: "tts",
        apiFormat: "chatterbox-local",
        baseUrl: "http://localhost:8100",
        languages: ["en"],
        isDefault: false,
        config: JSON.stringify({ description: "Faster Chatterbox with paralinguistic tags. Runs locally.", supportsVoiceCloning: true }),
    },
    {
        name: "chatterbox-multilingual",
        displayName: "Chatterbox Multilingual (Local)",
        provider: "chatterbox",
        type: "tts",
        apiFormat: "chatterbox-local",
        baseUrl: "http://localhost:8100",
        languages: ["en", "ar", "da", "de", "el", "es", "fi", "fr", "he", "hi", "it", "ja", "ko", "ms", "nl", "no", "pl", "pt", "ru", "sv", "sw", "tr", "zh"],
        isDefault: false,
        config: JSON.stringify({ description: "Multilingual Chatterbox supporting 23 languages. Runs locally.", supportsVoiceCloning: true }),
    },
];

// ─── Queries ─────────────────────────────────────────────────────────────

export const listVoiceModels = query({
    args: {
        type: v.optional(v.string()),       // "stt" | "tts"
        provider: v.optional(v.string()),   // "nvidia" | "chatterbox" | "openai"
    },
    handler: async (ctx, args) => {
        let models = await ctx.db.query("voiceModels").collect();

        if (models.length === 0) {
            // Return built-in defaults
            return DEFAULTS
                .filter(m => !args.type || m.type === args.type)
                .filter(m => !args.provider || m.provider === args.provider)
                .map((m, i) => ({
                    _id: `builtin_${i}` as any,
                    ...m,
                    isBuiltIn: true,
                    createdAt: Date.now(),
                }));
        }

        if (args.type) models = models.filter(m => m.type === args.type);
        if (args.provider) models = models.filter(m => m.provider === args.provider);

        return models.map(m => ({ ...m, isBuiltIn: false }));
    },
});

export const getDefaultSTT = query({
    args: {},
    handler: async (ctx) => {
        const models = await ctx.db.query("voiceModels").withIndex("by_type", q => q.eq("type", "stt")).collect();
        if (models.length === 0) {
            return DEFAULTS.find(m => m.type === "stt" && m.isDefault) || DEFAULTS.find(m => m.type === "stt") || null;
        }
        return models.find(m => m.isDefault && m.isEnabled) || models.find(m => m.isEnabled) || null;
    },
});

export const getDefaultTTS = query({
    args: {},
    handler: async (ctx) => {
        const models = await ctx.db.query("voiceModels").withIndex("by_type", q => q.eq("type", "tts")).collect();
        if (models.length === 0) {
            return DEFAULTS.find(m => m.type === "tts" && m.isDefault) || DEFAULTS.find(m => m.type === "tts") || null;
        }
        return models.find(m => m.isDefault && m.isEnabled) || models.find(m => m.isEnabled) || null;
    },
});

// ─── Mutations ───────────────────────────────────────────────────────────

export const seedDefaults = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("voiceModels").collect();
        if (existing.length > 0) return { seeded: 0, message: "Voice models already exist" };

        const now = Date.now();
        let seeded = 0;
        for (const m of DEFAULTS) {
            await ctx.db.insert("voiceModels", { ...m, isEnabled: true, orgId: undefined, createdAt: now });
            seeded++;
        }
        return { seeded, message: `Seeded ${seeded} voice models` };
    },
});

export const upsertVoiceModel = mutation({
    args: {
        id: v.optional(v.id("voiceModels")),
        name: v.string(),
        displayName: v.string(),
        provider: v.string(),
        type: v.string(),
        apiFormat: v.string(),
        baseUrl: v.string(),
        apiKeyEnvVar: v.optional(v.string()),
        languages: v.array(v.string()),
        isEnabled: v.boolean(),
        isDefault: v.boolean(),
        config: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // If setting as default, unset others of same type
        if (args.isDefault) {
            const others = await ctx.db.query("voiceModels").withIndex("by_type", q => q.eq("type", args.type)).collect();
            for (const o of others) {
                if (o.isDefault && o._id !== args.id) {
                    await ctx.db.patch(o._id, { isDefault: false });
                }
            }
        }

        if (args.id) {
            const { id, ...fields } = args;
            await ctx.db.patch(id, fields);
            return id;
        }

        return await ctx.db.insert("voiceModels", {
            ...args,
            id: undefined,
            orgId: undefined,
            createdAt: now,
        } as any);
    },
});

export const toggleVoiceModel = mutation({
    args: { id: v.id("voiceModels"), isEnabled: v.boolean() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isEnabled: args.isEnabled });
    },
});

export const deleteVoiceModel = mutation({
    args: { id: v.id("voiceModels") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
