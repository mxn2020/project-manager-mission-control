#!/usr/bin/env node

/**
 * Seed Convex DB from local PROJECT.yaml files.
 *
 * Usage:
 *   node scripts/seed-from-yaml.mjs
 *
 * Requires: npx convex (configured for dev deployment)
 */

import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = "/Users/mehdinabhani/Projects/antigravity";
const CONVEX_DIR = "/Users/mehdinabhani/Projects/antigravity/claw_ecosystem/mission-control-app/apps/web";
const MAX_DEPTH = 5;
const BATCH_SIZE = 50; // Convex mutation limit

// ─── Simple YAML parser (enough for our PROJECT.yaml format) ─────────────

function parseYaml(content) {
    const result = {};
    for (const line of content.split("\n")) {
        const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
        if (!match) continue;
        const [, key, rawVal] = match;
        let val = rawVal.trim();

        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }

        // Array: [item1, item2]
        if (val.startsWith("[") && val.endsWith("]")) {
            const inner = val.slice(1, -1).trim();
            if (!inner) {
                result[key] = [];
            } else {
                result[key] = inner.split(",").map((s) => {
                    s = s.trim();
                    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                        s = s.slice(1, -1);
                    }
                    return s;
                });
            }
            continue;
        }

        // Boolean
        if (val === "true") { result[key] = true; continue; }
        if (val === "false") { result[key] = false; continue; }

        // Null
        if (val === "null" || val === "~" || val === "") { result[key] = null; continue; }

        result[key] = val;
    }
    return result;
}

// ─── Find all PROJECT.yaml files ─────────────────────────────────────────

function findYamlFiles(dir, depth = 0) {
    if (depth > MAX_DEPTH) return [];
    const files = [];
    try {
        for (const entry of readdirSync(dir)) {
            if (entry.startsWith(".") || entry === "node_modules") continue;
            const full = join(dir, entry);
            try {
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    files.push(...findYamlFiles(full, depth + 1));
                } else if (entry === "PROJECT.yaml") {
                    files.push(full);
                }
            } catch { /* skip inaccessible */ }
        }
    } catch { /* skip inaccessible dirs */ }
    return files;
}

// ─── Run Convex mutation ─────────────────────────────────────────────────

function convexRun(fn, args) {
    const cmd = `npx convex run "${fn}" '${JSON.stringify(args)}'`;
    const result = execSync(cmd, { cwd: CONVEX_DIR, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    // Convex run output may have warnings before the JSON result.
    // The JSON result can span multiple lines. Try to extract it.
    const lines = result.trim().split("\n");

    // Strategy 1: Try parsing from the first { to the last }
    const fullText = result.trim();
    const firstBrace = fullText.indexOf("{");
    const lastBrace = fullText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(fullText.substring(firstBrace, lastBrace + 1));
        } catch { /* not valid JSON block */ }
    }

    // Strategy 2: Try each line
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith("{") || line.startsWith("\"")) {
            try { return JSON.parse(line); } catch { /* not JSON */ }
        }
    }
    return result.trim();
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
    console.log("🔍 Finding PROJECT.yaml files...");
    const yamlFiles = findYamlFiles(ROOT);
    console.log(`   Found ${yamlFiles.length} files\n`);

    // Parse all YAML files
    const projects = [];
    const skippedTemplates = [];

    for (const file of yamlFiles) {
        try {
            const content = readFileSync(file, "utf-8");
            const data = parseYaml(content);

            // Skip templates
            if (data.name?.includes("{{") || file.includes("_template")) {
                skippedTemplates.push(file);
                continue;
            }

            if (!data.name) {
                console.log(`   ⚠️  Skipping (no name): ${file}`);
                continue;
            }

            // Derive lane from path if not set
            let lane = data.lane || "uncategorized";
            const relPath = file.replace(ROOT + "/", "");
            if (lane === "uncategorized") {
                const parts = relPath.split("/");
                if (parts.length > 1) lane = parts[0];
            }

            projects.push({
                name: data.name,
                description: data.description || "",
                tier: data.tier || "idea",
                lane,
                priority: data.priority || "medium",
                oss: data.oss === true,
                stack: Array.isArray(data.stack) ? data.stack : [],
                repo: data.repo && data.repo !== "null" ? data.repo : undefined,
                deployUrl: data.deploy_url && data.deploy_url !== "null" ? data.deploy_url : undefined,
                tags: Array.isArray(data.tags) ? data.tags : [],
                notes: data.notes && data.notes !== "null" ? data.notes : undefined,
            });
        } catch (err) {
            console.log(`   ❌ Error parsing ${file}: ${err.message}`);
        }
    }

    console.log(`📦 Parsed ${projects.length} projects (skipped ${skippedTemplates.length} templates)\n`);

    // Step 1: Create org + admin user
    console.log("🏢 Creating organization...");
    const orgResult = convexRun("seed:seedOrg", {
        orgName: "Antigravity",
        orgSlug: "antigravity",
        adminEmail: "admin@antigravity.dev",
        adminName: "Admin",
        adminPasswordHash: "$2b$10$placeholder_will_need_real_login",
    });
    console.log(`   Org result:`, orgResult);

    const orgId = orgResult.orgId || orgResult;
    if (!orgId) {
        console.error("❌ Failed to get org ID");
        process.exit(1);
    }
    console.log(`   ✅ Org ID: ${orgId}\n`);

    // Step 2: Import projects in batches
    console.log(`📥 Importing ${projects.length} projects in batches of ${BATCH_SIZE}...`);
    let totalCreated = 0;
    let totalSkipped = 0;

    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(projects.length / BATCH_SIZE);

        process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} projects)... `);

        try {
            const result = convexRun("seed:bulkImportProjects", {
                orgId,
                projects: batch,
            });
            totalCreated += result.created || 0;
            totalSkipped += result.skipped || 0;
            console.log(`✅ created: ${result.created}, skipped: ${result.skipped}`);
        } catch (err) {
            console.log(`❌ Error: ${err.message}`);
        }
    }

    console.log(`\n🎉 Done! Created: ${totalCreated}, Skipped: ${totalSkipped}`);
}

main().catch(console.error);
