#!/usr/bin/env node
/**
 * Gap Analysis Script for Mission Control
 * 
 * Generates health reports for each project under ROOT directory.
 * Checks: file structure, package.json, README, LICENSE, CI/CD, .env.example, etc.
 * 
 * Usage: node scripts/gap-analysis.mjs [ROOT_DIR]
 * Output: gap-analysis-report.json + gap-analysis-report.md
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.argv[2] || process.cwd();
const OUTPUT_JSON = path.join(ROOT, 'gap-analysis-report.json');
const OUTPUT_MD = path.join(ROOT, 'gap-analysis-report.md');

const SKIP_DIRS = new Set([
    'node_modules', '.git', '.github', '.vscode', '.claude', '.gemini',
    'dist', 'build', '.next', '.output', '.netlify', '.vite', '.tanstack',
    '__pycache__', '.minions',
]);

// ─── YAML Parser (basic) ─────────────────────────────────────────────────────
function parseYaml(content) {
    const obj = {};
    let currentKey = null;
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0 && !line.startsWith('  ') && !line.startsWith('-')) {
            const key = trimmed.substring(0, colonIdx).trim();
            const val = trimmed.substring(colonIdx + 1).trim();
            if (val === '' || val === '|' || val === '>') {
                currentKey = key;
                obj[key] = val === '' ? [] : '';
            } else if (val === 'true') obj[key] = true;
            else if (val === 'false') obj[key] = false;
            else if (val === 'null') obj[key] = null;
            else if (!isNaN(Number(val))) obj[key] = Number(val);
            else obj[key] = val.replace(/^['"]|['"]$/g, '');
            currentKey = key;
        } else if (line.startsWith('  - ') && currentKey) {
            if (!Array.isArray(obj[currentKey])) obj[currentKey] = [];
            obj[currentKey].push(trimmed.substring(2).trim());
        }
    }
    return obj;
}

// ─── Find PROJECT.yaml files ──────────────────────────────────────────────────
function findProjectYamls(dir, maxDepth = 6, depth = 0) {
    if (depth > maxDepth) return [];
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            if (entry.isFile() && entry.name === 'PROJECT.yaml') {
                results.push({ dir, yamlPath: path.join(dir, entry.name) });
            } else if (entry.isDirectory()) {
                results.push(...findProjectYamls(path.join(dir, entry.name), maxDepth, depth + 1));
            }
        }
    } catch { /* permission denied, etc */ }
    return results;
}

