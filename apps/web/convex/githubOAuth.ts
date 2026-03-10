import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to resolve a session token → orgId.
 * Used by the GitHub OAuth callback to identify which org to store the token on.
 */
export const resolveSession = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("userSessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) return null;

        return {
            userId: session.userId,
            orgId: session.orgId,
        };
    },
});
