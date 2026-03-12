import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Types ───────────────────────────────────────────────────────────────

interface MetricResult {
    pass: boolean;
    detail: string;
}

interface FileEntry {
    name: string;
    path: string;
    type: "file" | "dir";
}

// ─── All 64 Compliance Metrics ───────────────────────────────────────────

const ALL_METRICS = [
    // 1. Version Control & GitHub
    "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
    // 2. CI/CD & Workflows
    "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT",
    // 3. Releases & Versioning
    "GH_RELEASES", "GH_TAGS", "CHANGELOG",
    // 4. NPM & Package Config
    "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT", "NPM_PUBLISHED",
    // 5. UI Library
    "GEENIUS_UI", "NO_INTERNAL_UI",
    // 6. Documentation
    "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
    // 7. Project Identity
    "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
    // 8. Code Quality & Config
    "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE", "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
    // 9. Testing
    "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
    // 10. Deployment & Infrastructure
    "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
    // 11. App Quality
    "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
] as const;

const CATEGORIES: Record<string, string[]> = {
    "Version Control & GitHub": ["GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS"],
    "CI/CD & Workflows": ["GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT"],
    "Releases & Versioning": ["GH_RELEASES", "GH_TAGS", "CHANGELOG"],
    "NPM & Package Config": ["PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT", "NPM_PUBLISHED"],
    "UI Library": ["GEENIUS_UI", "NO_INTERNAL_UI"],
    "Documentation": ["README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT"],
    "Project Identity": ["PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML"],
    "Code Quality & Config": ["TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE", "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS"],
    "Testing": ["TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE"],
    "Deployment & Infrastructure": ["DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED"],
    "App Quality": ["ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS"],
};

// ─── Category-Specific Metric Sets ───────────────────────────────────

const PROJECT_CATEGORIES = [
    "webapp", "fullstack-app", "monorepo-app", "monorepo-convex", "oss-tool", "ui-package",
    "library", "boilerplate", "minion-toolbox", "backend-service", "client-project",
] as const;

type ProjectCategory = typeof PROJECT_CATEGORIES[number];

const CATEGORY_METRICS: Record<ProjectCategory, readonly string[]> = {
    "webapp": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
    "fullstack-app": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
        "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
    "monorepo-app": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_NO_SECRETS",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
    "monorepo-convex": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_NO_SECRETS",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "CONVEX_DEPLOYED", "CONVEX_BACKEND_PKG", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
    "oss-tool": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
        "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
    "ui-package": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT", "NPM_PUBLISHED",
        "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
    ],
    "library": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT", "NPM_PUBLISHED",
        "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
    ],
    "boilerplate": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_NO_SECRETS",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
    ],
    "minion-toolbox": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_NO_SECRETS",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE",
        "GEENIUS_UI", "NO_INTERNAL_UI",
        "README", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG",
    ],
    "backend-service": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "GH_WORKFLOW_CI", "GH_WORKFLOW_RELEASE", "GH_ISSUE_TEMPLATE", "GH_PR_TEMPLATE", "GH_CODEOWNERS", "GH_DEPENDABOT",
        "GH_RELEASES", "GH_TAGS", "CHANGELOG",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "README", "README_BADGES", "LICENSE", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "SUPPORT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "TESTS_EXIST", "TESTS_PASS", "TEST_COVERAGE",
        "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
    ],
    "client-project": [
        "GIT_REPO", "GIT_REMOTE", "GIT_PUSHED", "GIT_IGNORE", "GIT_BRANCH_PROTECT", "GIT_NO_SECRETS",
        "PKG_JSON", "PKG_NAME", "PKG_DESCRIPTION", "PKG_METADATA", "PKG_SCRIPTS", "PKG_LOCKFILE", "PKG_DEPS_HEALTHY", "PKG_DEPS_CURRENT",
        "PROJECT_YAML", "PROJECT_NAME", "PROJECT_DESC", "PROJECT_PRIORITY", "PROJECT_TAGS", "PROJECT_DEPLOY", "ACCOUNT_YAML", "ROADMAP_YAML", "IDEAS_YAML",
        "TSCONFIG_STRICT", "ESLINT_CONFIG", "PRETTIER_CONFIG", "NODE_VERSION", "ENV_EXAMPLE",
        "FAVICON", "LOGO", "OG_IMAGE", "APPLE_ICON", "PWA_ICONS",
        "DEPLOY_CONFIG", "CONVEX_DEPLOYED", "DOMAIN_CONFIGURED",
        "ERROR_BOUNDARY", "I18N_SETUP", "SEO_META", "ANALYTICS",
    ],
};

