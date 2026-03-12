import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

// ─── Update Repo Link ────────────────────────────────────────────────────

export const updateRepoLink = mutation({
    args: {
        repoId: v.id("githubRepos"),
        projectId: v.optional(v.id("projects")),
        repoUrl: v.optional(v.string()),
        repoFullName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { repoId, ...updates } = args;
        const clean: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) clean[k] = val;
        }
        await ctx.db.patch(repoId, clean);
    },
});

// ─── Check Repo Name Availability ────────────────────────────────────────

export const checkRepoAvailability = action({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        orgName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;
        if (!token) throw new Error("No GitHub token. Connect GitHub in Integrations.");

        const slug = args.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        if (!slug) return { available: false, slug: "", error: "Invalid name" };

        const owner = args.orgName || (await getGitHubUsername(token));
        const checkRes = await fetch(`https://api.github.com/repos/${owner}/${slug}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MissionControl/1.0",
            },
        });

        return {
            available: checkRes.status === 404,
            slug,
            fullName: `${owner}/${slug}`,
            error: checkRes.status === 200 ? `"${owner}/${slug}" already exists` : undefined,
        };
    },
});

// ─── Create GitHub Repo ──────────────────────────────────────────────────

export const createRepo = action({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        description: v.optional(v.string()),
        isPrivate: v.optional(v.boolean()),
        orgName: v.optional(v.string()), // GitHub org name, omit for personal
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;
        if (!token) throw new Error("No GitHub token. Connect GitHub in Integrations.");

        // Slugify the name
        const slug = args.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        // Check if repo already exists
        const owner = args.orgName || (await getGitHubUsername(token));
        const checkRes = await fetch(`https://api.github.com/repos/${owner}/${slug}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MissionControl/1.0",
            },
        });

        if (checkRes.status === 200) {
            throw new Error(`Repository "${owner}/${slug}" already exists.`);
        }

        // Create the repo
        const apiUrl = args.orgName
            ? `https://api.github.com/orgs/${args.orgName}/repos`
            : "https://api.github.com/user/repos";

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MissionControl/1.0",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: slug,
                description: args.description || "",
                private: args.isPrivate ?? false,
                auto_init: true,
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create repo (${res.status}): ${text}`);
        }

        const repo = (await res.json()) as { full_name: string; html_url: string; default_branch: string };

        // Auto-link to project
        await ctx.runMutation(internal.github.linkRepoInternal, {
            orgId: args.orgId,
            repoFullName: repo.full_name,
            repoUrl: repo.html_url,
            defaultBranch: repo.default_branch || "main",
            projectId: args.projectId,
        });

        return {
            repoFullName: repo.full_name,
            repoUrl: repo.html_url,
            slug,
        };
    },
});

// ─── Delete GitHub Repo ──────────────────────────────────────────────────

export const deleteRepo = action({
    args: {
        orgId: v.id("organizations"),
        repoFullName: v.string(),
        confirmName: v.string(), // safety: must match repo name
    },
    handler: async (ctx, args) => {
        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;
        if (!token) throw new Error("No GitHub token.");

        // Extract just the repo name for confirmation
        const repoName = args.repoFullName.split("/").pop() || "";
        if (repoName !== args.confirmName) {
            throw new Error(`Name mismatch. Type "${repoName}" to confirm deletion.`);
        }

        const res = await fetch(`https://api.github.com/repos/${args.repoFullName}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MissionControl/1.0",
            },
        });

        if (!res.ok && res.status !== 204) {
            const text = await res.text();
            throw new Error(`Failed to delete repo (${res.status}): ${text}`);
        }

        // Also unlink from our DB
        const linked = await ctx.runQuery(internal.github.getRepoByFullName, {
            repoFullName: args.repoFullName,
        });
        if (linked) {
            await ctx.runMutation(internal.github.unlinkRepoInternal, {
                repoId: linked._id,
            });
        }

        return { success: true };
    },
});

// ─── List Available Repos from GitHub ────────────────────────────────────

