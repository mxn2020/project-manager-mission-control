import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Types ───────────────────────────────────────────────────────────────

interface Tactic {
    id: string;
    platform: string;
    contentType: string;
    tone: string;
    description: string;
    example: string;
    frequency: string; // "daily" | "2x-week" | "weekly" | etc.
}

// ─── List Strategies ─────────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const strategies = await ctx.db
            .query("marketingStrategies")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return strategies.map((s) => ({
            ...s,
            tactics: safeParseJson<Tactic[]>(s.tactics, []),
        }));
    },
});

export const listByCategory = query({
    args: { projectCategory: v.string() },
    handler: async (ctx, args) => {
        const strategies = await ctx.db
            .query("marketingStrategies")
            .withIndex("by_category", (idx) => idx.eq("projectCategory", args.projectCategory))
            .collect();
        return strategies.map((s) => ({
            ...s,
            tactics: safeParseJson<Tactic[]>(s.tactics, []),
        }));
    },
});

export const get = query({
    args: { strategyId: v.id("marketingStrategies") },
    handler: async (ctx, args) => {
        const s = await ctx.db.get(args.strategyId);
        if (!s) return null;
        return { ...s, tactics: safeParseJson<Tactic[]>(s.tactics, []) };
    },
});

// ─── Create Strategy ─────────────────────────────────────────────────────

export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        projectCategory: v.string(),
        targetAudience: v.optional(v.string()),
        channels: v.array(v.string()),
        contentTypes: v.array(v.string()),
        cadence: v.string(),
        tactics: v.optional(v.array(v.any())),
        isTemplate: v.optional(v.boolean()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("marketingStrategies", {
            orgId: args.orgId,
            name: args.name,
            description: args.description || "",
            projectCategory: args.projectCategory,
            targetAudience: args.targetAudience || "",
            channels: args.channels,
            contentTypes: args.contentTypes,
            cadence: args.cadence,
            tactics: JSON.stringify(args.tactics || []),
            isTemplate: args.isTemplate ?? true,
            tags: args.tags || [],
            status: "active",
            createdAt: now,
            updatedAt: now,
        });
    },
});

// ─── Update Strategy ─────────────────────────────────────────────────────

export const update = mutation({
    args: {
        strategyId: v.id("marketingStrategies"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        projectCategory: v.optional(v.string()),
        targetAudience: v.optional(v.string()),
        channels: v.optional(v.array(v.string())),
        contentTypes: v.optional(v.array(v.string())),
        cadence: v.optional(v.string()),
        tactics: v.optional(v.array(v.any())),
        isTemplate: v.optional(v.boolean()),
        tags: v.optional(v.array(v.string())),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { strategyId, tactics, ...rest } = args;
        const clean: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(rest)) {
            if (val !== undefined) clean[k] = val;
        }
        if (tactics !== undefined) clean.tactics = JSON.stringify(tactics);
        await ctx.db.patch(strategyId, clean);
        return strategyId;
    },
});

// ─── Delete Strategy ─────────────────────────────────────────────────────

export const remove = mutation({
    args: { strategyId: v.id("marketingStrategies") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.strategyId);
    },
});

// ─── Create Strategy from Idea ───────────────────────────────────────────

export const createFromIdea = mutation({
    args: {
        ideaId: v.id("ideas"),
        orgId: v.id("organizations"),
        projectCategory: v.optional(v.string()),
        channels: v.optional(v.array(v.string())),
        contentTypes: v.optional(v.array(v.string())),
        cadence: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const idea = await ctx.db.get(args.ideaId);
        if (!idea) throw new Error("Idea not found");

        const now = Date.now();
        const strategyId = await ctx.db.insert("marketingStrategies", {
            orgId: args.orgId,
            name: `Strategy: ${idea.title}`,
            description: idea.body || `Marketing strategy based on idea: ${idea.title}`,
            projectCategory: args.projectCategory || "webapp",
            targetAudience: "",
            channels: args.channels || ["x", "reddit"],
            contentTypes: args.contentTypes || ["post", "article"],
            cadence: args.cadence || "weekly",
            tactics: JSON.stringify([]),
            isTemplate: false,
            tags: idea.tags || [],
            status: "active",
            createdAt: now,
            updatedAt: now,
        });

        // Mark idea as promoted to strategy
        await ctx.db.patch(args.ideaId, {
            promotedTo: "strategy",
            promotedEntityId: strategyId,
            updatedAt: now,
        });

        return { strategyId, ideaId: args.ideaId };
    },
});

