import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── List Wiki Articles ──────────────────────────────────────────────────

export const list = query({
    args: {
        orgId: v.id("organizations"),
        category: v.optional(v.string()),
        scope: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let articles = await ctx.db
            .query("wikiArticles")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        if (args.category) {
            articles = articles.filter((a) => a.category === args.category);
        }
        if (args.scope) {
            articles = articles.filter((a) => a.scope === args.scope);
        }
        return articles.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

export const get = query({
    args: { articleId: v.id("wikiArticles") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.articleId);
    },
});

// ─── Create Wiki Article ─────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        title: v.string(),
        body: v.optional(v.string()),
        category: v.optional(v.string()),
        scope: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        relatedArticles: v.optional(v.array(v.string())),
        linkedProjects: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("wikiArticles", {
            orgId: args.orgId,
            title: args.title,
            body: args.body || "",
            category: args.category || "reference",
            scope: args.scope || "general",
            tags: args.tags || [],
            relatedArticles: args.relatedArticles || [],
            linkedProjects: args.linkedProjects || [],
            status: "active",
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Wiki Article ─────────────────────────────────────────────────

export const update = mutation({
    args: {
        articleId: v.id("wikiArticles"),
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        category: v.optional(v.string()),
        scope: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        relatedArticles: v.optional(v.array(v.string())),
        linkedProjects: v.optional(v.array(v.string())),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { articleId, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(articleId, clean);
        return articleId;
    },
});

// ─── Delete Wiki Article ─────────────────────────────────────────────────

export const remove = mutation({
    args: { articleId: v.id("wikiArticles") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.articleId);
    },
});
