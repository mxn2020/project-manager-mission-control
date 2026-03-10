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

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Register ─────────────────────────────────────────────────────────────

export const register = mutation({
    args: {
        email: v.string(),
        name: v.string(),
        password: v.string(),
        orgName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const email = args.email.toLowerCase().trim();

        // Check if email already exists
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();
        if (existingUser) {
            throw new Error("An account with this email already exists.");
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

        // Create default organization
        const orgName = args.orgName || `${args.name.trim()}'s Workspace`;
        let slug = generateSlug(orgName);

        // Ensure slug uniqueness
        const existingOrg = await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();
        if (existingOrg) {
            slug = `${slug}-${Date.now().toString(36)}`;
        }

        const orgId = await ctx.db.insert("organizations", {
            name: orgName,
            slug,
            ownerId: userId,
            planTier: "free",
            createdAt: Date.now(),
        });

        // Add user as owner of org
        await ctx.db.insert("orgMembers", {
            orgId,
            userId,
            role: "owner",
            joinedAt: Date.now(),
        });

        // Set default org
        await ctx.db.patch(userId, { defaultOrgId: orgId });

        // Create session
        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId,
            token,
            orgId,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId, orgId };
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

        // Get default org or first org
        let orgId = user.defaultOrgId;
        if (!orgId) {
            const memberships = await ctx.db
                .query("orgMembers")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .first();
            orgId = memberships?.orgId;
        }

        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId: user._id,
            token,
            orgId,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId: user._id, orgId };
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

        // Get org info
        let org = null;
        const orgId = session.orgId || user.defaultOrgId;
        if (orgId) {
            org = await ctx.db.get(orgId);
        }

        return {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: orgId || undefined,
            orgName: org?.name || undefined,
            orgSlug: org?.slug || undefined,
        };
    },
});

// ─── Switch Organization ──────────────────────────────────────────────────

export const switchOrg = mutation({
    args: {
        token: v.string(),
        orgId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("userSessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        if (!session) throw new Error("Invalid session");

        // Verify user is member of org
        const membership = await ctx.db
            .query("orgMembers")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .collect();
        if (!membership.some((m) => m.userId === session.userId)) {
            throw new Error("Not a member of this organization");
        }

        // Update session and default org
        await ctx.db.patch(session._id, { orgId: args.orgId });
        await ctx.db.patch(session.userId, { defaultOrgId: args.orgId });

        return { orgId: args.orgId };
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
        const expectedSecret = process.env.AGENT_SECRET;
        if (!expectedSecret) {
            throw new Error("AGENT_SECRET environment variable not configured.");
        }
        if (args.agentSecret !== expectedSecret) {
            throw new Error("Invalid agent secret.");
        }

        const user = await ctx.db.query("users").first();
        if (!user) {
            throw new Error("No admin user found.");
        }

        // Get default org
        let orgId = user.defaultOrgId;
        if (!orgId) {
            const membership = await ctx.db
                .query("orgMembers")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .first();
            orgId = membership?.orgId;
        }

        const token = generateToken();
        await ctx.db.insert("userSessions", {
            userId: user._id,
            token,
            orgId,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            createdAt: Date.now(),
        });

        return { token, userId: user._id, orgId };
    },
});