export const listOrgRepos = action({
    args: {
        orgId: v.id("organizations"),
        orgName: v.optional(v.string()), // GitHub org name, omit for personal repos
    },
    handler: async (ctx, args) => {
        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;
        if (!token) throw new Error("No GitHub token.");

        const url = args.orgName
            ? `https://api.github.com/orgs/${args.orgName}/repos?per_page=100&sort=updated`
            : "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member";

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MissionControl/1.0",
            },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`GitHub API error (${res.status}): ${text}`);
        }

        const repos = (await res.json()) as Array<{
            full_name: string;
            html_url: string;
            default_branch: string;
            private: boolean;
            description: string | null;
        }>;

        // Check which are already linked
        const linkedRepos: string[] = await ctx.runQuery(internal.github.getLinkedRepoNames, {
            orgId: args.orgId,
        });
        const linkedSet: Set<string> = new Set(linkedRepos);

        return repos.map(r => ({
            fullName: r.full_name,
            url: r.html_url,
            defaultBranch: r.default_branch,
            isPrivate: r.private,
            description: r.description,
            isLinked: linkedSet.has(r.full_name),
        }));
    },
});

// ─── Internal Helpers for New Actions ────────────────────────────────────

export const linkRepoInternal = internalMutation({
    args: {
        orgId: v.id("organizations"),
        repoFullName: v.string(),
        repoUrl: v.string(),
        defaultBranch: v.string(),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("githubRepos", {
            orgId: args.orgId,
            projectId: args.projectId,
            repoFullName: args.repoFullName,
            repoUrl: args.repoUrl,
            defaultBranch: args.defaultBranch,
            syncStatus: "pending",
            createdAt: Date.now(),
        });
    },
});

export const unlinkRepoInternal = internalMutation({
    args: { repoId: v.id("githubRepos") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.repoId);
    },
});

export const getRepoByFullName = internalQuery({
    args: { repoFullName: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("githubRepos")
            .withIndex("by_repo", (idx) => idx.eq("repoFullName", args.repoFullName))
            .first();
    },
});

export const getLinkedRepoNames = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const repos = await ctx.db
            .query("githubRepos")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        return repos.map(r => r.repoFullName);
    },
});

async function getGitHubUsername(token: string): Promise<string> {
    const res = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MissionControl/1.0",
        },
    });
    if (!res.ok) throw new Error("Could not determine GitHub username");
    const user = (await res.json()) as { login: string };
    return user.login;
}

// ─── Update Repo Sync Data (internal) ────────────────────────────────────

export const updateSyncData = internalMutation({
    args: {
        repoId: v.id("githubRepos"),
        yamlContent: v.optional(v.string()),
        accountsContent: v.optional(v.string()),
        roadmapContent: v.optional(v.string()),
        ideasContent: v.optional(v.string()),
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

// ─── GitHub OAuth Token Management ───────────────────────────────────────

export const saveGithubToken = internalMutation({
    args: {
        orgId: v.id("organizations"),
        githubToken: v.string(),
        githubUsername: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orgId, {
            githubToken: args.githubToken,
            ...(args.githubUsername ? { githubUsername: args.githubUsername } : {}),
        });
    },
});

export const getGithubConnection = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const org = await ctx.db.get(args.orgId);
        if (!org) return null;
        return {
            connected: !!org?.githubToken,
            username: org?.githubUsername || null,
        };
    },
});

export const revokeGithubToken = mutation({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orgId, {
            githubToken: undefined,
            githubUsername: undefined,
        });
    },
});