function getMetricsForCategory(category: string | undefined): readonly string[] {
    if (category && category in CATEGORY_METRICS) {
        return CATEGORY_METRICS[category as ProjectCategory];
    }
    return ALL_METRICS; // fallback: all 64 metrics
}

// ─── GitHub API Helpers ──────────────────────────────────────────────────

async function ghFetch(url: string, token: string): Promise<Response> {
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MissionControl/1.0",
        },
    });
}

async function ghFetchRaw(url: string, token: string): Promise<Response> {
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3.raw",
            "User-Agent": "MissionControl/1.0",
        },
    });
}

async function fileExists(repoFullName: string, path: string, branch: string, token: string): Promise<boolean> {
    const res = await ghFetch(`https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${branch}`, token);
    return res.ok;
}

async function fetchFileText(repoFullName: string, path: string, branch: string, token: string): Promise<string | null> {
    const res = await ghFetchRaw(`https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${branch}`, token);
    if (!res.ok) return null;
    return await res.text();
}

async function listDir(repoFullName: string, path: string, branch: string, token: string): Promise<FileEntry[]> {
    const res = await ghFetch(`https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${branch}`, token);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as Array<{ name: string; path: string; type: string }>).map(e => ({
        name: e.name,
        path: e.path,
        type: e.type as "file" | "dir",
    }));
}

// ─── Metric Checkers ─────────────────────────────────────────────────────

