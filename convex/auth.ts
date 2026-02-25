import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Helpers ──────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, "0") + str.length.toString(16);
}

function generateToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 48; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Register (first-time setup) ──────────────────────────────────────────

export const register = mutation({
    args: {
        email: v.string(),
        name: v.string(),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const email = args.email.toLowerCase().trim();

        // Only allow 1 user (single-user app)
        const userCount = await ctx.db.query("users").collect();
        if (userCount.length > 0) {
            throw new Error("Registration is disabled. Only one user is allowed.");
        }

        if (args.password.length < 6) {
            throw new Error("Password must be at least 6 characters.");
        }

        const passwordHash = simpleHash(args.password);
        const userId = await ctx.db.insert("users", {
            email,
            name: args.name.trim(),
            passwordHash,
            role: "admin",
            createdAt: Date.now(),
        });

        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId,
            token,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId };
    },
});

// ─── Login ────────────────────────────────────────────────────────────────

export const login = mutation({
    args: {
        email: v.string(),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const email = args.email.toLowerCase().trim();
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();

        if (!user) throw new Error("Invalid email or password.");

        const passwordHash = simpleHash(args.password);
        if (user.passwordHash !== passwordHash) {
            throw new Error("Invalid email or password.");
        }

        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId: user._id,
            token,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId: user._id };
    },
});

// ─── Logout ───────────────────────────────────────────────────────────────

export const logout = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("userSessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        if (session) {
            await ctx.db.delete(session._id);
        }
    },
});

// ─── Current User ─────────────────────────────────────────────────────────

export const me = query({
    args: { token: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.token) return null;

        const session = await ctx.db
            .query("userSessions")
            .withIndex("by_token", (q) => q.eq("token", args.token!))
            .first();

        if (!session || session.expiresAt < Date.now()) return null;

        const user = await ctx.db.get(session.userId);
        if (!user) return null;

        return {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    },
});

// ─── Check if setup is needed ─────────────────────────────────────────────

export const needsSetup = query({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();
        return users.length === 0;
    },
});

// ─── Agent Login (programmatic access via shared secret) ──────────────────

export const agentLogin = mutation({
    args: { agentSecret: v.string() },
    handler: async (ctx, args) => {
        // Validate against env var
        const expectedSecret = process.env.MC_AGENT_SECRET;
        if (!expectedSecret) {
            throw new Error("Agent access not configured.");
        }
        if (args.agentSecret !== expectedSecret) {
            throw new Error("Invalid agent secret.");
        }

        // Find the admin user (first user)
        const user = await ctx.db.query("users").first();
        if (!user) {
            throw new Error("No admin user found.");
        }

        // Create session (shorter TTL: 24h for agent sessions)
        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId: user._id,
            token,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            createdAt: Date.now(),
        });

        return { token, userId: user._id };
    },
});