// Internal: get the raw token for use in actions
export const getOrgGithubToken = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const org = await ctx.db.get(args.orgId);
        return org?.githubToken || undefined;
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

        const { repoFullName, defaultBranch, orgId, projectId } = repos;

        // Set syncing status
        await ctx.runMutation(internal.github.updateSyncData, {
            repoId: args.repoId,
            syncStatus: "syncing",
        });

        try {
            // ─── PROJECT.yaml: check .project/ first, fallback to root ────
            let yamlContent = await fetchFileFromGitHub(
                repoFullName,
                ".project/PROJECT.yaml",
                defaultBranch,
                args.githubToken
            );
            if (!yamlContent) {
                yamlContent = await fetchFileFromGitHub(
                    repoFullName,
                    "PROJECT.yaml",
                    defaultBranch,
                    args.githubToken
                );
            }

            // ─── ACCOUNTS.yaml: check .project/ first, fallback to root ──
            let accountsContent: string | undefined;
            try {
                const result = await fetchFileFromGitHub(
                    repoFullName,
                    ".project/ACCOUNTS.yaml",
                    defaultBranch,
                    args.githubToken
                );
                if (!result) {
                    const fallback = await fetchFileFromGitHub(
                        repoFullName,
                        "ACCOUNTS.yaml",
                        defaultBranch,
                        args.githubToken
                    );
                    accountsContent = fallback ?? undefined;
                } else {
                    accountsContent = result;
                }
            } catch {
                // ACCOUNTS.yaml is optional
            }

            // ─── ROADMAP.yaml: .project/ only ────────────────────────────
            let roadmapContent: string | undefined;
            try {
                const result = await fetchFileFromGitHub(
                    repoFullName,
                    ".project/ROADMAP.yaml",
                    defaultBranch,
                    args.githubToken
                );
                roadmapContent = result ?? undefined;
            } catch {
                // ROADMAP.yaml is optional
            }

            // ─── IDEAS.yaml: .project/ only ──────────────────────────────
            let ideasContent: string | undefined;
            try {
                const result = await fetchFileFromGitHub(
                    repoFullName,
                    ".project/IDEAS.yaml",
                    defaultBranch,
                    args.githubToken
                );
                ideasContent = result ?? undefined;
            } catch {
                // IDEAS.yaml is optional
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
                roadmapContent,
                ideasContent,
                lastCommitSha: commitSha || undefined,
                syncStatus: "synced",
            });

            // ─── Sync features from ROADMAP.yaml ────────────────────────
            if (roadmapContent && orgId) {
                try {
                    await ctx.runMutation(internal.github.syncFeaturesFromYaml, {
                        orgId,
                        projectId: projectId || undefined,
                        yamlContent: roadmapContent,
                        repoFullName,
                    });
                } catch (err) {
                    console.error("Failed to sync features from ROADMAP.yaml:", err);
                }
            }

            // ─── Sync ideas from IDEAS.yaml ──────────────────────────────
            if (ideasContent && orgId) {
                try {
                    await ctx.runMutation(internal.github.syncIdeasFromYaml, {
                        orgId,
                        yamlContent: ideasContent,
                        repoFullName,
                    });
                } catch (err) {
                    console.error("Failed to sync ideas from IDEAS.yaml:", err);
                }
            }

            return {
                success: true,
                hasYaml: !!yamlContent,
                hasAccounts: !!accountsContent,
                hasRoadmap: !!roadmapContent,
                hasIdeas: !!ideasContent,
            };
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

// ─── Browse Repo Contents (Action — calls GitHub API) ───────────────────

export const browseContents = action({
    args: {
        repoFullName: v.string(),
        path: v.optional(v.string()),
        branch: v.optional(v.string()),
        githubToken: v.optional(v.string()),
        orgId: v.optional(v.id("organizations")),
    },
    handler: async (ctx, args) => {
        let token: string | undefined = args.githubToken;
        if (!token && args.orgId) {
            token = await ctx.runQuery(internal.github.getOrgGithubToken, { orgId: args.orgId }) as string | undefined;
        }
        if (!token) throw new Error('No GitHub token available. Connect GitHub in Settings.');
        const path = args.path || '';
        const branch = args.branch || 'main';
        const url = `https://api.github.com/repos/${args.repoFullName}/contents/${path}?ref=${branch}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'MissionControl/1.0',
            },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`GitHub API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            // It's a single file, not a directory
            return { type: 'file' as const, content: data.content ? atob(data.content) : '', name: data.name, size: data.size };
        }

        return {
            type: 'directory' as const,
            entries: (data as Array<{ name: string; type: string; path: string; size?: number; sha?: string }>).map((item) => ({
                name: item.name,
                path: item.path,
                type: item.type as 'file' | 'dir',
                size: item.size,
                sha: item.sha,
            })),
        };
    },
});

