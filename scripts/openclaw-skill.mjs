#!/usr/bin/env node
/**
 * OpenClaw AgentSkill — Mission Control Integration
 * 
 * This script exposes Mission Control data as OpenClaw skill functions.
 * Each function communicates with the MC Express API via HTTP.
 * 
 * Usage:
 *   Register this as an AgentSkill in OpenClaw:
 *   - Copy to your OpenClaw skills directory
 *   - Or reference via skill configuration
 * 
 * Environment:
 *   MC_API_URL  — Mission Control API base URL (default: http://localhost:3001)
 *   MC_API_KEY  — Optional API key for auth
 */

const MC_API_URL = process.env.MC_API_URL || 'http://localhost:3001';
const MC_API_KEY = process.env.MC_API_KEY || '';

const headers = {
    'Content-Type': 'application/json',
    ...(MC_API_KEY ? { 'Authorization': `Bearer ${MC_API_KEY}` } : {}),
};

// ─── Skill Functions ────────────────────────────────────────────────────────

/** List all projects with tier, lane, priority */
export async function mc_list_projects() {
    const res = await fetch(`${MC_API_URL}/api/projects`, { headers });
    const data = await res.json();
    return data.projects?.map(p => ({
        name: p.name,
        path: p.path,
        tier: p.tier,
        lane: p.lane,
        priority: p.priority,
        stack: p.stack,
    })) || [];
}

/** Get project health and details */
export async function mc_project_health(projectPath) {
    const res = await fetch(`${MC_API_URL}/api/projects/${encodeURIComponent(projectPath)}`, { headers });
    const data = await res.json();
    return {
        name: data.project?.name,
        tier: data.project?.tier,
        healthScore: data.project?.healthScore,
        stack: data.project?.stack,
    };
}

/** Create a task for a project */
export async function mc_create_task({ projectPath, title, priority = 'medium', taskType = 'feature', effort = 'M' }) {
    const res = await fetch(`${MC_API_URL}/api/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectPath, title, priority, taskType, effort }),
    });
    return await res.json();
}

/** List tasks with optional filter */
export async function mc_list_tasks(status = '', project = '') {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (project) params.set('project', project);
    const qs = params.toString();
    const res = await fetch(`${MC_API_URL}/api/tasks${qs ? '?' + qs : ''}`, { headers });
    return await res.json();
}

/** Get task statistics */
export async function mc_task_stats() {
    const res = await fetch(`${MC_API_URL}/api/tasks/stats`, { headers });
    return await res.json();
}

/** Trigger a full project scan */
export async function mc_run_scan() {
    const res = await fetch(`${MC_API_URL}/api/scan`, { method: 'POST', headers });
    return await res.json();
}

/** Run automation (scan + stale detection + git status + health) */
export async function mc_run_automation() {
    const res = await fetch(`${MC_API_URL}/api/automation/run`, { method: 'POST', headers });
    return await res.json();
}

/** Get dependency graph data */
export async function mc_dependencies() {
    const res = await fetch(`${MC_API_URL}/api/dependencies`, { headers });
    const data = await res.json();
    return {
        totalProjects: data.summary?.totalProjects,
        totalPackages: data.summary?.totalPackages,
        sharedPackages: data.summary?.sharedPackages,
        topShared: data.summary?.topShared?.slice(0, 10),
    };
}

// ─── OpenClaw Skill Manifest ────────────────────────────────────────────────

export const SKILL_MANIFEST = {
    name: 'mission-control',
    description: 'Access Mission Control portfolio data — projects, tasks, dependencies, automation',
    version: '1.0.0',
    functions: [
        { name: 'mc_list_projects', description: 'List all projects with tier/lane/priority', params: [] },
        { name: 'mc_project_health', description: 'Get project health score and details', params: [{ name: 'projectPath', type: 'string', required: true }] },
        {
            name: 'mc_create_task', description: 'Create a task for a project', params: [
                { name: 'projectPath', type: 'string', required: true },
                { name: 'title', type: 'string', required: true },
                { name: 'priority', type: 'string', required: false, default: 'medium' },
                { name: 'taskType', type: 'string', required: false, default: 'feature' },
                { name: 'effort', type: 'string', required: false, default: 'M' },
            ]
        },
        {
            name: 'mc_list_tasks', description: 'List tasks with optional status/project filter', params: [
                { name: 'status', type: 'string', required: false },
                { name: 'project', type: 'string', required: false },
            ]
        },
        { name: 'mc_task_stats', description: 'Get task statistics', params: [] },
        { name: 'mc_run_scan', description: 'Trigger a full project re-scan', params: [] },
        { name: 'mc_run_automation', description: 'Run full automation (scan + stale + git + health)', params: [] },
        { name: 'mc_dependencies', description: 'Get cross-project dependency graph summary', params: [] },
    ],
};

// ─── CLI Mode ───────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

if (cmd) {
    const fns = {
        mc_list_projects, mc_project_health, mc_create_task,
        mc_list_tasks, mc_task_stats, mc_run_scan, mc_run_automation, mc_dependencies,
    };

    if (fns[cmd]) {
        const param = args[0] ? JSON.parse(args[0]) : undefined;
        fns[cmd](param).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => console.error(e.message));
    } else {
        console.log('Available commands:', Object.keys(fns).join(', '));
        console.log('Usage: node openclaw-skill.mjs <command> [jsonParams]');
    }
}
