import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Create Organization ─────────────────────────────────────────────────

export const create = mutation({
    args: {
        name: v.string(),
        slug: v.string(),
        ownerId: v.id("users"),
        planTier: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check slug uniqueness
        const existing = await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();
        if (existing) {
            throw new Error(`Organization slug "${args.slug}" is already taken.`);
        }

        const orgId = await ctx.db.insert("organizations", {
            name: args.name,
            slug: args.slug,
            ownerId: args.ownerId,
            planTier: args.planTier || "free",
            createdAt: Date.now(),
        });

        // Add owner as member
        await ctx.db.insert("orgMembers", {
            orgId,
            userId: args.ownerId,
            role: "owner",
            joinedAt: Date.now(),
        });

        // Set as default org for user
        await ctx.db.patch(args.ownerId, { defaultOrgId: orgId });

        return orgId;
    },
});

// ─── List User's Organizations ───────────────────────────────────────────

export const listByUser = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const memberships = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        const orgs = [];
        for (const m of memberships) {
            const org = await ctx.db.get(m.orgId);
            if (org) {
                orgs.push({ ...org, memberRole: m.role });
            }
        }
        return orgs;
    },
});

// ─── Get Organization ────────────────────────────────────────────────────

export const get = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.orgId);
    },
});

export const getBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();
    },
});

// ─── Update Organization ─────────────────────────────────────────────────

export const update = mutation({
    args: {
        orgId: v.id("organizations"),
        name: v.optional(v.string()),
        planTier: v.optional(v.string()),
        settings: v.optional(v.string()),
        githubToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { orgId, ...updates } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(orgId, clean);
        return orgId;
    },
});

// ─── Members ─────────────────────────────────────────────────────────────

export const listMembers = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .collect();

        const result = [];
        for (const m of members) {
            const user = await ctx.db.get(m.userId);
            if (user) {
                result.push({
                    memberId: m._id,
                    userId: user._id,
                    email: user.email,
                    name: user.name,
                    role: m.role,
                    joinedAt: m.joinedAt,
                });
            }
        }
        return result;
    },
});

export const addMember = mutation({
    args: {
        orgId: v.id("organizations"),
        userId: v.id("users"),
        role: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if already a member
        const existing = await ctx.db
            .query("orgMembers")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .collect();

        if (existing.some((m) => m.userId === args.userId)) {
            throw new Error("User is already a member of this organization.");
        }

        return await ctx.db.insert("orgMembers", {
            orgId: args.orgId,
            userId: args.userId,
            role: args.role || "member",
            joinedAt: Date.now(),
        });
    },
});

export const removeMember = mutation({
    args: { memberId: v.id("orgMembers") },
    handler: async (ctx, args) => {
        const member = await ctx.db.get(args.memberId);
        if (!member) throw new Error("Member not found");
        if (member.role === "owner") throw new Error("Cannot remove the owner");
        await ctx.db.delete(args.memberId);
    },
});

export const updateMemberRole = mutation({
    args: {
        memberId: v.id("orgMembers"),
        role: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.memberId, { role: args.role });
    },
});
