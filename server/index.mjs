#!/usr/bin/env node
/**
 * Express API server for Mission Control.
 * Handles filesystem operations, Minions CRUD, Git operations, and GitHub API.
 * 
 * Auth: Validates requests via API key in Authorization header.
 * In production, this will be called by Convex HTTP actions with a shared secret.
 * 
 * Usage: node server/index.mjs
 * Runs on port 3001
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3001;
const ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const API_KEY = process.env.MC_API_KEY || 'dev-key-change-in-production';
const ACCESS_TOKEN = process.env.MC_ACCESS_TOKEN || '';

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
    // In dev mode, allow all requests
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    // Allow access via API key OR access token
    if (token === API_KEY || (ACCESS_TOKEN && token === ACCESS_TOKEN)) {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
}

app.use('/api', authMiddleware);

// ─── YAML Parser/Serializer ────────────────────────────────────────────────

function parseYaml(content) {
    const obj = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();
        if (value === 'null' || value === '') obj[key] = null;
        else if (value === 'true') obj[key] = true;
        else if (value === 'false') obj[key] = false;
        else if (value.startsWith('[') && value.endsWith(']')) {
            const inner = value.slice(1, -1).trim();
            obj[key] = inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
        }
        else if (value.startsWith('"') && value.endsWith('"')) obj[key] = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) obj[key] = value.slice(1, -1);
        else obj[key] = value;
    }
    return obj;
}

function toYaml(obj) {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) lines.push(`${key}: null`);
        else if (typeof value === 'boolean') lines.push(`${key}: ${value}`);
        else if (typeof value === 'number') lines.push(`${key}: ${value}`);
        else if (Array.isArray(value)) {
            lines.push(value.length === 0 ? `${key}: []` : `${key}: [${value.map(v => typeof v === 'string' && (v.includes(',') || v.includes(':')) ? `"${v}"` : v).join(', ')}]`);
        }
        else if (typeof value === 'string') {
            if (value.includes(':') || value.includes('#') || value.includes('"') || value.startsWith(' ') || value === 'true' || value === 'false' || value === 'null') {
                lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
            } else {
                lines.push(`${key}: ${value}`);
            }
        }
        else if (typeof value === 'object') {
            lines.push(`${key}: ${JSON.stringify(value)}`);
        }
    }
    return lines.join('\n') + '\n';
}

// ─── Project Scanner ────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
    'node_modules', '.git', '.github', '.vscode', '.claude', '.gemini',
    'dist', 'build', '.next', '.output', '.netlify', '.vite', '.tanstack',
    '__pycache__', 'project-dashboard', 'mission-control-app'
]);

function findProjectYamls(dir, maxDepth = 8, currentDepth = 0) {
    const results = [];
    if (currentDepth > maxDepth) return results;

    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }

    const yamlPath = path.join(dir, 'PROJECT.yaml');
    if (fs.existsSync(yamlPath)) {
        try {
            const content = fs.readFileSync(yamlPath, 'utf-8');
            const data = parseYaml(content);
            data._path = path.relative(ROOT, dir);
            data._yamlPath = path.relative(ROOT, yamlPath);
            data._absolutePath = dir;
            results.push(data);
        } catch (err) {
            console.warn(`⚠️  Failed to parse ${yamlPath}: ${err.message}`);
        }
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        results.push(...findProjectYamls(path.join(dir, entry.name), maxDepth, currentDepth + 1));
    }

    return results;
}

function calculateHealthScore(dir) {
    let score = 0;
    if (fs.existsSync(path.join(dir, 'README.md'))) score += 10;
    if (fs.existsSync(path.join(dir, 'tests')) || fs.existsSync(path.join(dir, 'test')) || fs.existsSync(path.join(dir, '__tests__'))) score += 15;
    if (fs.existsSync(path.join(dir, '.github', 'workflows'))) score += 15;
    if (fs.existsSync(path.join(dir, 'dist')) || fs.existsSync(path.join(dir, 'build'))) score += 10;
    if (fs.existsSync(path.join(dir, 'package-lock.json')) || fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) score += 10;
    if (fs.existsSync(path.join(dir, 'LICENSE'))) score += 5;
    if (fs.existsSync(path.join(dir, 'CHANGELOG.md'))) score += 5;

    // Freshness: check git log
    try {
        const result = execSync('git log -1 --format="%ai" -- .', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }).toString().trim();
        if (result) {
            const lastCommit = new Date(result);
            const daysSince = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) score += 20;
            else if (daysSince < 30) score += 10;
            else if (daysSince < 90) score += 5;
        }
    } catch { /* ignore */ }

    // Has src directory with files
    if (fs.existsSync(path.join(dir, 'src'))) score += 10;

    return Math.min(score, 100);
}

