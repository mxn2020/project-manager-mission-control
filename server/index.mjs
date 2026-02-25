#!/usr/bin/env node
/**
 * Express API server for Mission Control.
 * 
 * Data Layer: Uses Minions SDK for structured CRUD via YamlFileStorageAdapter.
 * Falls back to legacy PROJECT.yaml scanning if .minions directory doesn't exist.
 * 
 * Auth: Validates requests via API key or access token in Authorization header.
 * 
 * Usage: node server/index.mjs
 * Runs on port 3001
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { initMinions, getMinions, getRegistry, listByType, minionToFlat } from './minions-adapter.mjs';
import { handleChat } from './ai-chat.mjs';

const app = express();
const PORT = process.env.PORT || 3001;
const ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const API_KEY = process.env.MC_API_KEY || '';
const MINIONS_DIR = path.join(ROOT, '.minions');
const CONVEX_URL = process.env.CONVEX_URL || 'https://academic-buzzard-501.eu-west-1.convex.cloud';

let minionsReady = false;

// Token cache: { token → { user, expiresAt } }
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 min

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ─── Auth Middleware (Convex Token Validation) ──────────────────────────────

async function validateConvexToken(token) {
    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
    }

    try {
        const res = await fetch(`${CONVEX_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: 'auth:me',
                args: { token },
                format: 'json',
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const user = data.value;
        if (user && user.id) {
            tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL });
            return user;
        }
    } catch (err) {
        console.error('Convex token validation error:', err.message);
    }
    return null;
}

function authMiddleware(req, res, next) {
    // Health check is always public
    if (req.path === '/api/health') return next();

    // Skip auth in dev mode
    if (process.env.NODE_ENV !== 'production') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Authorization required' });

    const token = authHeader.replace('Bearer ', '');

    // Static API key (backwards compat for agents/scripts)
    if (API_KEY && token === API_KEY) return next();

    // Validate Convex session token
    validateConvexToken(token)
        .then(user => {
            if (user) {
                req.user = user;
                next();
            } else {
                res.status(401).json({ error: 'Invalid or expired session' });
            }
        })
        .catch(() => res.status(401).json({ error: 'Auth validation failed' }));
}

app.use('/api', authMiddleware);

// ─── Legacy YAML Parser/Scanner (fallback) ──────────────────────────────────

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
    try {
        const result = execSync('git log -1 --format="%ai" -- .', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }).toString().trim();
        if (result) {
            const daysSince = (Date.now() - new Date(result).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) score += 20;
            else if (daysSince < 30) score += 10;
            else if (daysSince < 90) score += 5;
        }
    } catch { /* ignore */ }
    if (fs.existsSync(path.join(dir, 'src'))) score += 10;
    return Math.min(score, 100);
}

function legacyScan() {
    console.log('🔍 Legacy scan: scanning for PROJECT.yaml files...');
    const projects = findProjectYamls(ROOT);
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
            name: p.name || '', description: p.description || '',
            tier, lane, priority: prio,
            oss: p.oss === true || p.oss === 'true',
            stack: stacks, repo: p.repo || null,
            deploy_url: p.deploy_url || null, last_active: p.last_active || null,
            tags: Array.isArray(p.tags) ? p.tags : [], notes: p.notes || '',
            path: p._path || '', yaml_path: p._yamlPath || '',
            health_score: healthScore,
        };
    });

    return {
        generated_at: new Date().toISOString(),
        total_projects: enrichedProjects.length,
        summary: { by_tier: byTier, by_lane: byLane, by_priority: byPriority, by_stack: byStack },
        projects: enrichedProjects,
    };
}

// ─── Minions-powered Data Access ────────────────────────────────────────────