export const fetchFileContent = action({
    args: {
        repoFullName: v.string(),
        path: v.string(),
        branch: v.optional(v.string()),
        githubToken: v.optional(v.string()),
        orgId: v.optional(v.id("organizations")),
    },
    handler: async (ctx, args) => {
        let token: string | undefined = args.githubToken;
        if (!token && args.orgId) {
            token = await ctx.runQuery(internal.github.getOrgGithubToken, { orgId: args.orgId }) as string | undefined;
        }
        if (!token) throw new Error('No GitHub token available. Connect GitHub in Settings.');
        const branch = args.branch || 'main';
        const content = await fetchFileFromGitHub(args.repoFullName, args.path, branch, token);
        return { content: content || '', path: args.path, name: args.path.split('/').pop() || '' };
    },
});

// ─── Internal query helper ───────────────────────────────────────────────

export const getRepoById = internalQuery({
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

// ─── Lightweight YAML parser for ROADMAP.yaml / IDEAS.yaml ──────────────

interface ParsedFeature {
    title: string;
    status: string;
    priority: string;
    effort?: string;
    category?: string;
    target_release?: string;
    description?: string;
    acceptance_criteria?: string;
    tags?: string[];
}

interface ParsedIdea {
    title: string;
    category: string;
    score: number;
    body?: string;
    tags?: string[];
}

/**
 * Simple YAML list parser for our specific formats.
 * Parses a YAML document with a top-level key containing a list of objects.
 * Handles basic scalar values, arrays (inline [a,b] or block - item), and multiline | strings.
 */
function parseSimpleYamlList(content: string, rootKey: string): Record<string, unknown>[] {
    const items: Record<string, unknown>[] = [];
    const lines = content.split('\n');
    let inRoot = false;
    let currentItem: Record<string, unknown> | null = null;
    let multilineKey: string | null = null;
    let multilineValue: string[] = [];
    let arrayKey: string | null = null;
    let arrayValues: string[] = [];

    const flushMultiline = () => {
        if (multilineKey && currentItem) {
            currentItem[multilineKey] = multilineValue.join('\n').trim();
        }
        multilineKey = null;
        multilineValue = [];
    };

    const flushArray = () => {
        if (arrayKey && currentItem) {
            currentItem[arrayKey] = arrayValues;
        }
        arrayKey = null;
        arrayValues = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimEnd();

        // Detect root key (e.g., "features:" or "ideas:")
        if (trimmed === `${rootKey}:` || trimmed === `${rootKey}: `) {
            inRoot = true;
            continue;
        }

        if (!inRoot) continue;

        // End of root section if we hit a non-indented, non-empty line
        if (trimmed.length > 0 && !trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
            flushMultiline();
            flushArray();
            if (currentItem && currentItem.title) items.push(currentItem);
            break;
        }

        // New list item: "  - title: ..."
        const listItemMatch = trimmed.match(/^\s+-\s+(\w[\w_]*):\s*(.*)/);
        if (listItemMatch) {
            flushMultiline();
            flushArray();
            if (currentItem && currentItem.title) items.push(currentItem);
            currentItem = {};
            const key = listItemMatch[1];
            const val = listItemMatch[2].trim();
            if (val === '|') {
                multilineKey = key;
                multilineValue = [];
            } else if (val.startsWith('[') && val.endsWith(']')) {
                // Inline array: [a, b, c]
                currentItem[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } else {
                currentItem[key] = val.replace(/^["']|["']$/g, '');
            }
            continue;
        }

        // Continuation property: "    key: value"
        const propMatch = trimmed.match(/^\s{4,}(\w[\w_]*):\s*(.*)/);
        if (propMatch && currentItem && !multilineKey) {
            flushArray();
            const key = propMatch[1];
            const val = propMatch[2].trim();
            if (val === '|') {
                multilineKey = key;
                multilineValue = [];
            } else if (val.startsWith('[') && val.endsWith(']')) {
                currentItem[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } else {
                currentItem[key] = val.replace(/^["']|["']$/g, '');
            }
            continue;
        }

        // Block array items: "      - value"
        const arrayItemMatch = trimmed.match(/^\s{6,}-\s+(.*)/);
        if (arrayItemMatch && currentItem && !multilineKey) {
            if (!arrayKey) {
                // This is a continuation of the last key that was set
                // Find the last key — it should have been the array key
                const keys = Object.keys(currentItem);
                const lastKey = keys[keys.length - 1];
                if (lastKey) {
                    arrayKey = lastKey;
                    const existingVal = currentItem[lastKey];
                    if (typeof existingVal === 'string' && existingVal === '') {
                        arrayValues = [];
                    } else if (Array.isArray(existingVal)) {
                        arrayValues = existingVal as string[];
                    }
                    delete currentItem[lastKey];
                }
            }
            if (arrayKey) {
                arrayValues.push(arrayItemMatch[1].trim().replace(/^["']|["']$/g, ''));
            }
            continue;
        }

        // Multiline content continuation
        if (multilineKey && trimmed.match(/^\s{6,}/)) {
            multilineValue.push(trimmed.trim());
            continue;
        }

        // End of multiline
        if (multilineKey && !trimmed.match(/^\s{6,}/)) {
            flushMultiline();
        }
    }

    // Flush remaining
    flushMultiline();
    flushArray();
    if (currentItem && currentItem.title) items.push(currentItem);

    return items;
}

// ─── Sync Features from ROADMAP.yaml ────────────────────────────────────

export const syncFeaturesFromYaml = internalMutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.optional(v.id("projects")),
        yamlContent: v.string(),
        repoFullName: v.string(),
    },
    handler: async (ctx, args) => {
        const parsed = parseSimpleYamlList(args.yamlContent, "features") as ParsedFeature[];
        if (!parsed.length) return { synced: 0 };

        const now = Date.now();
        let synced = 0;

        for (const feature of parsed) {
            if (!feature.title) continue;

            // Check if feature with same title already exists for this org
            const existing = await ctx.db
                .query("features")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();

            const match = existing.find(f => f.title === feature.title);

            if (match) {
                // Update existing feature
                await ctx.db.patch(match._id, {
                    status: feature.status || match.status,
                    priority: feature.priority || match.priority,
                    effort: feature.effort || match.effort,
                    category: feature.category || match.category,
                    targetRelease: feature.target_release || match.targetRelease,
                    description: feature.description || match.description,
                    acceptanceCriteria: feature.acceptance_criteria || match.acceptanceCriteria,
                    tags: feature.tags || match.tags,
                    updatedAt: now,
                });
            } else {
                // Create new feature
                await ctx.db.insert("features", {
                    orgId: args.orgId,
                    projectId: args.projectId,
                    title: feature.title,
                    description: feature.description || "",
                    status: feature.status || "proposed",
                    priority: feature.priority || "medium",
                    effort: feature.effort,
                    category: feature.category,
                    targetRelease: feature.target_release,
                    tags: feature.tags || [],
                    acceptanceCriteria: feature.acceptance_criteria,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            synced++;
        }

        return { synced };
    },
});

// ─── Sync Ideas from IDEAS.yaml ─────────────────────────────────────────

export const syncIdeasFromYaml = internalMutation({
    args: {
        orgId: v.id("organizations"),
        yamlContent: v.string(),
        repoFullName: v.string(),
    },
    handler: async (ctx, args) => {
        const parsed = parseSimpleYamlList(args.yamlContent, "ideas") as ParsedIdea[];
        if (!parsed.length) return { synced: 0 };

        const now = Date.now();
        let synced = 0;

        for (const idea of parsed) {
            if (!idea.title) continue;

            // Check if idea with same title already exists for this org
            const existing = await ctx.db
                .query("ideas")
                .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
                .collect();

            const match = existing.find(i => i.title === idea.title);

            if (match) {
                // Update existing idea
                await ctx.db.patch(match._id, {
                    body: idea.body || match.body,
                    category: idea.category || match.category,
                    score: typeof idea.score === 'number' ? idea.score : (typeof idea.score === 'string' ? parseInt(idea.score, 10) || match.score : match.score),
                    tags: idea.tags || match.tags,
                    updatedAt: now,
                });
            } else {
                // Create new idea
                await ctx.db.insert("ideas", {
                    orgId: args.orgId,
                    title: idea.title,
                    body: idea.body || "",
                    category: idea.category || "product",
                    score: typeof idea.score === 'number' ? idea.score : (typeof idea.score === 'string' ? parseInt(idea.score, 10) || 5 : 5),
                    tags: idea.tags || [],
                    linkedProjects: [args.repoFullName],
                    linkedIdeas: [],
                    archived: false,
                    status: "active",
                    createdAt: now,
                    updatedAt: now,
                });
            }
            synced++;
        }

        return { synced };
    },
});
