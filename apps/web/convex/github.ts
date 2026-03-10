import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── List Linked Repos ───────────────────────────────────────────────────

export const list = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("githubRepos")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
    },
});

export const getByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("githubRepos")
            .withIndex("by_project", (idx) => idx.eq("projectId", args.projectId))
            .first();
    },
});

// ─── Link a GitHub Repo ──────────────────────────────────────────────────

export const linkRepo = mutation({
    args: {
        orgId: v.id("organizations"),
        repoUrl: v.string(),
        repoFullName: v.string(),
        defaultBranch: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        // Check if already linked
        const existing = await ctx.db
            .query("githubRepos")
            .withIndex("by_repo", (idx) => idx.eq("repoFullName", args.repoFullName))
            .first();
        if (existing) {
            throw new Error(`Repo "${args.repoFullName}" is already linked.`);
        }

        return await ctx.db.insert("githubRepos", {
            orgId: args.orgId,
            projectId: args.projectId,
            repoFullName: args.repoFullName,
            repoUrl: args.repoUrl,
            defaultBranch: args.defaultBranch || "main",
            syncStatus: "pending",
            createdAt: Date.now(),
        });
    },
});

// ─── Unlink a Repo ───────────────────────────────────────────────────────

export const unlinkRepo = mutation({
    args: { repoId: v.id("githubRepos") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.repoId);
    },
});

// ─── Update Repo Sync Data (internal) ────────────────────────────────────

export const updateSyncData = internalMutation({
    args: {
        repoId: v.id("githubRepos"),
        yamlContent: v.optional(v.string()),
        accountsContent: v.optional(v.string()),
        lastCommitSha: v.optional(v.string()),
        syncStatus: v.string(),
    },
    handler: async (ctx, args) => {
        const { repoId, ...updates } = args;
        await ctx.db.patch(repoId, {
            ...updates,
            lastSyncedAt: Date.now(),
        });
    },
});

// ─── Sync a Single Repo (Action — calls GitHub API) ──────────────────────

export const syncRepo = action({
    args: {
        repoId: v.id("githubRepos"),
        githubToken: v.string(),
    },
    handler: async (ctx, args) => {
        // Load repo record
        const repos = await ctx.runQuery(internal.github.getRepoById, {
            repoId: args.repoId,
        });
        if (!repos) throw new Error("Repo not found");

        const { repoFullName, defaultBranch } = repos;

        // Set syncing status
        await ctx.runMutation(internal.github.updateSyncData, {
            repoId: args.repoId,
            syncStatus: "syncing",
        });

        try {
            // Fetch PROJECT.yaml from repo
            const yamlContent = await fetchFileFromGitHub(
                repoFullName,
                "PROJECT.yaml",
                defaultBranch,
                args.githubToken
            );

            // Fetch ACCOUNTS.yaml from repo (optional - may not exist)
            let accountsContent: string | undefined;
            try {
                accountsContent = await fetchFileFromGitHub(
                    repoFullName,
                    "ACCOUNTS.yaml",
                    defaultBranch,
                    args.githubToken
                );
            } catch {
                // ACCOUNTS.yaml is optional
            }

            // Fetch latest commit SHA
            const commitSha = await fetchLatestCommitSha(
                repoFullName,
                defaultBranch,
                args.githubToken
            );

            await ctx.runMutation(internal.github.updateSyncData, {
                repoId: args.repoId,
                yamlContent: yamlContent || undefined,
                accountsContent,
                lastCommitSha: commitSha || undefined,
                syncStatus: "synced",
            });

            return { success: true, hasYaml: !!yamlContent, hasAccounts: !!accountsContent };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            await ctx.runMutation(internal.github.updateSyncData, {
                repoId: args.repoId,
                syncStatus: "error",
            });
            return { success: false, error: message };
        }
    },
});

// ─── Internal query helper ───────────────────────────────────────────────

export const getRepoById = query({
    args: { repoId: v.id("githubRepos") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.repoId);
    },
});

// ─── GitHub API Helpers ──────────────────────────────────────────────────

async function fetchFileFromGitHub(
    repoFullName: string,
    filePath: string,
    branch: string,
    token: string
): Promise<string | null> {
    const url = `https://api.github.com/repos/${repoFullName}/contents/${filePath}?ref=${branch}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3.raw",
            "User-Agent": "MissionControl/1.0",
        },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
    }
    return await res.text();
}

async function fetchLatestCommitSha(
    repoFullName: string,
    branch: string,
    token: string
): Promise<string | null> {
    const url = `https://api.github.com/repos/${repoFullName}/commits/${branch}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MissionControl/1.0",
        },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data as { sha?: string }).sha || null;
}