// ─── Analyze a Single Project ─────────────────────────────────────────────────
function analyzeProject(projectDir, yamlPath) {
    const relPath = path.relative(ROOT, projectDir);
    const yaml = parseYaml(fs.readFileSync(yamlPath, 'utf-8'));
    const report = {
        path: relPath,
        name: yaml.name || path.basename(projectDir),
        tier: yaml.tier || 'unknown',
        lane: yaml.lane || 'uncategorized',
        priority: yaml.priority || 'unknown',
        checks: {},
        score: 0,
        maxScore: 0,
        grade: '',
    };

    // Check functions: each returns { pass, weight, detail }
    const checks = [
        ['has_readme', 3, () => {
            const readme = ['README.md', 'readme.md', 'README'].find(f => fs.existsSync(path.join(projectDir, f)));
            if (!readme) return { pass: false, detail: 'No README found' };
            const size = fs.statSync(path.join(projectDir, readme)).size;
            return { pass: size > 100, detail: size > 100 ? `${readme} (${size}b)` : `${readme} exists but only ${size}b — too short` };
        }],
        ['has_license', 2, () => {
            const license = ['LICENSE', 'LICENSE.md', 'license'].find(f => fs.existsSync(path.join(projectDir, f)));
            return { pass: !!license, detail: license || 'No LICENSE file' };
        }],
        ['has_gitignore', 1, () => {
            const exists = fs.existsSync(path.join(projectDir, '.gitignore'));
            return { pass: exists, detail: exists ? '.gitignore present' : 'No .gitignore' };
        }],
        ['has_package_json', 3, () => {
            const pkgPath = path.join(projectDir, 'package.json');
            if (!fs.existsSync(pkgPath)) return { pass: false, detail: 'No package.json' };
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const scripts = Object.keys(pkg.scripts || {});
                const deps = Object.keys(pkg.dependencies || {}).length;
                const devDeps = Object.keys(pkg.devDependencies || {}).length;
                return {
                    pass: true,
                    detail: `${deps} deps, ${devDeps} devDeps, scripts: ${scripts.join(', ') || 'none'}`,
                };
            } catch { return { pass: false, detail: 'Invalid package.json' }; }
        }],
        ['has_env_example', 2, () => {
            const envEx = ['.env.example', '.env.sample', '.env.template'].find(f => fs.existsSync(path.join(projectDir, f)));
            return { pass: !!envEx, detail: envEx || 'No .env.example file' };
        }],
        ['has_ci_cd', 2, () => {
            const ghActions = path.join(projectDir, '.github', 'workflows');
            if (fs.existsSync(ghActions)) {
                const workflows = fs.readdirSync(ghActions).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
                return { pass: workflows.length > 0, detail: `GitHub Actions: ${workflows.join(', ')}` };
            }
            // Check for other CI configs
            const ciFiles = ['Dockerfile', '.dockerignore', 'vercel.json', 'netlify.toml', 'railway.json', 'fly.toml'];
            const found = ciFiles.filter(f => fs.existsSync(path.join(projectDir, f)));
            return { pass: found.length > 0, detail: found.length > 0 ? `CI/Deploy: ${found.join(', ')}` : 'No CI/CD configuration' };
        }],
        ['has_tests', 2, () => {
            const testPatterns = [
                'test', 'tests', '__tests__', 'spec', 'specs',
                '*.test.ts', '*.test.tsx', '*.spec.ts', '*.test.js',
            ];
            const testDirs = testPatterns.filter(p => fs.existsSync(path.join(projectDir, p)));
            // Also check for test scripts in package.json
            let hasTestScript = false;
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
                hasTestScript = !!(pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1');
            } catch { }
            const pass = testDirs.length > 0 || hasTestScript;
            return { pass, detail: pass ? `Tests: ${testDirs.join(', ')}${hasTestScript ? ' + test script' : ''}` : 'No test directory or test script' };
        }],
        ['has_src_structure', 2, () => {
            const srcPatterns = ['src', 'app', 'pages', 'components', 'lib', 'server', 'api', 'convex'];
            const found = srcPatterns.filter(p => fs.existsSync(path.join(projectDir, p)));
            return { pass: found.length >= 2, detail: found.length >= 2 ? `Source dirs: ${found.join(', ')}` : `Only ${found.join(', ') || 'none'} found` };
        }],
        ['has_git', 2, () => {
            const hasGit = fs.existsSync(path.join(projectDir, '.git'));
            if (!hasGit) return { pass: false, detail: 'No .git directory' };
            try {
                const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir, stdio: 'pipe' }).toString().trim();
                const commits = execSync('git rev-list --count HEAD', { cwd: projectDir, stdio: 'pipe' }).toString().trim();
                return { pass: true, detail: `branch: ${branch}, ${commits} commits` };
            } catch { return { pass: true, detail: '.git exists (branch info unavailable)' }; }
        }],
        ['yaml_complete', 3, () => {
            const required = ['name', 'description', 'tier', 'lane', 'priority'];
            const missing = required.filter(f => !yaml[f] || yaml[f] === 'null');
            const optional = ['repo', 'deploy_url', 'stack', 'tags'];
            const missingOptional = optional.filter(f => !yaml[f] || yaml[f] === 'null');
            const pass = missing.length === 0;
            let detail = pass ? 'All required fields present' : `Missing: ${missing.join(', ')}`;
            if (missingOptional.length > 0) detail += ` (optional missing: ${missingOptional.join(', ')})`;
            return { pass, detail };
        }],
    ];

    for (const [name, weight, fn] of checks) {
        try {
            const result = fn();
            report.checks[name] = { ...result, weight };
            report.maxScore += weight;
            if (result.pass) report.score += weight;
        } catch (err) {
            report.checks[name] = { pass: false, weight, detail: `Error: ${err.message}` };
            report.maxScore += weight;
        }
    }

    // Calculate percentage and grade
    const pct = Math.round((report.score / report.maxScore) * 100);
    report.percentage = pct;
    if (pct >= 90) report.grade = 'A';
    else if (pct >= 75) report.grade = 'B';
    else if (pct >= 60) report.grade = 'C';
    else if (pct >= 40) report.grade = 'D';
    else report.grade = 'F';

    return report;
}