async function minionsGetProjects() {
    const minions = await listByType('project');
    const byTier = {}, byLane = {}, byPriority = {}, byStack = {};

    const projects = minions.map(m => {
        const f = m.fields;
        const tier = f.tier || 'idea';
        const lane = f.lane || 'uncategorized';
        const prio = f.priority || m.priority || 'medium';
        byTier[tier] = (byTier[tier] || 0) + 1;
        byLane[lane] = (byLane[lane] || 0) + 1;
        byPriority[prio] = (byPriority[prio] || 0) + 1;
        const stacks = Array.isArray(f.stack) ? f.stack : [];
        for (const s of stacks) byStack[s] = (byStack[s] || 0) + 1;

        return {
            name: m.title || f.name || '',
            description: m.description || '',
            tier, lane, priority: prio,
            oss: f.oss === true,
            stack: stacks,
            repo: f.repoUrl || null,
            deploy_url: f.deployUrl || null,
            last_active: f.lastActive || null,
            tags: m.tags || [],
            notes: f.notes || '',
            path: f.path || '',
            yaml_path: f.yamlPath || '',
            health_score: f.healthScore || 0,
            _minionId: m.id,
        };
    });

    return {
        generated_at: new Date().toISOString(),
        total_projects: projects.length,
        summary: { by_tier: byTier, by_lane: byLane, by_priority: byPriority, by_stack: byStack },
        projects,
        source: 'minions',
    };
}

// ─── API Routes ─────────────────────────────────────────────────────────────

