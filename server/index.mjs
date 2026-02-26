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
import { initMinions, getMinions, getRegistry, listByType, minionToFlat, createMinion, getMinion, updateMinion, deleteMinion, isMinionsReady } from './minions-adapter.mjs';
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
    if (req.path === '/health') return next();

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

// ─── Scanner Configuration ──────────────────────────────────────────────────

const CONFIG_FILE = path.join(ROOT, '.mc-config.json');
const DEFAULT_CONFIG = {
    yamlFilenames: ['PROJECT.yaml'],
    maxScanDepth: 8,
    ignorePatterns: [
        'node_modules', '.git', '.github', '.vscode', '.claude', '.gemini',
        'dist', 'build', '.next', '.output', '.netlify', '.vite', '.tanstack',
        '__pycache__', 'project-dashboard', 'mission-control-app',
    ],
    scanSubfolders: false,        // look for YAMLs in subfolder (e.g. .meta/)
    scanSubfolderName: '.meta',   // subfolder name if scanSubfolders is true
};

let scannerConfig = { ...DEFAULT_CONFIG };

// Load persisted config
try {
    if (fs.existsSync(CONFIG_FILE)) {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        scannerConfig = { ...DEFAULT_CONFIG, ...saved };
    }
} catch { /* use defaults */ }

function saveScannerConfig() {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(scannerConfig, null, 2)); } catch { }
}

const SKIP_DIRS = new Set(scannerConfig.ignorePatterns);