// ─── Generate Markdown Report ─────────────────────────────────────────────────
function generateMarkdown(reports) {
    const sortedReports = [...reports].sort((a, b) => b.percentage - a.percentage);
    const avgScore = Math.round(reports.reduce((s, r) => s + r.percentage, 0) / reports.length);
    const byGrade = {};
    for (const r of reports) {
        byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
    }

    let md = `# Gap Analysis Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Root:** \`${ROOT}\`\n`;
    md += `**Projects:** ${reports.length}\n`;
    md += `**Average Score:** ${avgScore}%\n\n`;
    md += `## Grade Distribution\n\n`;
    md += `| Grade | Count |\n|-------|-------|\n`;
    for (const g of ['A', 'B', 'C', 'D', 'F']) {
        if (byGrade[g]) md += `| ${g} | ${byGrade[g]} |\n`;
    }
    md += `\n`;

    // Summary table
    md += `## Project Scores\n\n`;
    md += `| Project | Score | Grade | Tier | Lane | Priority |\n`;
    md += `|---------|-------|-------|------|------|----------|\n`;
    for (const r of sortedReports) {
        const bar = '█'.repeat(Math.round(r.percentage / 10)) + '░'.repeat(10 - Math.round(r.percentage / 10));
        md += `| ${r.name} | ${bar} ${r.percentage}% | **${r.grade}** | ${r.tier} | ${r.lane} | ${r.priority} |\n`;
    }
    md += `\n`;

    // Detailed reports for projects with issues
    const withIssues = sortedReports.filter(r => r.percentage < 100);
    if (withIssues.length > 0) {
        md += `## Detailed Findings\n\n`;
        for (const r of withIssues) {
            md += `### ${r.name} (${r.percentage}% — ${r.grade})\n`;
            md += `**Path:** \`${r.path}\`\n\n`;
            const failed = Object.entries(r.checks).filter(([_, c]) => !c.pass);
            if (failed.length > 0) {
                md += `Missing:\n`;
                for (const [name, check] of failed) {
                    md += `- ❌ **${name.replace(/_/g, ' ')}** — ${check.detail}\n`;
                }
            }
            const passed = Object.entries(r.checks).filter(([_, c]) => c.pass);
            if (passed.length > 0) {
                md += `\nPresent:\n`;
                for (const [name, check] of passed) {
                    md += `- ✅ ${name.replace(/_/g, ' ')} — ${check.detail}\n`;
                }
            }
            md += `\n---\n\n`;
        }
    }

    return md;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`🔍 Gap Analysis — scanning ${ROOT}\n`);

const yamls = findProjectYamls(ROOT);
console.log(`   Found ${yamls.length} projects\n`);

const reports = [];
for (const { dir, yamlPath } of yamls) {
    const report = analyzeProject(dir, yamlPath);
    reports.push(report);
    const emoji = report.grade === 'A' ? '🟢' : report.grade === 'B' ? '🔵' : report.grade === 'C' ? '🟡' : report.grade === 'D' ? '🟠' : '🔴';
    console.log(`   ${emoji} ${report.name.padEnd(35)} ${report.percentage}% (${report.grade})  [${report.tier}/${report.lane}]`);
}

// Sort by score
reports.sort((a, b) => b.percentage - a.percentage);

// Write outputs
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(reports, null, 2));
console.log(`\n📄 JSON report: ${OUTPUT_JSON}`);

const md = generateMarkdown(reports);
fs.writeFileSync(OUTPUT_MD, md);
console.log(`📝 Markdown report: ${OUTPUT_MD}`);

// Summary stats
const avg = Math.round(reports.reduce((s, r) => s + r.percentage, 0) / reports.length);
const byGrade = {};
for (const r of reports) byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
console.log(`\n📊 Summary: ${reports.length} projects, avg ${avg}%`);
console.log(`   Grades: ${Object.entries(byGrade).map(([g, c]) => `${g}:${c}`).join('  ')}`);
