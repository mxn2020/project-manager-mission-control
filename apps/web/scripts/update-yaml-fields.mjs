/**
 * update-yaml-fields.mjs
 *
 * Scans all PROJECT.yaml files and adds new fields:
 *   - project_scope: "main" | "child"
 *   - project_type: "standalone" | "monorepo" | "package" | "library"  (main only)
 *   - child_type: "web-app" | "mobile-app" | "docs" | "blog" | "cli" | "sdk" | "package" | "api" | "shared" (child only)
 *   - parent_project: parent project name  (child only)
 *
 * Also fixes malformatted child YAMLs that have escaped newlines.
 *
 * Usage:
 *   node scripts/update-yaml-fields.mjs              # dry-run
 *   node scripts/update-yaml-fields.mjs --write      # actually write files
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname, basename } from "path";

const ROOT = "/Users/mehdinabhani/Projects/antigravity";
const DRY_RUN = !process.argv.includes("--write");

if (DRY_RUN) console.log("🔍 DRY RUN — pass --write to apply changes\n");
else console.log("✏️  WRITE MODE — updating files\n");

// ─── Find all PROJECT.yaml files ────────────────────────────────────────

function findYamlFiles(dir, depth = 0) {
    if (depth > 6) return [];
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

// ─── YAML helpers ───────────────────────────────────────────────────────

function parseYaml(content) {
    const result = {};
    const lines = content.split("\n");
    for (const line of lines) {
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

function serializeYaml(data, orderedKeys) {
    const lines = [];
    for (const key of orderedKeys) {
        if (!(key in data)) continue;
        const val = data[key];
        if (val === null || val === undefined) {
            lines.push(`${key}: null`);
        } else if (typeof val === "boolean") {
            lines.push(`${key}: ${val}`);
        } else if (Array.isArray(val)) {
            if (val.length === 0) {
                lines.push(`${key}: []`);
            } else {
                lines.push(`${key}: [${val.join(", ")}]`);
            }
        } else {
            // Quote strings that contain special chars
            const needsQuoting = /[:#{}[\],&*?|>!'"%@`]/.test(String(val)) || String(val).startsWith("http");
            lines.push(`${key}: ${needsQuoting ? `"${val}"` : val}`);
        }
    }
    return lines.join("\n") + "\n";
}

// ─── Detect child_type from path ────────────────────────────────────────

function inferChildType(relPathFromParent) {
    const parts = relPathFromParent.toLowerCase().split("/");
    const lastDir = parts[parts.length - 1]; // e.g. "web", "cli", "docs"
    const parentDir = parts.length > 1 ? parts[parts.length - 2] : ""; // e.g. "apps", "packages"

    // Direct mappings
    if (lastDir === "web" || lastDir === "webapp") return "web-app";
    if (lastDir === "mobile" || lastDir === "app") return "mobile-app";
    if (lastDir === "desktop") return "desktop-app";
    if (lastDir === "docs" || lastDir === "documentation") return "docs";
    if (lastDir === "blog") return "blog";
    if (lastDir === "cli") return "cli";
    if (lastDir === "sdk" || lastDir === "core") return "sdk";
    if (lastDir === "api" || lastDir === "server") return "api";
    if (lastDir === "shared" || lastDir === "common" || lastDir === "utils") return "shared";
    if (lastDir === "ui") return "package";

    // Fallback based on parent dir
    if (parentDir === "apps") return "web-app";
    if (parentDir === "packages") return "package";

    return "package"; // default
}

// ─── Detect project_type for main projects ──────────────────────────────

function inferProjectType(mainDir, allDirs) {
    // Check if this dir has child PROJECT.yamls
    const hasChildren = [...allDirs.keys()].some(d =>
        d !== mainDir && d.startsWith(mainDir + "/")
    );
    if (hasChildren) return "monorepo";

    // Check for package.json hints
    try {
        const pkg = JSON.parse(readFileSync(join(mainDir, "package.json"), "utf-8"));
        if (pkg.workspaces) return "monorepo";
        if (pkg.main || pkg.exports) return "library";
    } catch { }

    // Check for common monorepo indicators
    try {
        const entries = readdirSync(mainDir);
        if (entries.includes("apps") || entries.includes("packages")) return "monorepo";
        if (entries.includes("pnpm-workspace.yaml") || entries.includes("turbo.json") || entries.includes("lerna.json")) return "monorepo";
    } catch { }

    return "standalone";
}

// ─── Main ───────────────────────────────────────────────────────────────

const yamlFiles = findYamlFiles(ROOT);
console.log(`Found ${yamlFiles.length} PROJECT.yaml files\n`);

// Build directory map
const allDirs = new Map();
for (const f of yamlFiles) {
    allDirs.set(dirname(f), f);
}

// Classify main vs child
const results = { main: 0, child: 0, fixed: 0, skipped: 0 };

// KEY ORDER for serialization
const MAIN_KEYS = ["name", "project_scope", "project_type", "description", "tier", "lane", "priority", "oss", "stack", "repo", "deploy_url", "last_active", "tags", "notes", "category", "focus", "open_tasks", "id", "status", "owner", "npm_packages", "repository"];
const CHILD_KEYS = ["name", "project_scope", "child_type", "parent_project", "description", "tier", "lane", "priority", "oss", "stack", "repo", "deploy_url", "last_active", "tags", "notes", "category", "focus", "open_tasks", "id", "status", "owner"];

for (const f of yamlFiles) {
    const dir = dirname(f);
    const relPath = relative(ROOT, dir);
    let content = readFileSync(f, "utf-8");

    // Fix escaped newlines (malformatted child YAMLs)
    if (content.includes("\\n")) {
        content = content.replace(/\\n/g, "\n");
        results.fixed++;
    }

    const data = parseYaml(content);

    // Skip templates
    if (data.name && String(data.name).includes("{{")) {
        results.skipped++;
        continue;
    }

    // Determine if main or child
    const parts = relPath.split("/");
    let isChild = false;
    let parentDir = "";
    let parentName = "";

    for (let i = parts.length - 1; i >= 1; i--) {
        const ancestorDir = join(ROOT, ...parts.slice(0, i));
        if (allDirs.has(ancestorDir)) {
            isChild = true;
            parentDir = ancestorDir;
            // Read parent's name
            const parentContent = readFileSync(allDirs.get(ancestorDir), "utf-8").replace(/\\n/g, "\n");
            const parentData = parseYaml(parentContent);
            parentName = parentData.name || basename(ancestorDir);
            break;
        }
    }

    if (isChild) {
        data.project_scope = "child";
        data.child_type = inferChildType(relative(parentDir, dir));
        data.parent_project = parentName;
        delete data.project_type; // children don't have project_type
        results.child++;

        const newContent = serializeYaml(data, CHILD_KEYS);
        if (!DRY_RUN) writeFileSync(f, newContent, "utf-8");
    } else {
        data.project_scope = "main";
        data.project_type = inferProjectType(dir, allDirs);
        delete data.child_type;  // main projects don't have child_type
        delete data.parent_project;
        results.main++;

        const newContent = serializeYaml(data, MAIN_KEYS);
        if (!DRY_RUN) writeFileSync(f, newContent, "utf-8");
    }
}

console.log(`Results:`);
console.log(`  Main projects:  ${results.main}`);
console.log(`  Child projects: ${results.child}`);
console.log(`  Fixed (escaped newlines): ${results.fixed}`);
console.log(`  Skipped (templates): ${results.skipped}`);
console.log(`  Total: ${results.main + results.child + results.skipped}`);

if (DRY_RUN) {
    console.log("\n💡 Run with --write to apply changes");
}
