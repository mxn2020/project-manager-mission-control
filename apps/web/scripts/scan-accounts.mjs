#!/usr/bin/env node
/**
 * ACCOUNTS.yaml Scanner
 * 
 * Scans all PROJECT.yaml directories, reads their .env* files,
 * extracts service names from env var patterns, and generates
 * ACCOUNTS.yaml templates for tracking service accounts.
 *
 * Usage: node scripts/scan-accounts.mjs [--force]
 *   --force  Overwrite existing ACCOUNTS.yaml files
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const FORCE = process.argv.includes('--force');

// ─── Service detection patterns ─────────────────────────────────────────────
// Maps env var prefixes → service name
const SERVICE_PATTERNS = [
    { pattern: /^CONVEX/i, service: 'convex' },
    { pattern: /^VITE_CONVEX/i, service: 'convex' },
    { pattern: /^STRIPE/i, service: 'stripe' },
    { pattern: /^OPENAI/i, service: 'openai' },
    { pattern: /^NVIDIA/i, service: 'nvidia' },
    { pattern: /^ANTHROPIC/i, service: 'anthropic' },
    { pattern: /^ELEVENLABS/i, service: 'elevenlabs' },
    { pattern: /^RESEND/i, service: 'resend' },
    { pattern: /^VERCEL/i, service: 'vercel' },
    { pattern: /^NEXT_PUBLIC_VERCEL/i, service: 'vercel' },
    { pattern: /^NETLIFY/i, service: 'netlify' },
    { pattern: /^CLOUDFLARE/i, service: 'cloudflare' },
    { pattern: /^AWS/i, service: 'aws' },
    { pattern: /^GOOGLE/i, service: 'google' },
    { pattern: /^FIREBASE/i, service: 'firebase' },
    { pattern: /^SUPABASE/i, service: 'supabase' },
    { pattern: /^GITHUB/i, service: 'github' },
    { pattern: /^GH_/i, service: 'github' },
    { pattern: /^SENTRY/i, service: 'sentry' },
    { pattern: /^POSTHOG/i, service: 'posthog' },
    { pattern: /^CLERK/i, service: 'clerk' },
    { pattern: /^AUTH0/i, service: 'auth0' },
    { pattern: /^BETTER_AUTH/i, service: 'better-auth' },
    { pattern: /^NEXT_PUBLIC_CLERK/i, service: 'clerk' },
    { pattern: /^TWILIO/i, service: 'twilio' },
    { pattern: /^SENDGRID/i, service: 'sendgrid' },
    { pattern: /^MAILGUN/i, service: 'mailgun' },
    { pattern: /^REDIS/i, service: 'redis' },
    { pattern: /^DATABASE_URL/i, service: 'database' },
    { pattern: /^POSTGRES/i, service: 'postgres' },
    { pattern: /^MONGO/i, service: 'mongodb' },
    { pattern: /^PLANETSCALE/i, service: 'planetscale' },
    { pattern: /^NEON/i, service: 'neon' },
    { pattern: /^TURSO/i, service: 'turso' },
    { pattern: /^UPLOADTHING/i, service: 'uploadthing' },
    { pattern: /^CLOUDINARY/i, service: 'cloudinary' },
    { pattern: /^S3/i, service: 'aws-s3' },
    { pattern: /^PLAUSIBLE/i, service: 'plausible' },
    { pattern: /^REPLICATE/i, service: 'replicate' },
    { pattern: /^HUGGINGFACE/i, service: 'huggingface' },
    { pattern: /^HF_/i, service: 'huggingface' },
    { pattern: /^EXPO_PUBLIC/i, service: 'expo' },
    { pattern: /^SITE_URL/i, service: 'hosting' },
    { pattern: /^DOMAIN/i, service: 'domain' },
];

// ─── Known ignore patterns ──────────────────────────────────────────────────
const SKIP_DIRS = new Set([
    'node_modules', '.git', '.github', '.vscode', '.claude', '.gemini',
    'dist', 'build', '.next', '.output', '.netlify', '.vite', '.tanstack',
    '__pycache__', 'project-dashboard', 'mission-control-app',
]);

// ─── Find all PROJECT.yaml directories ──────────────────────────────────────

function findProjectDirs(dir, maxDepth = 8, depth = 0) {
    const results = [];
    if (depth > maxDepth) return results;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }

    if (fs.existsSync(path.join(dir, 'PROJECT.yaml'))) {
        results.push(dir);
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        results.push(...findProjectDirs(path.join(dir, entry.name), maxDepth, depth + 1));
    }
    return results;
}

// ─── Extract env var names from a .env file ─────────────────────────────────

function extractEnvVars(filePath) {
    const vars = new Set();
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) {
                // Also check commented-out vars (e.g. "# STRIPE_KEY=...")
                const commented = trimmed.replace(/^#\s*/, '');
                const match = commented.match(/^([A-Z][A-Z0-9_]*)\s*=/);
                if (match) vars.add(match[1]);
                continue;
            }
            const match = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*=/);
            if (match) vars.add(match[1]);
        }
    } catch { /* ignore unreadable files */ }
    return vars;
}