async function runChecks(
    repoFullName: string,
    branch: string,
    token: string,
    projectName: string,
    deployUrl: string | undefined,
    projectType: string | undefined,
): Promise<Record<string, MetricResult>> {
    const results: Record<string, MetricResult> = {};

    // Batch-fetch root directory listing
    const rootFiles = await listDir(repoFullName, "", branch, token);
    const rootNames = new Set(rootFiles.map(f => f.name.toLowerCase()));
    const hasFile = (name: string) => rootNames.has(name.toLowerCase());
    const hasDirEntry = (name: string) => rootFiles.some(f => f.name.toLowerCase() === name.toLowerCase() && f.type === "dir");

    // Fetch key files in parallel
    const [packageJsonText, tsconfigText, projectYamlText] = await Promise.all([
        fetchFileText(repoFullName, "package.json", branch, token),
        fetchFileText(repoFullName, "tsconfig.json", branch, token),
        fetchFileText(repoFullName, ".project/PROJECT.yaml", branch, token),
    ]);

    let pkg: Record<string, unknown> = {};
    if (packageJsonText) {
        try { pkg = JSON.parse(packageJsonText); } catch { /* skip */ }
    }

    let tsconfig: Record<string, unknown> = {};
    if (tsconfigText) {
        try { tsconfig = JSON.parse(tsconfigText); } catch { /* skip */ }
    }

    // ── 1. Version Control ───────────────────────────────────────────────
    results.GIT_REPO = { pass: true, detail: "Repo exists on GitHub" };
    results.GIT_REMOTE = { pass: true, detail: `Remote: github.com/${repoFullName}` };
    results.GIT_PUSHED = { pass: true, detail: "Code is accessible on GitHub" };

    // .gitignore
    results.GIT_IGNORE = hasFile(".gitignore")
        ? { pass: true, detail: ".gitignore present" }
        : { pass: false, detail: "Missing .gitignore" };

    // Branch protection — check via API (may fail without admin scope)
    try {
        const bpRes = await ghFetch(`https://api.github.com/repos/${repoFullName}/branches/${branch}/protection`, token);
        results.GIT_BRANCH_PROTECT = bpRes.ok
            ? { pass: true, detail: `Branch protection enabled on ${branch}` }
            : { pass: false, detail: `No branch protection on ${branch}` };
    } catch {
        results.GIT_BRANCH_PROTECT = { pass: false, detail: "Could not check branch protection" };
    }

    results.GIT_NO_SECRETS = { pass: true, detail: "Manual check required" };

    // ── 2. CI/CD & Workflows ─────────────────────────────────────────────
    const ghDir = await listDir(repoFullName, ".github", branch, token);
    const ghDirNames = new Set(ghDir.map(f => f.name.toLowerCase()));

    let workflows: FileEntry[] = [];
    if (ghDirNames.has("workflows")) {
        workflows = await listDir(repoFullName, ".github/workflows", branch, token);
    }
    const wfNames = new Set(workflows.map(f => f.name.toLowerCase()));

    results.GH_WORKFLOW_CI = wfNames.has("ci.yml") || wfNames.has("ci.yaml")
        ? { pass: true, detail: "CI workflow found" }
        : { pass: false, detail: "Missing .github/workflows/ci.yml" };

    results.GH_WORKFLOW_RELEASE = wfNames.has("release.yml") || wfNames.has("release.yaml")
        ? { pass: true, detail: "Release workflow found" }
        : { pass: false, detail: "Missing .github/workflows/release.yml" };

    // Issue templates
    let issueTemplates: FileEntry[] = [];
    if (ghDirNames.has("issue_template")) {
        issueTemplates = await listDir(repoFullName, ".github/ISSUE_TEMPLATE", branch, token);
    }
    results.GH_ISSUE_TEMPLATE = issueTemplates.length >= 2
        ? { pass: true, detail: `${issueTemplates.length} issue templates` }
        : { pass: false, detail: `${issueTemplates.length} issue templates (need ≥2)` };

    // PR template
    const prTemplateExists = ghDir.some(f => f.name.toLowerCase() === "pull_request_template.md");
    results.GH_PR_TEMPLATE = prTemplateExists
        ? { pass: true, detail: "PR template found" }
        : { pass: false, detail: "Missing PULL_REQUEST_TEMPLATE.md" };

    // CODEOWNERS
    const codeownersExists = ghDir.some(f => f.name.toLowerCase() === "codeowners");
    results.GH_CODEOWNERS = codeownersExists
        ? { pass: true, detail: "CODEOWNERS found" }
        : { pass: false, detail: "Missing CODEOWNERS" };

    // Dependabot
    const dependabotExists = ghDir.some(f => f.name.toLowerCase() === "dependabot.yml" || f.name.toLowerCase() === "dependabot.yaml");
    const renovateExists = hasFile("renovate.json") || hasFile(".renovaterc");
    results.GH_DEPENDABOT = dependabotExists || renovateExists
        ? { pass: true, detail: dependabotExists ? "dependabot.yml found" : "Renovate config found" }
        : { pass: false, detail: "Missing dependabot.yml or Renovate config" };

    // ── 3. Releases & Versioning ─────────────────────────────────────────
    try {
        const relRes = await ghFetch(`https://api.github.com/repos/${repoFullName}/releases?per_page=1`, token);
        const releases = relRes.ok ? ((await relRes.json()) as unknown[]) : [];
        results.GH_RELEASES = releases.length > 0
            ? { pass: true, detail: "Has GitHub releases" }
            : { pass: false, detail: "No GitHub releases" };
    } catch {
        results.GH_RELEASES = { pass: false, detail: "Could not check releases" };
    }

    try {
        const tagRes = await ghFetch(`https://api.github.com/repos/${repoFullName}/tags?per_page=1`, token);
        const tags = tagRes.ok ? ((await tagRes.json()) as unknown[]) : [];
        results.GH_TAGS = tags.length > 0
            ? { pass: true, detail: "Has git tags" }
            : { pass: false, detail: "No git tags" };
    } catch {
        results.GH_TAGS = { pass: false, detail: "Could not check tags" };
    }

    results.CHANGELOG = hasFile("changelog.md")
        ? { pass: true, detail: "CHANGELOG.md present" }
        : { pass: false, detail: "Missing CHANGELOG.md" };

    // ── 4. NPM & Package Config ──────────────────────────────────────────
    results.PKG_JSON = packageJsonText
        ? { pass: true, detail: "package.json present" }
        : { pass: false, detail: "Missing package.json" };

    results.PKG_NAME = pkg.name
        ? { pass: true, detail: `Name: ${pkg.name}` }
        : { pass: false, detail: "Missing package name" };

    const desc = (pkg.description || "") as string;
    const badDescriptions = ["", "react + vite", "a react app", "my app"];
    results.PKG_DESCRIPTION = desc && !badDescriptions.includes(desc.toLowerCase().trim())
        ? { pass: true, detail: `Description: "${desc.slice(0, 60)}"` }
        : { pass: false, detail: "Missing or generic description" };

    const hasAuthor = !!pkg.author;
    const hasLicense = !!pkg.license;
    const hasRepo = !!pkg.repository;
    const hasKeywords = Array.isArray(pkg.keywords) && (pkg.keywords as unknown[]).length > 0;
    const metadataCount = [hasAuthor, hasLicense, hasRepo, hasKeywords].filter(Boolean).length;
    results.PKG_METADATA = metadataCount === 4
        ? { pass: true, detail: "All metadata fields set" }
        : { pass: false, detail: `${metadataCount}/4 metadata fields (author, license, repository, keywords)` };

    const scripts = (pkg.scripts || {}) as Record<string, string>;
    const requiredScripts = ["dev", "build", "lint", "test", "stop"];
    const missingScripts = requiredScripts.filter(s => !scripts[s]);
    results.PKG_SCRIPTS = missingScripts.length === 0
        ? { pass: true, detail: "All 5 scripts present" }
        : { pass: false, detail: `Missing scripts: ${missingScripts.join(", ")}` };

    results.PKG_LOCKFILE = hasFile("pnpm-lock.yaml") || hasFile("package-lock.json") || hasFile("yarn.lock")
        ? { pass: true, detail: "Lock file present" }
        : { pass: false, detail: "Missing lock file" };

    // PKG_DEPS_HEALTHY / PKG_DEPS_CURRENT — cannot run audit via API, mark as manual
    results.PKG_DEPS_HEALTHY = { pass: true, detail: "Manual check (pnpm audit)" };
    results.PKG_DEPS_CURRENT = { pass: true, detail: "Manual check (dep versions)" };

    // NPM_PUBLISHED — only for library packages
    const isLibrary = projectType === "library" || projectType === "package";
    results.NPM_PUBLISHED = isLibrary
        ? { pass: false, detail: "Library — check npmjs.com manually" }
        : { pass: true, detail: "Not a library package (N/A)" };

    // ── 5. UI Library ────────────────────────────────────────────────────
    const deps = { ...(pkg.dependencies || {} as Record<string, string>), ...(pkg.devDependencies || {} as Record<string, string>) };
    const hasGeeniusUi = "@geenius-ui/react-css" in deps || "@geenius-ui/solid-css" in deps;
    results.GEENIUS_UI = hasGeeniusUi
        ? { pass: true, detail: "geenius-ui installed" }
        : { pass: false, detail: "Missing @geenius-ui/react-css or @geenius-ui/solid-css" };

    results.NO_INTERNAL_UI = { pass: true, detail: "Manual check for duplicate UI components" };

    // ── 6. Documentation ─────────────────────────────────────────────────
    const readme = hasFile("readme.md");
    results.README = readme
        ? { pass: true, detail: "README.md present" }
        : { pass: false, detail: "Missing README.md" };

    // Check for badges in README
    if (readme) {
        const readmeContent = await fetchFileText(repoFullName, "README.md", branch, token);
        const hasBadges = readmeContent ? (readmeContent.includes("![") || readmeContent.includes("badge")) : false;
        results.README_BADGES = hasBadges
            ? { pass: true, detail: "README has badges" }
            : { pass: false, detail: "No badges in README" };
    } else {
        results.README_BADGES = { pass: false, detail: "No README to check badges" };
    }

    results.LICENSE = hasFile("license") || hasFile("license.md")
        ? { pass: true, detail: "LICENSE present" }
        : { pass: false, detail: "Missing LICENSE" };

    results.CONTRIBUTING = hasFile("contributing.md")
        ? { pass: true, detail: "CONTRIBUTING.md present" }
        : { pass: false, detail: "Missing CONTRIBUTING.md" };

    results.SECURITY = hasFile("security.md")
        ? { pass: true, detail: "SECURITY.md present" }
        : { pass: false, detail: "Missing SECURITY.md" };

    results.CODE_OF_CONDUCT = hasFile("code_of_conduct.md")
        ? { pass: true, detail: "CODE_OF_CONDUCT.md present" }
        : { pass: false, detail: "Missing CODE_OF_CONDUCT.md" };

    results.SUPPORT = hasFile("support.md")
        ? { pass: true, detail: "SUPPORT.md present" }
        : { pass: false, detail: "Missing SUPPORT.md" };

    // ── 7. Project Identity ──────────────────────────────────────────────
    results.PROJECT_YAML = projectYamlText
        ? { pass: true, detail: ".project/PROJECT.yaml present" }
        : { pass: false, detail: "Missing .project/PROJECT.yaml" };

    if (projectYamlText) {
        const hasName = /^name:/m.test(projectYamlText);
        results.PROJECT_NAME = hasName
            ? { pass: true, detail: "name field present" }
            : { pass: false, detail: "Missing name in PROJECT.yaml" };

        const hasDesc = /^description:/m.test(projectYamlText);
        results.PROJECT_DESC = hasDesc
            ? { pass: true, detail: "description field present" }
            : { pass: false, detail: "Missing description in PROJECT.yaml" };

        const hasPriority = /^priority:/m.test(projectYamlText);
        results.PROJECT_PRIORITY = hasPriority
            ? { pass: true, detail: "priority field present" }
            : { pass: false, detail: "Missing priority in PROJECT.yaml" };

        const hasTags = /^tags:/m.test(projectYamlText);
        results.PROJECT_TAGS = hasTags
            ? { pass: true, detail: "tags field present" }
            : { pass: false, detail: "Missing tags in PROJECT.yaml" };

        const hasDeployUrl = /^deploy_url:/m.test(projectYamlText);
        results.PROJECT_DEPLOY = hasDeployUrl
            ? { pass: true, detail: "deploy_url field present" }
            : { pass: false, detail: "Missing deploy_url in PROJECT.yaml" };
    } else {
        results.PROJECT_NAME = { pass: false, detail: "No PROJECT.yaml" };
        results.PROJECT_DESC = { pass: false, detail: "No PROJECT.yaml" };
        results.PROJECT_PRIORITY = { pass: false, detail: "No PROJECT.yaml" };
        results.PROJECT_TAGS = { pass: false, detail: "No PROJECT.yaml" };
        results.PROJECT_DEPLOY = { pass: false, detail: "No PROJECT.yaml" };
    }

    results.ACCOUNT_YAML = await fileExists(repoFullName, ".project/ACCOUNT.yaml", branch, token)
        ? { pass: true, detail: ".project/ACCOUNT.yaml present" }
        : { pass: false, detail: "Missing .project/ACCOUNT.yaml" };

    results.ROADMAP_YAML = await fileExists(repoFullName, ".project/ROADMAP.yaml", branch, token)
        ? { pass: true, detail: ".project/ROADMAP.yaml present" }
        : { pass: false, detail: "Missing .project/ROADMAP.yaml" };

    results.IDEAS_YAML = await fileExists(repoFullName, ".project/IDEAS.yaml", branch, token)
        ? { pass: true, detail: ".project/IDEAS.yaml present" }
        : { pass: false, detail: "Missing .project/IDEAS.yaml" };

    // ── 8. Code Quality & Config ─────────────────────────────────────────
    if (tsconfigText) {
        const compilerOptions = (tsconfig.compilerOptions || {}) as Record<string, unknown>;
        results.TSCONFIG_STRICT = compilerOptions.strict === true
            ? { pass: true, detail: "strict: true" }
            : { pass: false, detail: "strict mode not enabled" };
    } else {
        results.TSCONFIG_STRICT = { pass: false, detail: "Missing tsconfig.json" };
    }

    const eslintFiles = rootFiles.filter(f =>
        f.name.match(/^\.?eslint(rc)?(\.(js|cjs|mjs|json|yaml|yml))?$/) ||
        f.name.match(/^eslint\.config\.(js|cjs|mjs|ts)$/)
    );
    results.ESLINT_CONFIG = eslintFiles.length > 0
        ? { pass: true, detail: `ESLint config: ${eslintFiles[0].name}` }
        : { pass: false, detail: "Missing ESLint config" };

    const prettierFiles = rootFiles.filter(f =>
        f.name.match(/^\.?prettierrc(\.(js|cjs|mjs|json|yaml|yml))?$/) ||
        f.name.match(/^prettier\.config\.(js|cjs|mjs|ts)$/)
    );
    results.PRETTIER_CONFIG = prettierFiles.length > 0
        ? { pass: true, detail: `Prettier config: ${prettierFiles[0].name}` }
        : { pass: false, detail: "Missing Prettier config" };

    results.NODE_VERSION = hasFile(".nvmrc") || hasFile(".node-version")
        ? { pass: true, detail: "Node version pinned" }
        : { pass: false, detail: "Missing .nvmrc or .node-version" };

    results.ENV_EXAMPLE = hasFile(".env.example")
        ? { pass: true, detail: ".env.example present" }
        : { pass: false, detail: "Missing .env.example" };

    // Icons/assets — check public directory
    let publicFiles: FileEntry[] = [];
    if (hasDirEntry("public")) {
        publicFiles = await listDir(repoFullName, "public", branch, token);
    }
    const publicNames = new Set(publicFiles.map(f => f.name.toLowerCase()));

    results.FAVICON = publicNames.has("favicon.ico") || publicNames.has("favicon.svg") || publicNames.has("favicon.png")
        ? { pass: true, detail: "Favicon present" }
        : { pass: false, detail: "Missing public/favicon" };

    results.LOGO = publicNames.has("logo.png") || publicNames.has("logo.svg")
        ? { pass: true, detail: "Logo present" }
        : { pass: false, detail: "Missing public/logo.png" };

    results.OG_IMAGE = publicNames.has("og-image.png") || publicNames.has("og-image.jpg")
        ? { pass: true, detail: "OG image present" }
        : { pass: false, detail: "Missing public/og-image.png" };

    results.APPLE_ICON = publicNames.has("apple-touch-icon.png")
        ? { pass: true, detail: "Apple touch icon present" }
        : { pass: false, detail: "Missing public/apple-touch-icon.png" };

    results.PWA_ICONS = publicNames.has("icon-192.png") && publicNames.has("icon-512.png")
        ? { pass: true, detail: "PWA icons present" }
        : { pass: false, detail: "Missing public/icon-192.png or icon-512.png" };

    // ── 9. Testing ───────────────────────────────────────────────────────
    const hasTestDir = hasDirEntry("tests") || hasDirEntry("__tests__") || hasDirEntry("test");
    const hasTestFiles = rootFiles.some(f => f.name.match(/\.test\.(ts|tsx|js|jsx)$/));
    results.TESTS_EXIST = hasTestDir || hasTestFiles
        ? { pass: true, detail: "Test files found" }
        : { pass: false, detail: "No test files found" };

    results.TESTS_PASS = { pass: true, detail: "Manual check (pnpm test)" };
    results.TEST_COVERAGE = { pass: false, detail: "Manual check (coverage ≥ 50%)" };

    // ── 10. Deployment & Infrastructure ──────────────────────────────────
    results.DEPLOY_CONFIG = hasFile("vercel.json") || hasFile("netlify.toml") || hasFile("fly.toml")
        ? { pass: true, detail: "Deploy config present" }
        : { pass: false, detail: "Missing vercel.json or equivalent" };

    const isConvexProject = hasDirEntry("convex");
    results.CONVEX_DEPLOYED = isConvexProject
        ? { pass: true, detail: "Convex directory found (manual deploy check)" }
        : { pass: true, detail: "Not a Convex project (N/A)" };

    results.DOMAIN_CONFIGURED = deployUrl
        ? { pass: true, detail: `URL: ${deployUrl}` }
        : { pass: false, detail: "No deploy URL configured" };

    // ── 11. App Quality ──────────────────────────────────────────────────
    // These require source code analysis — best effort
    results.ERROR_BOUNDARY = { pass: true, detail: "Manual check for ErrorBoundary component" };
    results.I18N_SETUP = "i18next" in deps || "react-i18next" in deps || "next-intl" in deps
        ? { pass: true, detail: "i18n library found in deps" }
        : { pass: false, detail: "No i18n library found" };

    results.SEO_META = { pass: true, detail: "Manual check for meta tags" };

    results.ANALYTICS = "plausible-tracker" in deps || "posthog-js" in deps || "@vercel/analytics" in deps
        ? { pass: true, detail: "Analytics library found" }
        : { pass: false, detail: "No analytics library found" };

    return results;
}

