#!/usr/bin/env node

/**
 * Seed Convex DB from local PROJECT.yaml files.
 *
 * Usage:
 *   node scripts/seed-from-yaml.mjs                # import all (main + child)
 *   node scripts/seed-from-yaml.mjs --clear        # clear existing projects first
 *
 * Requires: npx convex (configured for dev deployment)
 */

import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname, basename } from "path";

const ROOT = "/Users/mehdinabhani/Projects/antigravity";
const CONVEX_DIR = "/Users/mehdinabhani/Projects/antigravity/claw_ecosystem/mission-control-app/apps/web";
const MAX_DEPTH = 6;
const BATCH_SIZE = 50;
const CLEAR_FIRST = process.argv.includes("--clear");

// ─── Simple YAML parser ─────────────────────────────────────────────────

function parseYaml(content) {
    const result = {};
    for (const line of content.split("\n")) {
        const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
        if (!match) continue;
        const [, key, rawVal] = match;
        let val = rawVal.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        if (val.startsWith("[") && val.endsWith("]")) {
            const inner = val.slice(1, -1).trim();
            result[key] = inner ? inner.split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")) : [];
            continue;
        }
        if (val === "true") { result[key] = true; continue; }
        if (val === "false") { result[key] = false; continue; }
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
                if (stat.isDirectory()) files.push(...findYamlFiles(full, depth + 1));
                else if (entry === "PROJECT.yaml") files.push(full);
            } catch { }
        }
    } catch { }
    return files;
}

// ─── Run Convex mutation ─────────────────────────────────────────────────

function convexRun(fn, args) {
    const cmd = `npx convex run "${fn}" '${JSON.stringify(args)}'`;
    const result = execSync(cmd, { cwd: CONVEX_DIR, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    const fullText = result.trim();
    const firstBrace = fullText.indexOf("{");
    const lastBrace = fullText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try { return JSON.parse(fullText.substring(firstBrace, lastBrace + 1)); } catch { }
    }
    const lines = fullText.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith("{") || line.startsWith("\"")) {
            try { return JSON.parse(line); } catch { }
        }
    }
    return fullText;
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
                tags: Array.isArray(data.tags) ? data.tags.filter(t => t && t !== "null") : [],
                notes: data.notes && data.notes !== "null" ? data.notes : undefined,
                // New fields
                projectScope: data.project_scope || "main",
                projectType: data.project_type || undefined,
                childType: data.child_type || undefined,
                parentProject: data.parent_project || undefined,
            });
        } catch (err) {
            console.log(`   ❌ Error parsing ${file}: ${err.message}`);
        }
    }

    const mainCount = projects.filter(p => p.projectScope === "main").length;
    const childCount = projects.filter(p => p.projectScope === "child").length;
    console.log(`📦 Parsed ${projects.length} projects (${mainCount} main, ${childCount} child, skipped ${skippedTemplates.length} templates)\n`);

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

    // Step 1.5: Clear existing projects if --clear flag is set
    if (CLEAR_FIRST) {
        console.log("🗑️  Clearing existing projects...");
        const clearResult = convexRun("seed:clearAllProjects", { orgId });
        console.log(`   ✅ Deleted: ${clearResult.deleted || 0}\n`);
    }

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
