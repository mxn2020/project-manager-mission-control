import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Seed Organization + Admin User ──────────────────────────────────────

export const seedOrg = mutation({
    args: {
        orgName: v.string(),
        orgSlug: v.string(),
        adminEmail: v.string(),
        adminName: v.string(),
        adminPasswordHash: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Check if org already exists
        const existingOrg = await ctx.db
            .query("organizations")
            .withIndex("by_slug", (idx) => idx.eq("slug", args.orgSlug))
            .unique();
        if (existingOrg) {
            // Find user
            const user = await ctx.db
                .query("users")
                .withIndex("by_email", (idx) => idx.eq("email", args.adminEmail))
                .unique();
            return { orgId: existingOrg._id, userId: user?._id };
        }

        // Create admin user
        const userId = await ctx.db.insert("users", {
            email: args.adminEmail,
            name: args.adminName,
            passwordHash: args.adminPasswordHash,
            role: "admin",
            createdAt: now,
        });

        // Create organization
        const orgId = await ctx.db.insert("organizations", {
            name: args.orgName,
            slug: args.orgSlug,
            ownerId: userId,
            planTier: "pro",
            createdAt: now,
        });

        // Set default org on user
        await ctx.db.patch(userId, { defaultOrgId: orgId });

        // Create org membership
        await ctx.db.insert("orgMembers", {
            orgId,
            userId,
            role: "owner",
            joinedAt: now,
        });

        return { orgId, userId };
    },
});

// ─── Bulk Import Projects ────────────────────────────────────────────────

export const bulkImportProjects = mutation({
    args: {
        orgId: v.id("organizations"),
        projects: v.array(
            v.object({
                name: v.string(),
                description: v.optional(v.string()),
                tier: v.string(),
                lane: v.string(),
                priority: v.string(),
                oss: v.boolean(),
                stack: v.array(v.string()),
                repo: v.optional(v.string()),
                deployUrl: v.optional(v.string()),
                tags: v.array(v.string()),
                notes: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Get existing projects to avoid duplicates
        const existing = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

        let created = 0;
        let skipped = 0;

        for (const p of args.projects) {
            if (existingNames.has(p.name.toLowerCase())) {
                skipped++;
                continue;
            }
            await ctx.db.insert("projects", {
                orgId: args.orgId,
                name: p.name,
                description: p.description || "",
                tier: p.tier || "idea",
                lane: p.lane || "uncategorized",
                priority: p.priority || "medium",
                oss: p.oss || false,
                stack: p.stack || [],
                repo: p.repo || undefined,
                deployUrl: p.deployUrl || undefined,
                lastActive: now,
                tags: p.tags || [],
                notes: p.notes || undefined,
                healthScore: 0,
                syncStatus: "synced",
                lastSyncedAt: now,
                createdAt: now,
                updatedAt: now,
            });
            created++;
        }

        return { created, skipped };
    },
});