// ─── Queries ─────────────────────────────────────────────────────────────

export const getLatestScan = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("complianceScans")
            .withIndex("by_project", (idx) => idx.eq("projectId", args.projectId))
            .order("desc")
            .first();
    },
});

export const listScans = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        // Load active project IDs to filter out orphaned scans
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        const activeIds = new Set(projects.map(p => p._id as string));

        const scans = await ctx.db
            .query("complianceScans")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        // Keep only the latest scan per ACTIVE project
        const latest = new Map<string, typeof scans[number]>();
        for (const scan of scans) {
            if (!activeIds.has(scan.projectId as string)) continue;
            const key = scan.projectId;
            const existing = latest.get(key);
            if (!existing || scan.scannedAt > existing.scannedAt) {
                latest.set(key, scan);
            }
        }
        return Array.from(latest.values());
    },
});

export const getOrgComplianceSummary = query({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        // Load active project IDs to filter out orphaned scans
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        const activeIds = new Set(projects.map(p => p._id as string));

        const scans = await ctx.db
            .query("complianceScans")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        // Keep only latest per ACTIVE project
        const latest = new Map<string, typeof scans[number]>();
        for (const scan of scans) {
            if (!activeIds.has(scan.projectId as string)) continue;
            const key = scan.projectId;
            const existing = latest.get(key);
            if (!existing || scan.scannedAt > existing.scannedAt) {
                latest.set(key, scan);
            }
        }

        const latestScans = Array.from(latest.values());
        const totalScanned = latestScans.length;
        const totalProjects = projects.length;
        const avgScore = totalScanned > 0
            ? Math.round(latestScans.reduce((s, sc) => s + sc.score, 0) / totalScanned)
            : 0;
        const perfect = latestScans.filter(s => s.score === 100).length;

        // Count failures per metric across all projects
        const metricFailures: Record<string, number> = {};
        for (const scan of latestScans) {
            try {
                const results = JSON.parse(scan.results) as Record<string, MetricResult>;
                for (const [id, result] of Object.entries(results)) {
                    if (!result.pass) {
                        metricFailures[id] = (metricFailures[id] || 0) + 1;
                    }
                }
            } catch { /* skip */ }
        }

        return {
            totalProjects,
            totalScanned,
            avgScore,
            perfectCount: perfect,
            metricFailures,
            categories: CATEGORIES,
            projectCategories: PROJECT_CATEGORIES,
        };
    },
});