// ─── Seed Default Strategies ─────────────────────────────────────────────

export const seedDefaults = mutation({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        // Check if already seeded
        const existing = await ctx.db
            .query("marketingStrategies")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .first();
        if (existing) return { seeded: false, message: "Strategies already exist" };

        const now = Date.now();
        const strategies = getDefaultStrategies();

        for (const s of strategies) {
            await ctx.db.insert("marketingStrategies", {
                orgId: args.orgId,
                name: s.name,
                description: s.description,
                projectCategory: s.projectCategory,
                targetAudience: s.targetAudience,
                channels: s.channels,
                contentTypes: s.contentTypes,
                cadence: s.cadence,
                tactics: JSON.stringify(s.tactics),
                isTemplate: true,
                tags: s.tags,
                status: "active",
                createdAt: now,
                updatedAt: now,
            });
        }
        return { seeded: true, count: strategies.length };
    },
});

// ─── Default Strategy Definitions ────────────────────────────────────────

interface StrategyDef {
    name: string;
    description: string;
    projectCategory: string;
    targetAudience: string;
    channels: string[];
    contentTypes: string[];
    cadence: string;
    tactics: Tactic[];
    tags: string[];
}

function getDefaultStrategies(): StrategyDef[] {
    return [
        // ── 1. AI-Powered Apps ─────────────────────────────────────────
        {
            name: "AI App — Viral TikTok + Social",
            description: "Zero-budget growth for AI-powered apps. Controversy-driven TikTok slideshows, motivational content, and organic social posts.",
            projectCategory: "webapp",
            targetAudience: "Tech-savvy users, early adopters, indie hackers",
            channels: ["tiktok", "x", "reddit"],
            contentTypes: ["slideshow", "video", "post"],
            cadence: "2x-week",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "slideshow", tone: "controversy", description: "Carousel with controversy hook — \"Nobody believed in me but this app changed everything\"", example: "5 slides: Hook → Problem → Discovery → Transformation → CTA", frequency: "weekly" },
                { id: "t2", platform: "tiktok", contentType: "video", tone: "controversy", description: "Talking-head or screen-record with controversial opinion about AI tools", example: "\"This free AI tool replaces $500/mo subscriptions\" — screen recording demo", frequency: "weekly" },
                { id: "t3", platform: "tiktok", contentType: "video", tone: "motivational", description: "Motivational builder narrative — building in public style", example: "\"Day 47 of building an AI app that does X\" with progress montage", frequency: "biweekly" },
                { id: "t4", platform: "x", contentType: "post", tone: "educational", description: "X thread or post about the app, lessons learned, or technical insight", example: "\"I built X in Y days. Here's what I learned\" — thread with screenshots", frequency: "2x-week" },
                { id: "t5", platform: "reddit", contentType: "post", tone: "storytelling", description: "Reddit post sharing journey or tool in relevant subreddits", example: "r/SideProject or r/EntrepreneurRideAlong — \"How I built X to solve Y\"", frequency: "weekly" },
            ],
            tags: ["ai", "growth", "viral"],
        },

        // ── 2. OSS with Managed Service ────────────────────────────────
        {
            name: "OSS — Community + Content Marketing",
            description: "Build community around open-source project. Free OSS + paid managed service. Blog, social, and developer-focused content.",
            projectCategory: "oss-tool",
            targetAudience: "Developers, DevOps engineers, technical decision makers",
            channels: ["tiktok", "x", "reddit", "blog", "medium"],
            contentTypes: ["slideshow", "video", "post", "article"],
            cadence: "2x-week",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "slideshow", tone: "educational", description: "Before/after slideshow showing the problem the OSS tool solves", example: "\"Your code before vs after using [tool]\" — visual diff", frequency: "weekly" },
                { id: "t2", platform: "tiktok", contentType: "video", tone: "educational", description: "Quick demo or tutorial — how to set up the tool in 60 seconds", example: "Screen recording: install → configure → run → result", frequency: "biweekly" },
                { id: "t3", platform: "x", contentType: "post", tone: "educational", description: "Build-in-public updates, feature announcements, technical threads", example: "\"Just shipped v2.1 of [tool]: now supports X, Y, Z\" + GIF demo", frequency: "2x-week" },
                { id: "t4", platform: "x", contentType: "article", tone: "educational", description: "Long-form X article about architecture decisions or comparisons", example: "\"Why we chose X over Y for our open-source Z\"", frequency: "monthly" },
                { id: "t5", platform: "reddit", contentType: "post", tone: "how-to", description: "\"How I solved X\" posts in technical subreddits", example: "r/programming or r/selfhosted — \"How I solved [problem] with my OSS tool\"", frequency: "weekly" },
                { id: "t6", platform: "blog", contentType: "article", tone: "educational", description: "Blog post on the project website — tutorials, deep dives, announcements", example: "\"Getting Started with [tool]\", \"Advanced Config Guide\"", frequency: "biweekly" },
                { id: "t7", platform: "medium", contentType: "article", tone: "storytelling", description: "Medium articles via multiple accounts for broader reach", example: "\"I built an open-source alternative to X\" — personal journey story", frequency: "biweekly" },
            ],
            tags: ["oss", "community", "developer"],
        },

        // ── 3. Boilerplate / Template Projects ─────────────────────────
        {
            name: "Boilerplate — Developer Marketing",
            description: "Market React/SolidJS boilerplates through dev content, tutorials, and live builds. Multi-platform coverage including YouTube.",
            projectCategory: "boilerplate",
            targetAudience: "Frontend developers, indie hackers, startup CTOs",
            channels: ["tiktok", "youtube", "x", "reddit", "blog", "medium"],
            contentTypes: ["slideshow", "video", "vlog", "post", "article"],
            cadence: "2x-week",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "slideshow", tone: "educational", description: "\"Start your next project in 30 seconds\" — setup speed demo", example: "Slides: npx create → configure → run → beautiful UI in seconds", frequency: "weekly" },
                { id: "t2", platform: "tiktok", contentType: "video", tone: "controversy", description: "\"Stop building from scratch\" — opinionated dev takes", example: "\"Every dev who starts from create-react-app is wasting 40 hours\"", frequency: "biweekly" },
                { id: "t3", platform: "youtube", contentType: "video", tone: "educational", description: "Full tutorial: building a feature using the boilerplate", example: "\"Build a SaaS in 2 hours with this boilerplate\" — long-form tutorial", frequency: "biweekly" },
                { id: "t4", platform: "youtube", contentType: "vlog", tone: "storytelling", description: "Dev vlog — building and shipping with the boilerplate", example: "\"Watch me build and ship a product in one weekend\"", frequency: "monthly" },
                { id: "t5", platform: "x", contentType: "post", tone: "educational", description: "Feature highlights, tips, and build-in-public updates", example: "\"New in geenius-boilerplate: auth, i18n, dark mode — all pre-configured 🚀\"", frequency: "2x-week" },
                { id: "t6", platform: "x", contentType: "article", tone: "educational", description: "Long-form comparison or architecture article", example: "\"Why I built my own boilerplate instead of using Next.js starter\"", frequency: "monthly" },
                { id: "t7", platform: "reddit", contentType: "post", tone: "how-to", description: "Show & Tell posts in developer subreddits", example: "r/reactjs — \"I made a production-ready React boilerplate with X, Y, Z\"", frequency: "weekly" },
                { id: "t8", platform: "blog", contentType: "article", tone: "educational", description: "Blog posts on the boilerplate website", example: "\"The complete guide to our boilerplate architecture\"", frequency: "biweekly" },
                { id: "t9", platform: "medium", contentType: "article", tone: "storytelling", description: "Medium articles for broader developer audience", example: "\"Why every indie hacker needs a boilerplate\" — opinion piece", frequency: "biweekly" },
            ],
            tags: ["boilerplate", "developer", "tutorial"],
        },

        // ── 4. Consumer-Facing App ─────────────────────────────────────
        {
            name: "Consumer App — Viral Growth",
            description: "Consumer-facing app growth through TikTok virality, social proof, and blog SEO. Controversy hooks + motivational content.",
            projectCategory: "fullstack-app",
            targetAudience: "General consumers, productivity enthusiasts, self-improvement",
            channels: ["tiktok", "x", "reddit", "blog"],
            contentTypes: ["slideshow", "video", "post", "article"],
            cadence: "2x-week",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "slideshow", tone: "controversy", description: "\"Nobody believed me\" narrative with app transformation", example: "5 slides: skepticism → trying app → results → mind blown → download CTA", frequency: "weekly" },
                { id: "t2", platform: "tiktok", contentType: "video", tone: "controversy", description: "Hot takes and contrarian views about the problem space", example: "\"Everyone is doing X wrong. Here's why.\" — then show app solution", frequency: "weekly" },
                { id: "t3", platform: "tiktok", contentType: "video", tone: "motivational", description: "User success stories and motivational transformation clips", example: "\"30 days using this app changed my X\" — before/after montage", frequency: "biweekly" },
                { id: "t4", platform: "x", contentType: "post", tone: "educational", description: "Feature announcements, user stories, tips & tricks", example: "\"Hidden feature in [app]: did you know you can X?\" + screenshot", frequency: "2x-week" },
                { id: "t5", platform: "x", contentType: "article", tone: "educational", description: "In-depth articles about the space/problem the app solves", example: "\"The state of X in 2025 — and what we're doing about it\"", frequency: "monthly" },
                { id: "t6", platform: "reddit", contentType: "post", tone: "how-to", description: "Problem-solution posts in relevant subreddits", example: "\"How I solved [pain point] — built an app for it\"", frequency: "weekly" },
                { id: "t7", platform: "blog", contentType: "article", tone: "educational", description: "SEO-optimized blog posts on the app website", example: "\"10 ways to improve X\" — with app as solution", frequency: "biweekly" },
            ],
            tags: ["consumer", "growth", "viral"],
        },

        // ── 5. Reseller / White-Label ──────────────────────────────────
        {
            name: "Reseller — B2B Prospecting + Content",
            description: "White-label/reseller app marketing with AI-driven prospecting workflow. Social proof + business-focused content.",
            projectCategory: "monorepo-app",
            targetAudience: "Agencies, resellers, B2B SaaS buyers, white-label seekers",
            channels: ["tiktok", "x", "reddit", "blog"],
            contentTypes: ["slideshow", "video", "post", "article"],
            cadence: "weekly",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "slideshow", tone: "controversy", description: "\"I started a SaaS business with $0\" controversy hook", example: "Slides: idea → white-label setup → first customer → revenue proof", frequency: "weekly" },
                { id: "t2", platform: "tiktok", contentType: "video", tone: "controversy", description: "\"You don't need to code to run a SaaS\" contrarian B2B takes", example: "Screen recording: setting up a white-label instance → customizing → selling", frequency: "biweekly" },
                { id: "t3", platform: "tiktok", contentType: "video", tone: "motivational", description: "Reseller success stories and revenue milestones", example: "\"From 0 to $5K MRR with white-label\" — milestone celebration", frequency: "biweekly" },
                { id: "t4", platform: "x", contentType: "post", tone: "educational", description: "B2B insights, pricing strategies, reseller tips", example: "\"How to price your white-label SaaS: a framework\" — thread", frequency: "2x-week" },
                { id: "t5", platform: "reddit", contentType: "post", tone: "how-to", description: "Business-focused posts in startup/SaaS subreddits", example: "r/SaaS — \"How I found my first 10 reseller customers\"", frequency: "weekly" },
                { id: "t6", platform: "blog", contentType: "article", tone: "educational", description: "Blog posts on the reseller platform website", example: "\"Complete guide to starting a white-label SaaS business\"", frequency: "biweekly" },
            ],
            tags: ["b2b", "reseller", "white-label"],
        },

        // ── 6. Library / Package ───────────────────────────────────────
        {
            name: "Library — Developer Evangelism",
            description: "Developer-focused content marketing for npm/pip libraries. Technical depth + community engagement.",
            projectCategory: "library",
            targetAudience: "Developers, package consumers, open-source contributors",
            channels: ["x", "reddit", "blog"],
            contentTypes: ["post", "article", "thread"],
            cadence: "weekly",
            tactics: [
                { id: "t1", platform: "x", contentType: "thread", tone: "educational", description: "Technical deep-dive threads about library features", example: "\"5 things you didn't know about [library]\" — thread with code snippets", frequency: "weekly" },
                { id: "t2", platform: "reddit", contentType: "post", tone: "how-to", description: "Show HN / Show Reddit style posts", example: "r/javascript — \"I built a library that does X in Y lines of code\"", frequency: "biweekly" },
                { id: "t3", platform: "blog", contentType: "article", tone: "educational", description: "Documentation-style blog posts with examples", example: "\"Migration guide: moving from [competitor] to [library]\"", frequency: "monthly" },
            ],
            tags: ["library", "developer", "npm"],
        },

        // ── 7. UI Package ──────────────────────────────────────────────
        {
            name: "UI Package — Visual Showcase",
            description: "Visual-first marketing for UI component libraries. Demo videos, comparison posts, and design-focused content.",
            projectCategory: "ui-package",
            targetAudience: "Frontend developers, UI/UX designers, design system teams",
            channels: ["tiktok", "x", "reddit", "blog"],
            contentTypes: ["video", "slideshow", "post", "article"],
            cadence: "weekly",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "video", tone: "educational", description: "30-second component showcase — satisfying UI animations", example: "Screen recording: import component → render → beautiful result", frequency: "weekly" },
                { id: "t2", platform: "x", contentType: "post", tone: "educational", description: "Component demos with GIFs, before/after comparisons", example: "\"New component: [Name] — see it in action 👇\" + GIF", frequency: "2x-week" },
                { id: "t3", platform: "reddit", contentType: "post", tone: "how-to", description: "Posts in UI/design subreddits with visual demos", example: "r/reactjs — \"I built a component library with 50+ components\"", frequency: "biweekly" },
                { id: "t4", platform: "blog", contentType: "article", tone: "educational", description: "Design system documentation and guides", example: "\"Building accessible components with [library]\"", frequency: "monthly" },
            ],
            tags: ["ui", "components", "design"],
        },

        // ── 8. Backend Service ──────────────────────────────────────────
        {
            name: "Backend Service — Technical Authority",
            description: "Establish technical authority for backend services through deep technical content and architecture discussions.",
            projectCategory: "backend-service",
            targetAudience: "Backend developers, DevOps, system architects",
            channels: ["x", "reddit", "blog"],
            contentTypes: ["post", "article", "thread"],
            cadence: "weekly",
            tactics: [
                { id: "t1", platform: "x", contentType: "thread", tone: "educational", description: "Architecture decision threads with diagrams", example: "\"How we handle 10K req/s with [service]\" — architecture thread", frequency: "weekly" },
                { id: "t2", platform: "reddit", contentType: "post", tone: "how-to", description: "Technical deep dives in engineering subreddits", example: "r/programming — \"How I built a scalable [service type]\"", frequency: "biweekly" },
                { id: "t3", platform: "blog", contentType: "article", tone: "educational", description: "In-depth technical blog posts", example: "\"Scaling [service] to handle X: lessons learned\"", frequency: "biweekly" },
            ],
            tags: ["backend", "infrastructure", "technical"],
        },

        // ── 9. Minion Toolbox ───────────────────────────────────────────
        {
            name: "Minion Toolbox — Automation Showcase",
            description: "Showcase AI/automation toolbox capabilities through demos, use cases, and integration tutorials.",
            projectCategory: "minion-toolbox",
            targetAudience: "Automation enthusiasts, no-code builders, productivity hackers",
            channels: ["tiktok", "x", "reddit"],
            contentTypes: ["video", "post", "slideshow"],
            cadence: "weekly",
            tactics: [
                { id: "t1", platform: "tiktok", contentType: "video", tone: "educational", description: "\"Watch this AI automate X in 30 seconds\" — demo videos", example: "Screen recording: set up automation → trigger → magic result", frequency: "weekly" },
                { id: "t2", platform: "x", contentType: "post", tone: "educational", description: "Automation tips, new integrations, use case threads", example: "\"5 automations you can set up today with [toolbox]\"", frequency: "2x-week" },
                { id: "t3", platform: "reddit", contentType: "post", tone: "how-to", description: "Automation workflow posts in productivity subreddits", example: "r/automation — \"Automated my entire X workflow\"", frequency: "biweekly" },
            ],
            tags: ["automation", "ai", "toolbox"],
        },

        // ── 10. Client Project ─────────────────────────────────────────
        {
            name: "Client Project — Portfolio Marketing",
            description: "Showcase client work to attract new clients. Case studies, results, and behind-the-scenes content.",
            projectCategory: "client-project",
            targetAudience: "Potential clients, business decision makers, startup founders",
            channels: ["x", "blog"],
            contentTypes: ["post", "article"],
            cadence: "monthly",
            tactics: [
                { id: "t1", platform: "x", contentType: "post", tone: "storytelling", description: "Case study posts with before/after metrics", example: "\"Built X for [client type]: 3x improvement in Y\" — thread with screenshots", frequency: "monthly" },
                { id: "t2", platform: "blog", contentType: "article", tone: "educational", description: "Detailed case study on portfolio website", example: "\"How we built [project] — architecture, challenges, results\"", frequency: "monthly" },
            ],
            tags: ["client", "portfolio", "case-study"],
        },
    ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function safeParseJson<T>(val: string | undefined | null, fallback: T): T {
    if (!val) return fallback;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}