// ─── Scan & Build Status ────────────────────────────────────────────────────

function runScan() {
    console.log('🔍 Scanning for PROJECT.yaml files...');
    const projects = findProjectYamls(ROOT);

    const TIER_ORDER = ['idea', 'prototype', 'building', 'shipped', 'maintaining', 'archived'];
    const byTier = {}, byLane = {}, byPriority = {}, byStack = {};

    const enrichedProjects = projects.map(p => {
        const tier = p.tier || 'idea';
        const lane = p.lane || 'uncategorized';
        const prio = p.priority || 'medium';
        byTier[tier] = (byTier[tier] || 0) + 1;
        byLane[lane] = (byLane[lane] || 0) + 1;
        byPriority[prio] = (byPriority[prio] || 0) + 1;

        const stacks = Array.isArray(p.stack) ? p.stack : [];
        for (const s of stacks) byStack[s] = (byStack[s] || 0) + 1;

        const healthScore = p._absolutePath ? calculateHealthScore(p._absolutePath) : 0;

        return {
            name: p.name || '',
            description: p.description || '',
            tier: tier,
            lane: lane,
            priority: prio,
            oss: p.oss === true || p.oss === 'true',
            stack: stacks,
            repo: p.repo || null,
            deploy_url: p.deploy_url || null,
            last_active: p.last_active || null,
            tags: Array.isArray(p.tags) ? p.tags : [],
            notes: p.notes || '',
            path: p._path || '',
            yaml_path: p._yamlPath || '',
            health_score: healthScore,
        };
    });

    const statusData = {
        generated_at: new Date().toISOString(),
        total_projects: enrichedProjects.length,
        summary: { by_tier: byTier, by_lane: byLane, by_priority: byPriority, by_stack: byStack },
        projects: enrichedProjects,
    };

    // Write status.json
    fs.writeFileSync(path.join(ROOT, 'status.json'), JSON.stringify(statusData, null, 2), 'utf-8');
    console.log(`📊 Scan complete: ${enrichedProjects.length} projects`);

    return statusData;
}

// ─── API Routes ─────────────────────────────────────────────────────────────

// GET /api/projects — list all projects
app.get('/api/projects', (req, res) => {
    try {
        const statusPath = path.join(ROOT, 'status.json');
        if (!fs.existsSync(statusPath)) {
            // Auto-scan if status.json doesn't exist
            const data = runScan();
            return res.json(data);
        }
        const data = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/:path — get single project YAML
app.get('/api/projects/:projectPath', (req, res) => {
    try {
        const projectPath = decodeURIComponent(req.params.projectPath);
        const yamlPath = path.join(ROOT, projectPath, 'PROJECT.yaml');
        if (!fs.existsSync(yamlPath)) {
            return res.status(404).json({ error: `PROJECT.yaml not found at ${projectPath}` });
        }
        const raw = fs.readFileSync(yamlPath, 'utf-8');
        const parsed = parseYaml(raw);
        parsed.path = projectPath;
        parsed.yaml_path = path.join(projectPath, 'PROJECT.yaml');
        parsed.health_score = calculateHealthScore(path.join(ROOT, projectPath));

        res.json({ project: parsed, raw_yaml: raw });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/projects/:path — update project YAML
app.put('/api/projects/:projectPath', (req, res) => {
    try {
        const projectPath = decodeURIComponent(req.params.projectPath);
        const yamlPath = path.join(ROOT, projectPath, 'PROJECT.yaml');
        if (!fs.existsSync(yamlPath)) {
            return res.status(404).json({ error: `PROJECT.yaml not found at ${projectPath}` });
        }
        const { yaml } = req.body;
        if (!yaml) return res.status(400).json({ error: 'Missing yaml content' });

        fs.writeFileSync(yamlPath, yaml, 'utf-8');

        // Re-scan in background
        setTimeout(() => { try { runScan(); } catch { } }, 100);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/scan — trigger full re-scan
app.post('/api/scan', (req, res) => {
    try {
        const data = runScan();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/health — server health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        root: ROOT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`🚀 Mission Control API running on http://localhost:${PORT}`);
    console.log(`   Root directory: ${ROOT}`);
    console.log(`   Auth: ${process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled (dev mode)'}`);
});