// GET /api/projects — list all projects
app.get('/api/projects', async (req, res) => {
    try {
        if (minionsReady) {
            const data = await minionsGetProjects();
            return res.json(data);
        }
        // Fallback to legacy scan
        const statusPath = path.join(ROOT, 'status.json');
        if (!fs.existsSync(statusPath)) {
            const data = legacyScan();
            fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
            return res.json(data);
        }
        res.json(JSON.parse(fs.readFileSync(statusPath, 'utf-8')));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/:path — get single project
app.get('/api/projects/:projectPath', async (req, res) => {
    try {
        const projectPath = decodeURIComponent(req.params.projectPath);

        if (minionsReady) {
            // Search by path in Minions
            const minions = await listByType('project');
            const match = minions.find(m => m.fields?.path === projectPath);
            if (match) {
                const flat = minionToFlat(match);
                // Also read raw YAML for the editor
                const yamlPath = path.join(ROOT, projectPath, 'PROJECT.yaml');
                const rawYaml = fs.existsSync(yamlPath) ? fs.readFileSync(yamlPath, 'utf-8') : '';
                return res.json({ project: flat, raw_yaml: rawYaml, source: 'minions' });
            }
        }

        // Fallback to direct YAML read
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

// PUT /api/projects/:path — update project YAML (and sync to Minions)
app.put('/api/projects/:projectPath', async (req, res) => {
    try {
        const projectPath = decodeURIComponent(req.params.projectPath);
        const yamlPath = path.join(ROOT, projectPath, 'PROJECT.yaml');
        if (!fs.existsSync(yamlPath)) {
            return res.status(404).json({ error: `PROJECT.yaml not found at ${projectPath}` });
        }
        const { yaml } = req.body;
        if (!yaml) return res.status(400).json({ error: 'Missing yaml content' });

        // Write the YAML file
        fs.writeFileSync(yamlPath, yaml, 'utf-8');

        // Sync to Minions if ready
        if (minionsReady) {
            const mc = getMinions();
            const data = parseYaml(yaml);
            const minions = await listByType('project');
            const match = minions.find(m => m.fields?.path === projectPath);
            if (match) {
                // Update existing minion
                const updated = await mc.update(match, {
                    title: data.name || match.title,
                    description: data.notes || data.description || '',
                    priority: data.priority || 'medium',
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    fields: {
                        ...match.fields,
                        name: data.name || match.title,
                        tier: data.tier || 'idea',
                        lane: data.lane || 'uncategorized',
                        priority: data.priority || 'medium',
                        stack: data.stack || [],
                        oss: data.oss === true,
                        repoUrl: data.repo_url || '',
                        deployUrl: data.deploy_url || '',
                        lastActive: data.last_active || '',
                        notes: data.notes || '',
                    },
                });
                await mc.save(updated.data);
            }
        }

        // Re-scan in background (legacy)
        setTimeout(() => {
            try {
                const statusData = legacyScan();
                fs.writeFileSync(path.join(ROOT, 'status.json'), JSON.stringify(statusData, null, 2));
            } catch { }
        }, 100);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/scan — trigger full re-scan
app.post('/api/scan', async (req, res) => {
    try {
        const data = legacyScan();
        fs.writeFileSync(path.join(ROOT, 'status.json'), JSON.stringify(data, null, 2));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AI Chat Endpoint ───────────────────────────────────────────────────────

// POST /api/ai/chat — AI chat with Minions tool-calling
app.post('/api/ai/chat', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }
        const response = await handleChat(messages);
        res.json({ response });
    } catch (err) {
        console.error('AI chat error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Minions Type Registry Route ────────────────────────────────────────────

// GET /api/minions-types — list all registered types with counts
app.get('/api/minions-types', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const mc = getMinions();
        const registry = getRegistry();
        const allMinions = await mc.listMinions();

        // Count items per type
        const countByType = {};
        for (const m of allMinions) {
            countByType[m.minionTypeId] = (countByType[m.minionTypeId] || 0) + 1;
        }

        // Get all registered types from our custom types (not built-in)
        const { ALL_TYPES } = await import('./minions-adapter.mjs');
        const types = ALL_TYPES.map(t => ({
            slug: t.slug,
            name: t.name,
            icon: t.icon || '📄',
            description: t.description || '',
            count: countByType[t.id] || 0,
        })).filter(t => t.count > 0); // Only show types that have data

        res.json({ types, totalItems: allMinions.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Minions Generic CRUD Routes ────────────────────────────────────────────

// GET /api/minions/:typeSlug — list all minions of a type
app.get('/api/minions/:typeSlug', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const minions = await listByType(req.params.typeSlug);
        res.json({ items: minions.map(minionToFlat), total: minions.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/minions/:typeSlug — create a new minion
app.post('/api/minions/:typeSlug', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const mc = getMinions();
        const { title, description, status, priority, tags, fields } = req.body;
        const wrapper = await mc.create(req.params.typeSlug, {
            title: title || 'Untitled',
            description: description || '',
            status: status || 'active',
            priority: priority || 'medium',
            tags: tags || [],
            fields: fields || {},
        });
        await mc.save(wrapper.data);
        res.status(201).json(minionToFlat(wrapper.data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/minions/:typeSlug/:id — update a minion
app.put('/api/minions/:typeSlug/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const mc = getMinions();
        const existing = await mc.load(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Minion not found' });
        const { title, description, status, priority, tags, fields } = req.body;
        const wrapper = await mc.update(existing, {
            title, description, status, priority, tags, fields,
        });
        await mc.save(wrapper.data);
        res.json(minionToFlat(wrapper.data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/minions/:typeSlug/:id — delete a minion
app.delete('/api/minions/:typeSlug/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const mc = getMinions();
        const existing = await mc.load(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Minion not found' });
        await mc.remove(existing);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/health — server health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        root: ROOT,
        minionsReady,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
    console.log(`🚀 Mission Control API running on http://localhost:${PORT}`);
    console.log(`   Root directory: ${ROOT}`);
    console.log(`   Auth: ${process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled (dev mode)'}`);

    // Initialize Minions if .minions directory exists
    if (fs.existsSync(MINIONS_DIR)) {
        try {
            await initMinions(MINIONS_DIR);
            minionsReady = true;
            console.log(`   📦 Minions: ready (${MINIONS_DIR})`);
        } catch (err) {
            console.warn(`   ⚠️  Minions init failed: ${err.message}`);
            console.log(`   📋 Falling back to legacy PROJECT.yaml scanning`);
        }
    } else {
        console.log(`   📋 Minions: not migrated yet (no .minions directory)`);
        console.log(`      Run: node scripts/migrate-to-minions.mjs ${ROOT}`);
    }
});