// ─── Detect services from env vars ──────────────────────────────────────────

function detectServices(envVars) {
    const services = new Set();
    for (const varName of envVars) {
        for (const { pattern, service } of SERVICE_PATTERNS) {
            if (pattern.test(varName)) {
                services.add(service);
                break;
            }
        }
    }
    return [...services].sort();
}

// ─── Generate ACCOUNTS.yaml ─────────────────────────────────────────────────

function generateAccountsYaml(projectName, services) {
    const lines = [
        `# Accounts for: ${projectName}`,
        `# Fill in the account name/email for each service`,
        ``,
    ];
    for (const service of services) {
        lines.push(`${service}: ""`);
    }
    lines.push('');
    return lines.join('\n');
}

// ─── Read PROJECT.yaml name ─────────────────────────────────────────────────

function getProjectName(dir) {
    try {
        const content = fs.readFileSync(path.join(dir, 'PROJECT.yaml'), 'utf-8');
        const match = content.match(/^name:\s*(.+)/m);
        return match ? match[1].trim() : path.basename(dir);
    } catch {
        return path.basename(dir);
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log(`🔍 Scanning for PROJECT.yaml files in: ${ROOT}`);
console.log(`   Force overwrite: ${FORCE}\n`);

const projectDirs = findProjectDirs(ROOT);
console.log(`📂 Found ${projectDirs.length} projects\n`);

let created = 0, skipped = 0, noServices = 0;

for (const dir of projectDirs) {
    const relPath = path.relative(ROOT, dir);
    const projectName = getProjectName(dir);
    const accountsPath = path.join(dir, 'ACCOUNTS.yaml');

    // Skip if already exists (unless --force)
    if (fs.existsSync(accountsPath) && !FORCE) {
        skipped++;
        continue;
    }

    // Collect env vars from all .env* files
    const allVars = new Set();
    const envFiles = ['.env', '.env.local', '.env.example', '.env.development', '.env.production'];
    for (const envFile of envFiles) {
        const envPath = path.join(dir, envFile);
        if (fs.existsSync(envPath)) {
            for (const v of extractEnvVars(envPath)) allVars.add(v);
        }
    }

    // Also check parent dirs (monorepo root .env files)
    const parentDir = path.dirname(dir);
    if (parentDir !== dir) {
        for (const envFile of envFiles) {
            const envPath = path.join(parentDir, envFile);
            if (fs.existsSync(envPath)) {
                for (const v of extractEnvVars(envPath)) allVars.add(v);
            }
        }
    }

    const services = detectServices(allVars);

    if (services.length === 0) {
        noServices++;
        console.log(`   ⏭  ${relPath} — no services detected`);
        continue;
    }

    // Write ACCOUNTS.yaml
    const yaml = generateAccountsYaml(projectName, services);
    fs.writeFileSync(accountsPath, yaml, 'utf-8');
    created++;
    console.log(`   ✅ ${relPath} — ${services.join(', ')}`);
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Created: ${created}`);
console.log(`   ⏭  Skipped (already exists): ${skipped}`);
console.log(`   ⚠️  No services detected: ${noServices}`);
console.log(`   📂 Total projects: ${projectDirs.length}`);
