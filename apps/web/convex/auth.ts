import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Convex environment variables (set via `npx convex env set`)
declare const process: { env: Record<string, string | undefined> };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function hashPassword(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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

        const passwordHash = await hashPassword(args.password);
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

        const passwordHash = await hashPassword(args.password);
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
        // Agent secret is read from Convex environment variable.
        // Set via: npx convex env set AGENT_SECRET <your-secret>
        const expectedSecret = process.env.AGENT_SECRET;
        if (!expectedSecret) {
            throw new Error("AGENT_SECRET environment variable not configured.");
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