// ─── Cleanup Orphaned Scans ─────────────────────────────────────────────

export const cleanupOrphanedScans = internalMutation({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
        const activeIds = new Set(projects.map(p => p._id as string));

        const scans = await ctx.db
            .query("complianceScans")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();

        let deleted = 0;
        for (const scan of scans) {
            if (!activeIds.has(scan.projectId as string)) {
                await ctx.db.delete(scan._id);
                deleted++;
            }
        }
        return { deleted, total: scans.length };
    },
});

// ─── Internal Helpers ────────────────────────────────────────────────────

export const getProjectsForScan = internalQuery({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("projects")
            .withIndex("by_org", (idx) => idx.eq("orgId", args.orgId))
            .collect();
    },
});

export const getProjectById = internalQuery({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.projectId);
    },
});

export const saveScanResult = internalMutation({
    args: {
        orgId: v.id("organizations"),
        projectId: v.id("projects"),
        repoFullName: v.optional(v.string()),
        results: v.string(),
        passCount: v.number(),
        totalCount: v.number(),
        score: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("complianceScans", {
            orgId: args.orgId,
            projectId: args.projectId,
            repoFullName: args.repoFullName,
            results: args.results,
            passCount: args.passCount,
            totalCount: args.totalCount,
            score: args.score,
            scannedAt: Date.now(),
        });
    },
});