function findProjectYamls(dir, maxDepth = scannerConfig.maxScanDepth, currentDepth = 0) {
    const results = [];
    if (currentDepth > maxDepth) return results;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }

    // Check for YAML files matching configured filenames
    for (const yamlName of scannerConfig.yamlFilenames) {
        // Direct path
        const yamlPath = path.join(dir, yamlName);
        if (fs.existsSync(yamlPath)) {
            try {
                const content = fs.readFileSync(yamlPath, 'utf-8');
                const data = parseYaml(content);
                data._path = path.relative(ROOT, dir);
                data._yamlPath = path.relative(ROOT, yamlPath);
                data._absolutePath = dir;
                data._yamlFile = yamlName;
                results.push(data);
            } catch (err) {
                console.warn(`⚠️  Failed to parse ${yamlPath}: ${err.message}`);
            }
            break; // Only one YAML per project dir
        }
        // Subfolder path (e.g. .meta/PROJECT.yaml)
        if (scannerConfig.scanSubfolders && scannerConfig.scanSubfolderName) {
            const subPath = path.join(dir, scannerConfig.scanSubfolderName, yamlName);
            if (fs.existsSync(subPath)) {
                try {
                    const content = fs.readFileSync(subPath, 'utf-8');
                    const data = parseYaml(content);
                    data._path = path.relative(ROOT, dir);
                    data._yamlPath = path.relative(ROOT, subPath);
                    data._absolutePath = dir;
                    data._yamlFile = yamlName;
                    results.push(data);
                } catch (err) {
                    console.warn(`⚠️  Failed to parse ${subPath}: ${err.message}`);
                }
                break;
            }
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

// POST /api/projects — create a new project
app.post('/api/projects', async (req, res) => {
    try {
        const { name, lane, tier, priority, description, stack, oss, repo, deploy_url } = req.body;
        if (!name || !lane) return res.status(400).json({ error: 'Name and lane are required' });

        // Determine path: lane/name (lowercase, hyphenated)
        const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const projectPath = `${lane}/${safeName}`;
        const absDir = path.resolve(ROOT, projectPath);

        // Check for duplicates
        if (fs.existsSync(absDir) && fs.existsSync(path.join(absDir, 'PROJECT.yaml'))) {
            return res.status(409).json({ error: `Project already exists at ${projectPath}` });
        }

        // Create directory
        fs.mkdirSync(absDir, { recursive: true });

        // Generate PROJECT.yaml
        const yamlContent = toYaml({
            name,
            description: description || '',
            tier: tier || 'idea',
            lane,
            priority: priority || 'medium',
            oss: oss || false,
            stack: stack || [],
            repo: repo || null,
            deploy_url: deploy_url || null,
            tags: [],
            notes: '',
        });

        fs.writeFileSync(path.join(absDir, 'PROJECT.yaml'), yamlContent, 'utf-8');

        // Sync to Minions if ready
        if (minionsReady) {
            try {
                const mc = getMinions();
                const reg = getRegistry();
                const type = reg.get('project');
                if (type) {
                    const wrapper = mc.create(type.typeSlug, {
                        name, description: description || '', tier: tier || 'idea', lane,
                        priority: priority || 'medium', oss: oss || false,
                        stack: (stack || []).join(', '), repo: repo || null,
                        deploy_url: deploy_url || null, tags: '', notes: '',
                        path: projectPath, yaml_path: `${projectPath}/PROJECT.yaml`,
                        last_active: new Date().toISOString().split('T')[0],
                        health_score: 0,
                    });
                    await mc.save(wrapper.data);
                }
            } catch { /* best effort */ }
        }

        // Re-scan in background
        setTimeout(() => {
            try {
                const statusData = legacyScan();
                fs.writeFileSync(path.join(ROOT, 'status.json'), JSON.stringify(statusData, null, 2));
            } catch { }
        }, 100);

        res.status(201).json({ success: true, path: projectPath });
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

// ─── Scanner Config API ─────────────────────────────────────────────────────

// GET /api/config — get current scanner configuration
app.get('/api/config', (req, res) => {
    res.json(scannerConfig);
});

// PUT /api/config — update scanner configuration
app.put('/api/config', (req, res) => {
    try {
        const updates = req.body;
        // Validate
        if (updates.yamlFilenames && !Array.isArray(updates.yamlFilenames)) {
            return res.status(400).json({ error: 'yamlFilenames must be an array' });
        }
        if (updates.ignorePatterns && !Array.isArray(updates.ignorePatterns)) {
            return res.status(400).json({ error: 'ignorePatterns must be an array' });
        }
        if (updates.maxScanDepth !== undefined && (typeof updates.maxScanDepth !== 'number' || updates.maxScanDepth < 1 || updates.maxScanDepth > 20)) {
            return res.status(400).json({ error: 'maxScanDepth must be 1-20' });
        }
        // Merge
        Object.assign(scannerConfig, updates);
        // Update SKIP_DIRS from new config
        SKIP_DIRS.clear();
        for (const p of scannerConfig.ignorePatterns) SKIP_DIRS.add(p);
        saveScannerConfig();
        res.json(scannerConfig);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/config/reset — reset config to defaults
app.post('/api/config/reset', (req, res) => {
    Object.assign(scannerConfig, DEFAULT_CONFIG);
    SKIP_DIRS.clear();
    for (const p of DEFAULT_CONFIG.ignorePatterns) SKIP_DIRS.add(p);
    saveScannerConfig();
    res.json(scannerConfig);
});

// ─── Tasks API (Minions-backed) ─────────────────────────────────────────────

// GET /api/tasks — list tasks with optional filters
app.get('/api/tasks', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('mc-task');
        let tasks = all.map(minionToFlat);

        // Apply filters
        const { status, priority, project } = req.query;
        if (status) tasks = tasks.filter(t => t.status === status);
        if (priority) tasks = tasks.filter(t => t.priority === priority);
        if (project) tasks = tasks.filter(t => t.projectPath === project);

        // Sort by updatedAt descending
        tasks.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tasks/stats — task statistics
app.get('/api/tasks/stats', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('mc-task');
        const tasks = all.map(minionToFlat);
        const byStatus = {};
        const byPriority = {};
        const byProject = {};
        for (const t of tasks) {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            if (t.projectPath) byProject[t.projectPath] = (byProject[t.projectPath] || 0) + 1;
        }
        res.json({ total: tasks.length, byStatus, byPriority, byProject });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tasks — create task
app.post('/api/tasks', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { projectPath, title, description, taskType, status, priority, effort, dueDate, tags } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        const task = await createMinion('mc-task', {
            title,
            description: description || '',
            status: status || 'todo',
            priority: priority || 'medium',
            tags: tags || [],
            projectPath: projectPath || '',
            taskType: taskType || 'feature',
            effort: effort || 'M',
            dueDate: dueDate || null,
        });
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/tasks/:id — update task
app.put('/api/tasks/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const task = await updateMinion(req.params.id, req.body);
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/tasks/:id — delete task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        await deleteMinion(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Content API (Minions-backed) ───────────────────────────────────────────

// GET /api/content — list content plans
app.get('/api/content', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('contentPlan');
        let plans = all.map(m => {
            const flat = minionToFlat(m);
            // Parse items from JSON string if stored
            if (flat.items && typeof flat.items === 'string') {
                try { flat.items = JSON.parse(flat.items); } catch { flat.items = []; }
            }
            if (!flat.items) flat.items = [];
            return flat;
        });

        const { status, project } = req.query;
        if (status) plans = plans.filter(p => p.status === status);
        if (project) plans = plans.filter(p => p.projectPath === project);

        plans.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/content/stats — content statistics
app.get('/api/content/stats', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('contentPlan');
        const plans = all.map(minionToFlat);
        const byStatus = {};
        const byPlatform = {};
        let totalItems = 0;
        for (const p of plans) {
            byStatus[p.status] = (byStatus[p.status] || 0) + 1;
            let items = [];
            if (p.items) {
                try { items = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []); } catch { }
            }
            totalItems += items.length;
            for (const item of items) {
                if (item.platform) byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;
            }
        }
        res.json({ totalPlans: plans.length, totalItems, byStatus, byPlatform });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/content — create content plan
app.post('/api/content', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { projectPath, releaseTag, releaseTitle, releaseNotes, releaseDate } = req.body;
        if (!projectPath || !releaseTag) return res.status(400).json({ error: 'projectPath and releaseTag required' });

        const plan = await createMinion('contentPlan', {
            title: releaseTitle || releaseTag,
            description: releaseNotes || '',
            status: 'draft',
            projectPath,
            releaseTag,
            releaseTitle: releaseTitle || '',
            releaseNotes: releaseNotes || '',
            releaseDate: releaseDate || null,
            items: '[]',
        });
        plan.items = [];
        res.status(201).json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/content/:id — update content plan
app.put('/api/content/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const updates = { ...req.body };
        // If items is an array, serialize to JSON string for storage
        if (Array.isArray(updates.items)) {
            updates.items = JSON.stringify(updates.items);
        }
        const plan = await updateMinion(req.params.id, updates);
        // Parse items back for response
        if (plan.items && typeof plan.items === 'string') {
            try { plan.items = JSON.parse(plan.items); } catch { plan.items = []; }
        }
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/content/:id — delete content plan
app.delete('/api/content/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        await deleteMinion(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/content/:id/items — add item to content plan
app.post('/api/content/:id/items', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const existing = await getMinion(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Plan not found' });

        let items = [];
        if (existing.items) {
            try { items = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items; } catch { }
        }

        const newItem = {
            _id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            platform: req.body.platform || 'twitter',
            content: req.body.content || '',
            status: 'draft',
            scheduledAt: req.body.scheduledAt || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        items.push(newItem);

        await updateMinion(req.params.id, { items: JSON.stringify(items) });
        res.status(201).json(newItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/content/:id/items/:itemId — update item in content plan
app.put('/api/content/:id/items/:itemId', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const existing = await getMinion(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Plan not found' });

        let items = [];
        if (existing.items) {
            try { items = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items; } catch { }
        }

        const idx = items.findIndex(i => i._id === req.params.itemId);
        if (idx === -1) return res.status(404).json({ error: 'Item not found' });

        items[idx] = { ...items[idx], ...req.body, updatedAt: Date.now() };
        await updateMinion(req.params.id, { items: JSON.stringify(items) });
        res.json(items[idx]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Workflows API (Minions-backed) ─────────────────────────────────────────

function parseSteps(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

app.get('/api/workflows', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('mc-workflow');
        let workflows = all.map(m => {
            const flat = minionToFlat(m);
            flat.steps = parseSteps(flat.steps);
            return flat;
        });
        const { category, project } = req.query;
        if (category) workflows = workflows.filter(w => w.category === category);
        if (project) workflows = workflows.filter(w => (w.linkedProjects || []).includes(project));
        workflows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        res.json(workflows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/workflows', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { title, description, category, steps, linkedProjects, isTemplate, schedule } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const wf = await createMinion('mc-workflow', {
            title, description: description || '', status: 'active',
            category: category || 'custom',
            steps: JSON.stringify(steps || []),
            linkedProjects: linkedProjects || [],
            isTemplate: isTemplate || false,
            schedule: schedule || '',
            tags: linkedProjects || [],
        });
        wf.steps = parseSteps(wf.steps);
        res.status(201).json(wf);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/workflows/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const updates = { ...req.body };
        if (Array.isArray(updates.steps)) updates.steps = JSON.stringify(updates.steps);
        if (Array.isArray(updates.linkedProjects)) updates.tags = updates.linkedProjects;
        const wf = await updateMinion(req.params.id, updates);
        wf.steps = parseSteps(wf.steps);
        res.json(wf);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workflows/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        await deleteMinion(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Ideas API (Minions-backed) ─────────────────────────────────────────────

app.get('/api/ideas', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('mc-idea');
        let ideas = all.map(minionToFlat);
        const { category, search, archived } = req.query;
        if (category) ideas = ideas.filter(i => i.category === category);
        if (archived === 'true') ideas = ideas.filter(i => i.archived);
        else if (archived !== 'all') ideas = ideas.filter(i => !i.archived);
        if (search) {
            const q = search.toLowerCase();
            ideas = ideas.filter(i =>
                (i.title || '').toLowerCase().includes(q) ||
                (i.body || '').toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q) ||
                (i.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }
        ideas.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        res.json(ideas);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ideas', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { title, body, category, score, tags, linkedProjects } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const idea = await createMinion('mc-idea', {
            title, description: body || '', status: 'active',
            body: body || '', category: category || 'other',
            score: score || 5, archived: false,
            linkedIdeas: [], linkedProjects: linkedProjects || [],
            tags: tags || [],
        });
        res.status(201).json(idea);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ideas/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const idea = await updateMinion(req.params.id, req.body);
        res.json(idea);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ideas/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        await deleteMinion(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Wiki API (Minions-backed) ──────────────────────────────────────────────

app.get('/api/wiki', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const all = await listByType('mc-wiki-article');
        let articles = all.map(minionToFlat);
        const { category, scope, search } = req.query;
        if (category) articles = articles.filter(a => a.category === category);
        if (scope) articles = articles.filter(a => a.scope === scope);
        if (search) {
            const q = search.toLowerCase();
            articles = articles.filter(a =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.body || '').toLowerCase().includes(q) ||
                (a.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }
        articles.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        res.json(articles);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/wiki', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { title, body, category, scope, tags, relatedArticles, linkedProjects } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const article = await createMinion('mc-wiki-article', {
            title, description: (body || '').slice(0, 200),
            status: 'active', body: body || '',
            category: category || 'reference', scope: scope || 'general',
            relatedArticles: relatedArticles || [],
            linkedProjects: linkedProjects || [],
            tags: tags || [],
        });
        res.status(201).json(article);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/wiki/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const article = await updateMinion(req.params.id, req.body);
        res.json(article);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/wiki/:id', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        await deleteMinion(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Dependency Graph API ───────────────────────────────────────────────────

// Cached project data for dep graph + automation (refreshes every 60s)
let cachedStatusData = null;
let cachedStatusDataAt = 0;
function getStatusData() {
    const now = Date.now();
    if (!cachedStatusData || now - cachedStatusDataAt > 60_000) {
        cachedStatusData = legacyScan();
        cachedStatusDataAt = now;
    }
    return cachedStatusData;
}

app.get('/api/dependencies', async (req, res) => {
    try {
        const projects = getStatusData()?.projects || [];
        const depGraph = { nodes: [], links: [], packages: {} };

        for (const project of projects) {
            const projectDir = path.join(ROOT, project.path);
            const pkgPath = path.join(projectDir, 'package.json');

            try {
                if (!fs.existsSync(pkgPath)) continue;
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                const depNames = Object.keys(deps);

                depGraph.nodes.push({
                    id: project.path,
                    name: project.name,
                    tier: project.tier,
                    lane: project.lane,
                    depCount: depNames.length,
                    deps: Object.entries(deps).map(([name, version]) => ({ name, version })),
                });

                for (const [depName, version] of Object.entries(deps)) {
                    if (!depGraph.packages[depName]) {
                        depGraph.packages[depName] = { name: depName, usedBy: [], versions: new Set() };
                    }
                    depGraph.packages[depName].usedBy.push(project.path);
                    depGraph.packages[depName].versions.add(version);
                }
            } catch { /* skip unreadable */ }
        }

        // Convert Set to Array for JSON
        for (const pkg of Object.values(depGraph.packages)) {
            pkg.versions = [...pkg.versions];
        }

        // Build links: projects sharing the same dependencies
        const sharedDeps = Object.entries(depGraph.packages)
            .filter(([, pkg]) => pkg.usedBy.length > 1)
            .sort(([, a], [, b]) => b.usedBy.length - a.usedBy.length);

        for (const [depName, pkg] of sharedDeps) {
            for (let i = 0; i < pkg.usedBy.length; i++) {
                for (let j = i + 1; j < pkg.usedBy.length; j++) {
                    depGraph.links.push({
                        source: pkg.usedBy[i],
                        target: pkg.usedBy[j],
                        dep: depName,
                    });
                }
            }
        }

        // Summary stats
        const summary = {
            totalProjects: depGraph.nodes.length,
            totalPackages: Object.keys(depGraph.packages).length,
            sharedPackages: sharedDeps.length,
            topShared: sharedDeps.slice(0, 20).map(([name, pkg]) => ({
                name,
                count: pkg.usedBy.length,
                versions: pkg.versions,
            })),
            avgDeps: depGraph.nodes.length > 0
                ? Math.round(depGraph.nodes.reduce((s, n) => s + n.depCount, 0) / depGraph.nodes.length)
                : 0,
        };

        res.json({ ...depGraph, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Automation API ─────────────────────────────────────────────────────────

let lastAutomationRun = null;

app.post('/api/automation/run', async (req, res) => {
    try {
        const results = { startedAt: new Date().toISOString(), steps: [] };

        // Step 1: Re-scan projects
        try {
            const data = await scanProjects();
            results.steps.push({ name: 'scan', status: 'success', projects: data.total_projects });
        } catch (err) {
            results.steps.push({ name: 'scan', status: 'error', error: err.message });
        }

        // Step 2: Stale detection (>30 days no activity)
        const staleProjects = (getStatusData()?.projects || [])
            .filter(p => {
                if (!p.last_active) return true;
                const daysSince = (Date.now() - new Date(p.last_active).getTime()) / (1000 * 60 * 60 * 24);
                return daysSince > 30;
            })
            .map(p => ({ path: p.path, name: p.name, lastActive: p.last_active, tier: p.tier }));
        results.steps.push({ name: 'stale_detection', status: 'success', staleCount: staleProjects.length, staleProjects: staleProjects.slice(0, 20) });

        // Step 3: Git status check (uncommitted changes)
        const gitStatus = [];
        for (const p of (getStatusData()?.projects || []).slice(0, 30)) {
            const projectDir = path.join(ROOT, p.path);
            try {
                if (!fs.existsSync(path.join(projectDir, '.git'))) continue;
                const status = execSync('git status --porcelain 2>/dev/null', { cwd: projectDir, encoding: 'utf-8', timeout: 5000 }).trim();
                if (status) {
                    gitStatus.push({ path: p.path, name: p.name, changes: status.split('\n').length });
                }
            } catch { /* not a git repo or error */ }
        }
        results.steps.push({ name: 'git_status', status: 'success', dirtyCount: gitStatus.length, dirtyProjects: gitStatus });

        // Step 4: Health overview
        const healthBuckets = { excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0 };
        for (const p of (getStatusData()?.projects || [])) {
            const h = p.health_score || 0;
            if (h >= 80) healthBuckets.excellent++;
            else if (h >= 60) healthBuckets.good++;
            else if (h >= 40) healthBuckets.fair++;
            else if (h > 0) healthBuckets.poor++;
            else healthBuckets.unknown++;
        }
        results.steps.push({ name: 'health_overview', status: 'success', buckets: healthBuckets });

        results.completedAt = new Date().toISOString();
        lastAutomationRun = results;
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/automation/status', (req, res) => {
    res.json(lastAutomationRun || { message: 'No automation run yet' });
});

// ─── AI Config Endpoint ─────────────────────────────────────────────────────

async function convexQueryDirect(path, args = {}) {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, args, format: 'json' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value;
}

// GET /api/ai/config — get active AI configuration for user
app.get('/api/ai/config', async (req, res) => {
    try {
        const userId = req.user?.id || undefined;
        const config = await convexQueryDirect('aiConfig:getActiveConfig', { userId });
        if (!config) {
            return res.json({
                model: process.env.AI_MODEL || 'meta/llama-3.1-70b-instruct',
                provider: { name: 'NVIDIA NIM', slug: 'nvidia' },
                temperature: 0.7,
                maxTokens: 2048,
                toolsEnabled: true,
                configured: false,
            });
        }
        res.json({ ...config, configured: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/logs — list AI logs with pagination
app.get('/api/ai/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await convexQueryDirect('aiLogs:listLogs', { limit });
        res.json(logs || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/logs/stats — aggregated AI usage stats
app.get('/api/ai/logs/stats', async (req, res) => {
    try {
        const stats = await convexQueryDirect('aiLogs:getStats', {});
        res.json(stats || { totalCalls: 0, totalTokens: 0, totalCostCents: 0, errorCount: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AI Chat Endpoint ───────────────────────────────────────────────────────

// POST /api/ai/chat — AI chat with Minions tool-calling
app.post('/api/ai/chat', async (req, res) => {
    try {
        if (!minionsReady) return res.status(503).json({ error: 'Minions not initialized' });
        const { messages, sessionId } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }
        const userId = req.user?.id || undefined;
        const result = await handleChat(messages, { userId, sessionId });
        res.json(result);
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
        uptime: process.uptime(),
    });
});

// ─── Clone Status Tracking ──────────────────────────────────────────────────

const CLONE_STATUS_FILE = path.join(ROOT, '.clone-status.json');
const cloneStatuses = new Map(); // path → { status, repo, error?, startedAt?, completedAt? }

// Load persisted clone statuses on startup
try {
    if (fs.existsSync(CLONE_STATUS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(CLONE_STATUS_FILE, 'utf-8'));
        for (const [k, v] of Object.entries(saved)) cloneStatuses.set(k, v);
    }
} catch { /* ignore corrupt file */ }

function saveCloneStatuses() {
    try {
        const obj = Object.fromEntries(cloneStatuses);
        fs.writeFileSync(CLONE_STATUS_FILE, JSON.stringify(obj, null, 2));
    } catch { /* best effort */ }
}

// Auto-detect already-cloned projects (have .git directory)
function detectClonedProjects() {
    try {
        const yamls = findProjectYamls(ROOT);
        for (const { dir } of yamls) {
            const relPath = path.relative(ROOT, dir);
            const gitDir = path.join(dir, '.git');
            if (fs.existsSync(gitDir) && !cloneStatuses.has(relPath)) {
                cloneStatuses.set(relPath, { status: 'cloned', repo: null, completedAt: new Date().toISOString() });
            }
        }
        saveCloneStatuses();
    } catch { /* ignore */ }
}

// GET /api/clone-status — get all clone statuses
app.get('/api/clone-status', (req, res) => {
    res.json(Object.fromEntries(cloneStatuses));
});

// GET /api/clone-status/:path — get clone status for one project
app.get('/api/clone-status/:projectPath', (req, res) => {
    const projectPath = decodeURIComponent(req.params.projectPath);
    const status = cloneStatuses.get(projectPath);
    if (status) return res.json(status);
    // Check if dir exists on disk
    const absPath = path.resolve(ROOT, projectPath);
    if (fs.existsSync(absPath) && fs.existsSync(path.join(absPath, '.git'))) {
        const s = { status: 'cloned', repo: null, completedAt: new Date().toISOString() };
        cloneStatuses.set(projectPath, s);
        saveCloneStatuses();
        return res.json(s);
    }
    res.json({ status: 'not_cloned' });
});

// POST /api/projects/:path/clone — clone a repo into the project folder
app.post('/api/projects/:projectPath/clone', async (req, res) => {
    try {
        const projectPath = decodeURIComponent(req.params.projectPath);
        const targetDir = path.resolve(ROOT, projectPath);

        // Security check
        if (!targetDir.startsWith(path.resolve(ROOT))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Find repo URL — check request body first, then scan project YAML
        let repoUrl = req.body?.repo;
        if (!repoUrl) {
            // Try to find from project data
            try {
                if (minionsReady) {
                    const minions = await listByType('project');
                    const match = minions.find(m => m.fields?.path === projectPath);
                    if (match?.fields?.repo && match.fields.repo !== 'null') {
                        repoUrl = match.fields.repo;
                    }
                }
                if (!repoUrl) {
                    // Fallback: check PROJECT.yaml
                    const yamlPath = path.join(targetDir, 'PROJECT.yaml');
                    if (fs.existsSync(yamlPath)) {
                        const data = parseYaml(fs.readFileSync(yamlPath, 'utf-8'));
                        if (data.repo && data.repo !== 'null') repoUrl = data.repo;
                    }
                }
            } catch { /* ignore lookup errors */ }
        }

        if (!repoUrl) {
            return res.status(400).json({ error: 'No repository URL found. Provide "repo" in request body or set it in PROJECT.yaml.' });
        }

        // Check if already cloned
        if (fs.existsSync(path.join(targetDir, '.git'))) {
            // Already cloned — do a pull instead
            cloneStatuses.set(projectPath, { status: 'cloning', repo: repoUrl, startedAt: new Date().toISOString() });
            saveCloneStatuses();
            res.json({ status: 'pulling', message: 'Repository exists, pulling latest changes...' });

            // Pull async
            try {
                execSync('git pull --ff-only', { cwd: targetDir, timeout: 30000, stdio: 'pipe' });
                cloneStatuses.set(projectPath, { status: 'cloned', repo: repoUrl, completedAt: new Date().toISOString() });
            } catch (err) {
                cloneStatuses.set(projectPath, { status: 'error', repo: repoUrl, error: err.message, completedAt: new Date().toISOString() });
            }
            saveCloneStatuses();
            return;
        }

        // Set status to cloning
        cloneStatuses.set(projectPath, { status: 'cloning', repo: repoUrl, startedAt: new Date().toISOString() });
        saveCloneStatuses();

        // Respond immediately, clone async
        res.json({ status: 'cloning', message: `Cloning ${repoUrl} into ${projectPath}...` });

        // Ensure parent dir exists
        const parentDir = path.dirname(targetDir);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // Clone in background
        try {
            const dirName = path.basename(targetDir);
            execSync(`git clone ${repoUrl} ${dirName}`, { cwd: parentDir, timeout: 120000, stdio: 'pipe' });
            cloneStatuses.set(projectPath, { status: 'cloned', repo: repoUrl, completedAt: new Date().toISOString() });
        } catch (err) {
            cloneStatuses.set(projectPath, { status: 'error', repo: repoUrl, error: err.stderr?.toString() || err.message, completedAt: new Date().toISOString() });
        }
        saveCloneStatuses();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── File Browser Endpoint ──────────────────────────────────────────────────

// GET /api/files/:path — list directory or get file content
app.get('/api/files/:filePath', async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.params.filePath);
        const absPath = path.resolve(ROOT, filePath);

        // Security: prevent directory traversal
        if (!absPath.startsWith(path.resolve(ROOT))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(absPath)) {
            // Check if project exists in registry but isn't cloned
            const cloneStatus = cloneStatuses.get(filePath);
            if (cloneStatus?.status === 'cloning') {
                return res.status(202).json({ error: 'Clone in progress', status: 'cloning' });
            }
            return res.status(404).json({ error: 'Path not found. This project may need to be cloned first.', status: 'not_cloned' });
        }

        const stat = fs.statSync(absPath);

        if (stat.isDirectory()) {
            const items = fs.readdirSync(absPath)
                .filter(name => !name.startsWith('.') && name !== 'node_modules' && name !== '__pycache__' && name !== 'dist')
                .map(name => {
                    const itemPath = path.join(absPath, name);
                    try {
                        const itemStat = fs.statSync(itemPath);
                        return {
                            name,
                            path: path.relative(ROOT, itemPath),
                            type: itemStat.isDirectory() ? 'directory' : 'file',
                            size: itemStat.isFile() ? itemStat.size : undefined,
                        };
                    } catch {
                        return { name, path: name, type: 'file' };
                    }
                })
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
            return res.json({ entries: items });
        }

        // File content
        if (req.query.content === 'true') {
            if (stat.size > 500000) {
                return res.json({ content: '(File too large to display)' });
            }
            const content = fs.readFileSync(absPath, 'utf-8');
            return res.json({ content });
        }

        res.json({ name: path.basename(absPath), size: stat.size, type: 'file' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Integrations: Git Status ───────────────────────────────────────────────

app.get('/api/integrations/git-status', async (req, res) => {
    try {
        const statuses = {};
        const yamls = findProjectYamls(ROOT);

        for (const { dir } of yamls.slice(0, 50)) {
            try {
                const gitDir = path.join(dir, '.git');
                if (!fs.existsSync(gitDir)) continue;

                const projectPath = path.relative(ROOT, dir);
                const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, timeout: 3000 }).toString().trim();
                const status = execSync('git status --porcelain', { cwd: dir, timeout: 3000 }).toString().trim();
                const lastCommit = execSync('git log -1 --format=%s', { cwd: dir, timeout: 3000 }).toString().trim();
                const lastDate = execSync('git log -1 --format=%aI', { cwd: dir, timeout: 3000 }).toString().trim();

                statuses[projectPath] = {
                    branch,
                    hasChanges: status.length > 0,
                    changedFiles: status ? status.split('\n').length : 0,
                    lastCommit,
                    lastCommitDate: lastDate,
                };
            } catch { /* skip projects with git errors */ }
        }

        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start Server ──────────────────────────────────────────────────────────────────

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

    // Detect already-cloned projects
    detectClonedProjects();
    console.log(`   🔗 Clone status: ${cloneStatuses.size} projects tracked`);
});
