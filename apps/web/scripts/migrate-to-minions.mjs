#!/usr/bin/env node
/**
 * Migration Script: Convert PROJECT.yaml files → Minions format
 * 
 * Reads all PROJECT.yaml files from the project root, converts them to Minions
 * objects, and stores them in a .minions/ directory using YamlFileStorageAdapter.
 * 
 * Usage:
 *   node scripts/migrate-to-minions.mjs [PROJECT_ROOT]
 * 
 * If PROJECT_ROOT is not specified, falls back to:
 *   1. process.env.PROJECT_ROOT
 *   2. Current working directory
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { initMinions, getMinions, getRegistry } from '../server/minions-adapter.mjs';

const PROJECT_ROOT = process.argv[2] || process.env.PROJECT_ROOT || process.cwd();
const MINIONS_DIR = join(PROJECT_ROOT, '.minions');

// ─── Simple YAML parser (same as in server/index.mjs) ──────────────────────

function parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    let currentKey = null;
    let currentArrayKey = null;
    let inMultiline = false;
    let multilineValue = '';

    for (const line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue;

        if (inMultiline) {
            if (line.startsWith('  ') || line.startsWith('\t')) {
                multilineValue += (multilineValue ? '\n' : '') + line.trim();
                continue;
            } else {
                result[currentKey] = multilineValue;
                inMultiline = false;
                multilineValue = '';
            }
        }

        if (line.startsWith('  - ') || line.startsWith('    - ')) {
            const val = line.replace(/^\s+-\s*/, '').trim();
            if (currentArrayKey && Array.isArray(result[currentArrayKey])) {
                result[currentArrayKey].push(val);
            }
            continue;
        }

        const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)/);
        if (match) {
            const [, key, rawVal] = match;
            currentKey = key;
            const val = rawVal.trim();

            if (val === '' || val === '|') {
                if (val === '|') {
                    inMultiline = true;
                    multilineValue = '';
                } else {
                    result[key] = [];
                    currentArrayKey = key;
                }
                continue;
            }

            currentArrayKey = null;

            if (val.startsWith('[') && val.endsWith(']')) {
                result[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            } else if (val === 'true') {
                result[key] = true;
            } else if (val === 'false') {
                result[key] = false;
            } else if (/^\d+$/.test(val)) {
                result[key] = parseInt(val, 10);
            } else if (/^\d+\.\d+$/.test(val)) {
                result[key] = parseFloat(val);
            } else {
                result[key] = val.replace(/^['"]|['"]$/g, '');
            }
        }
    }

    if (inMultiline && currentKey) {
        result[currentKey] = multilineValue;
    }

    return result;
}

// ─── Find all PROJECT.yaml files ────────────────────────────────────────────

function findProjectYamls(root) {
    try {
        const output = execSync(
            `find "${root}" -name "PROJECT.yaml" -not -path "*/node_modules/*" -not -path "*/.git/*" -type f 2>/dev/null`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        return output.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

// ─── Health Score Calculation ───────────────────────────────────────────────

function calculateHealthScore(data) {
    let score = 0;
    if (data.name) score += 10;
    if (data.tier) score += 10;
    if (data.lane) score += 10;
    if (data.priority) score += 10;
    if (data.description || data.notes) score += 10;
    if (data.stack && data.stack.length > 0) score += 10;
    if (data.repo_url || data.deploy_url) score += 15;
    if (data.last_active) score += 15;
    if (data.tags && data.tags.length > 0) score += 5;
    if (data.oss !== undefined) score += 5;
    return Math.min(score, 100);
}

// ─── Main Migration ─────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🚀 Mission Control → Minions Migration`);
    console.log(`   Project Root: ${PROJECT_ROOT}`);
    console.log(`   Minions Dir:  ${MINIONS_DIR}\n`);

    // Initialize Minions
    await initMinions(MINIONS_DIR);
    const mc = getMinions();
    const registry = getRegistry();
    const projectType = registry.getBySlug('project');
    if (!projectType) throw new Error('Project type not found in registry');

    // Check for existing minions
    const existing = await mc.listMinions({ type: projectType.id });
    if (existing.length > 0) {
        console.log(`⚠️  Found ${existing.length} existing project minions. Skipping duplicates.`);
    }
    const existingPaths = new Set(existing.map(m => m.fields?.path));

    // Find all PROJECT.yaml files
    const yamlFiles = findProjectYamls(PROJECT_ROOT);
    console.log(`📂 Found ${yamlFiles.length} PROJECT.yaml files\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const yamlPath of yamlFiles) {
        const relPath = relative(PROJECT_ROOT, yamlPath).replace(/\/PROJECT\.yaml$/, '');

        // Skip if already migrated
        if (existingPaths.has(relPath)) {
            skipped++;
            continue;
        }

        try {
            const content = readFileSync(yamlPath, 'utf-8');
            const data = parseYaml(content);

            const healthScore = calculateHealthScore(data);

            // Sanitize fields
            const notes = typeof data.notes === 'object' ? JSON.stringify(data.notes) : (data.notes || '');
            const repoUrl = typeof data.repo_url === 'string' ? data.repo_url : '';
            const deployUrl = typeof data.deploy_url === 'string' ? data.deploy_url : '';
            const lastActive = typeof data.last_active === 'string' ? data.last_active : '';

            // Create the minion
            const wrapper = await mc.create('project', {
                title: data.name || relPath.split('/').pop(),
                description: typeof data.description === 'string' ? data.description : '',
                status: 'active',
                priority: data.priority || 'medium',
                tags: Array.isArray(data.tags) ? data.tags : [],
                fields: {
                    name: data.name || relPath.split('/').pop(),
                    tier: data.tier || 'idea',
                    lane: data.lane || 'uncategorized',
                    priority: data.priority || 'medium',
                    stack: Array.isArray(data.stack) ? data.stack : [],
                    oss: data.oss === true,
                    repoUrl,
                    deployUrl,
                    lastActive,
                    notes,
                    path: relPath,
                    yamlPath: yamlPath,
                    healthScore,
                },
            });

            await mc.save(wrapper.data);
            created++;

            if (created % 50 === 0) {
                console.log(`   ✅ ${created} projects migrated...`);
            }
        } catch (err) {
            console.error(`   ❌ Error migrating ${relPath}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped} (already existed)`);
    console.log(`   Errors:  ${errors}`);
    console.log(`   Total:   ${created + skipped + errors}\n`);

    // Verify
    const total = await mc.listMinions({ type: projectType.id });
    console.log(`📊 Total project minions in store: ${total.length}`);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
