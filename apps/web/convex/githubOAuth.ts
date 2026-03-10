import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to resolve a session token → orgId.
 * Used by the GitHub OAuth callback to identify which org to store the token on.
 *
 * Falls back to user's defaultOrgId or first org membership if session
 * doesn't have orgId set (e.g. old sessions created before orgId tracking).
 */
export const resolveSession = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("userSessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) return null;

        // If session has orgId, use it directly
        let orgId = session.orgId;

        // Fallback: look up user's default org
        if (!orgId) {
            const user = await ctx.db.get(session.userId);
            orgId = (user as any)?.defaultOrgId;
        }

        // Fallback: look up first org membership
        if (!orgId) {
            const membership = await ctx.db
                .query("orgMembers")
                .withIndex("by_user", (q) => q.eq("userId", session.userId))
                .first();
            orgId = membership?.orgId;
        }

        return {
            userId: session.userId,
            orgId: orgId || null,
        };
    },
});
