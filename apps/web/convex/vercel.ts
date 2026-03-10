import { action, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Vercel API Helpers ──────────────────────────────────────────────────

async function vercelFetch(path: string, token: string, teamId?: string, options?: RequestInit): Promise<Response> {
    const url = new URL(`https://api.vercel.com${path}`);
    if (teamId) url.searchParams.set("teamId", teamId);
    return fetch(url.toString(), {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
    });
}

// ─── Token Management ────────────────────────────────────────────────────

export const saveVercelToken = mutation({
    args: {
        orgId: v.id("organizations"),
        vercelToken: v.string(),
        vercelTeamId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orgId, {
            vercelToken: args.vercelToken,
            vercelTeamId: args.vercelTeamId,
        });
    },
});

export const getVercelConnection = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const org = await ctx.db.get(args.orgId);
        if (!org) return null;
        return {
            connected: !!org.vercelToken,
            teamId: org.vercelTeamId || null,
        };
    },
});

export const revokeVercelToken = mutation({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orgId, {
            vercelToken: undefined,
            vercelTeamId: undefined,
        });
    },
});

// Internal: get raw token
export const getOrgVercelToken = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const org = await ctx.db.get(args.orgId);
        return { token: org?.vercelToken, teamId: org?.vercelTeamId };
    },
});

// ─── Link / Unlink Project ───────────────────────────────────────────────

export const linkProject = mutation({
    args: {
        projectId: v.id("projects"),
        vercelProjectId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, {
            vercelProjectId: args.vercelProjectId,
            updatedAt: Date.now(),
        });
    },
});

export const unlinkProject = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, {
            vercelProjectId: undefined,
            updatedAt: Date.now(),
        });
    },
});

// ─── List Vercel Projects ────────────────────────────────────────────────

export const listProjects = action({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token. Connect Vercel in Integrations.");

        const res = await vercelFetch("/v9/projects?limit=100", token, teamId);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Vercel API error (${res.status}): ${text}`);
        }

        const data = (await res.json()) as { projects: Array<{ id: string; name: string; framework: string | null; updatedAt: number; targets?: Record<string, { url?: string }> }> };
        return data.projects.map(p => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            updatedAt: p.updatedAt,
            productionUrl: p.targets?.production?.url || null,
        }));
    },
});

// ─── Create Vercel Project ───────────────────────────────────────────────

export const createProject = action({
    args: {
        orgId: v.id("organizations"),
        name: v.string(),
        framework: v.optional(v.string()),
        gitRepo: v.optional(v.string()), // owner/repo format
    },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token.");

        const body: Record<string, unknown> = { name: args.name };
        if (args.framework) body.framework = args.framework;
        if (args.gitRepo) {
            body.gitRepository = {
                repo: args.gitRepo,
                type: "github",
            };
        }

        const res = await vercelFetch("/v10/projects", token, teamId, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create Vercel project (${res.status}): ${text}`);
        }

        const project = (await res.json()) as { id: string; name: string };
        return { id: project.id, name: project.name };
    },
});

// ─── Delete Vercel Project ───────────────────────────────────────────────

export const deleteProject = action({
    args: {
        orgId: v.id("organizations"),
        vercelProjectId: v.string(),
        confirmName: v.string(), // must match project name as safety check
    },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token.");

        // Verify the project name matches
        const projectRes = await vercelFetch(`/v9/projects/${args.vercelProjectId}`, token, teamId);
        if (!projectRes.ok) throw new Error("Vercel project not found");

        const project = (await projectRes.json()) as { name: string };
        if (project.name !== args.confirmName) {
            throw new Error(`Name mismatch. Expected "${project.name}" but got "${args.confirmName}"`);
        }

        const res = await vercelFetch(`/v9/projects/${args.vercelProjectId}`, token, teamId, {
            method: "DELETE",
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to delete Vercel project (${res.status}): ${text}`);
        }

        return { success: true };
    },
});

// ─── Deploy / Redeploy ───────────────────────────────────────────────────

export const deploy = action({
    args: {
        orgId: v.id("organizations"),
        vercelProjectId: v.string(),
        gitRepo: v.optional(v.string()), // owner/repo
        branch: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token.");

        const body: Record<string, unknown> = {
            name: args.vercelProjectId,
            target: "production",
        };

        if (args.gitRepo) {
            body.gitSource = {
                type: "github",
                repo: args.gitRepo,
                ref: args.branch || "main",
            };
        }

        const res = await vercelFetch("/v13/deployments", token, teamId, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Deployment failed (${res.status}): ${text}`);
        }

        const deployment = (await res.json()) as { id: string; url: string; readyState: string };
        return { id: deployment.id, url: deployment.url, state: deployment.readyState };
    },
});

// ─── Get Deployments ─────────────────────────────────────────────────────

export const getDeployments = action({
    args: {
        orgId: v.id("organizations"),
        vercelProjectId: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token.");

        const limit = args.limit || 10;
        const res = await vercelFetch(
            `/v6/deployments?projectId=${args.vercelProjectId}&limit=${limit}`,
            token,
            teamId,
        );

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch deployments (${res.status}): ${text}`);
        }

        const data = (await res.json()) as {
            deployments: Array<{
                uid: string;
                name: string;
                url: string;
                state: string;
                created: number;
                ready?: number;
                target?: string;
                meta?: { githubCommitMessage?: string; githubCommitRef?: string };
            }>
        };

        return data.deployments.map(d => ({
            id: d.uid,
            name: d.name,
            url: d.url,
            state: d.state,
            created: d.created,
            ready: d.ready,
            target: d.target,
            commitMessage: d.meta?.githubCommitMessage,
            commitRef: d.meta?.githubCommitRef,
        }));
    },
});

// ─── Get Deployment Events/Logs ──────────────────────────────────────────

export const getDeploymentLogs = action({
    args: {
        orgId: v.id("organizations"),
        deploymentId: v.string(),
    },
    handler: async (ctx, args) => {
        const { token, teamId } = await ctx.runQuery(internal.vercel.getOrgVercelToken, { orgId: args.orgId }) as { token?: string; teamId?: string };
        if (!token) throw new Error("No Vercel token.");

        const res = await vercelFetch(
            `/v2/deployments/${args.deploymentId}/events`,
            token,
            teamId,
        );

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch logs (${res.status}): ${text}`);
        }

        const events = (await res.json()) as Array<{
            type: string;
            created: number;
            payload: { text?: string; statusCode?: number };
        }>;

        return events.map(e => ({
            type: e.type,
            created: e.created,
            text: e.payload?.text || "",
        }));
    },
});