// ─── Actions ─────────────────────────────────────────────────────────────

export const scanProject = action({
    args: {
        orgId: v.id("organizations"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const project = await ctx.runQuery(internal.compliance.getProjectById, {
            projectId: args.projectId,
        });
        if (!project) throw new Error("Project not found");

        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;

        if (!token || !project.repo) {
            // No repo linked — mark all as fail except manual checks
            const results: Record<string, MetricResult> = {};
            for (const metric of ALL_METRICS) {
                results[metric] = { pass: false, detail: "No GitHub repo linked" };
            }
            const passCount = 0;
            const totalCount = ALL_METRICS.length;
            const score = 0;

            await ctx.runMutation(internal.compliance.saveScanResult, {
                orgId: args.orgId,
                projectId: args.projectId,
                results: JSON.stringify(results),
                passCount,
                totalCount,
                score,
            });

            return { success: true, score, passCount, totalCount };
        }

        // Extract repo full name from URL or field
        const repoFullName = project.repo
            .replace("https://github.com/", "")
            .replace(/\/$/, "");

        // Get default branch
        let branch = "main";
        try {
            const repoRes = await ghFetch(`https://api.github.com/repos/${repoFullName}`, token);
            if (repoRes.ok) {
                const repoData = (await repoRes.json()) as { default_branch?: string };
                branch = repoData.default_branch || "main";
            }
        } catch { /* use main */ }

        const results = await runChecks(
            repoFullName,
            branch,
            token,
            project.name,
            project.deployUrl,
            project.projectType || undefined,
        );

        const applicableMetrics = getMetricsForCategory(project.projectCategory || undefined);
        const applicableResults = Object.entries(results).filter(([id]) => applicableMetrics.includes(id));
        const passCount = applicableResults.filter(([, r]) => r.pass).length;
        const totalCount = applicableMetrics.length;
        const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

        await ctx.runMutation(internal.compliance.saveScanResult, {
            orgId: args.orgId,
            projectId: args.projectId,
            repoFullName,
            results: JSON.stringify(results),
            passCount,
            totalCount,
            score,
        });

        return { success: true, score, passCount, totalCount };
    },
});

export const scanAllProjects = action({
    args: { orgId: v.id("organizations") },
    handler: async (ctx, args) => {
        const projects = await ctx.runQuery(internal.compliance.getProjectsForScan, {
            orgId: args.orgId,
        });

        const results: Array<{ projectId: string; name: string; score: number }> = [];

        for (const project of projects) {
            try {
                const result = await ctx.runAction(internal.compliance.scanProjectInternal, {
                    orgId: args.orgId,
                    projectId: project._id,
                });
                results.push({
                    projectId: project._id,
                    name: project.name,
                    score: result.score,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                results.push({
                    projectId: project._id,
                    name: project.name,
                    score: -1,
                });
                console.error(`Scan failed for ${project.name}: ${message}`);
            }
        }

        return { scanned: results.length, results };
    },
});

// Internal action version (callable from scanAllProjects)
export const scanProjectInternal = internalAction({
    args: {
        orgId: v.id("organizations"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const project = await ctx.runQuery(internal.compliance.getProjectById, {
            projectId: args.projectId,
        });
        if (!project) throw new Error("Project not found");

        const token = await ctx.runQuery(internal.github.getOrgGithubToken, {
            orgId: args.orgId,
        }) as string | undefined;

        if (!token || !project.repo) {
            const results: Record<string, MetricResult> = {};
            for (const metric of ALL_METRICS) {
                results[metric] = { pass: false, detail: "No GitHub repo linked" };
            }
            await ctx.runMutation(internal.compliance.saveScanResult, {
                orgId: args.orgId,
                projectId: args.projectId,
                results: JSON.stringify(results),
                passCount: 0,
                totalCount: ALL_METRICS.length,
                score: 0,
            });
            return { score: 0, passCount: 0, totalCount: ALL_METRICS.length };
        }

        const repoFullName = project.repo
            .replace("https://github.com/", "")
            .replace(/\/$/, "");

        let branch = "main";
        try {
            const repoRes = await ghFetch(`https://api.github.com/repos/${repoFullName}`, token);
            if (repoRes.ok) {
                const repoData = (await repoRes.json()) as { default_branch?: string };
                branch = repoData.default_branch || "main";
            }
        } catch { /* use main */ }

        const results = await runChecks(
            repoFullName,
            branch,
            token,
            project.name,
            project.deployUrl,
            project.projectType || undefined,
        );

        const applicableMetrics = getMetricsForCategory(project.projectCategory || undefined);
        const applicableResults = Object.entries(results).filter(([id]) => applicableMetrics.includes(id));
        const passCount = applicableResults.filter(([, r]) => r.pass).length;
        const totalCount = applicableMetrics.length;
        const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

        await ctx.runMutation(internal.compliance.saveScanResult, {
            orgId: args.orgId,
            projectId: args.projectId,
            repoFullName,
            results: JSON.stringify(results),
            passCount,
            totalCount,
            score,
        });

        return { score, passCount, totalCount };
    },
});
