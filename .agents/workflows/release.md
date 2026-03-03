---
description: How to create a new release with proper versioning, changelog, tags, and GitHub releases
---

# Release Workflow

Follow these steps **in order** when creating a new release.

## 1. Update CHANGELOG.md

Move items from `[Unreleased]` into a new version section:

```markdown
## [Unreleased]

## [X.Y.Z] — YYYY-MM-DD

### ✨ Features
- **Feature name** — description

### 🐛 Bug Fixes
- **Fix name** — description
```

Update the compare links at the bottom:

```markdown
[Unreleased]: https://github.com/mxn2020/project-manager-mission-control/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/mxn2020/project-manager-mission-control/compare/vPREV...vX.Y.Z
```

## 2. Bump version in package.json

// turbo
```bash
# Edit apps/web/package.json → "version": "X.Y.Z"
```

> **Important**: The floating version badge in the bottom-right corner reads from
> `apps/web/package.json` via Vite's `define` config at startup. After bumping,
> you **must restart the dev server** (`pnpm stop && pnpm dev`) for the badge to
> update. Turbo caches the old version otherwise.

## 3. Commit

// turbo
```bash
git add -A
git commit -m "feat: vX.Y.Z — short summary

- bullet 1
- bullet 2"
```

## 4. Tag

// turbo
```bash
git tag vX.Y.Z
```

## 5. Push with tags

// turbo
```bash
git push origin main --tags
```

This triggers the **release workflow** (`.github/workflows/release.yml`) which:
1. Extracts the changelog section for this version
2. Creates a **GitHub Release** at https://github.com/mxn2020/project-manager-mission-control/releases

## 6. Verify

- Check [GitHub Actions](https://github.com/mxn2020/project-manager-mission-control/actions) for the release workflow run
- Check [GitHub Releases](https://github.com/mxn2020/project-manager-mission-control/releases) for the new release
- Restart the dev server and verify the floating badge shows `vX.Y.Z`

## Quick Reference

| What | Where |
|------|-------|
| Version source | `apps/web/package.json` → `version` |
| Changelog | `CHANGELOG.md` (Keep a Changelog format) |
| Floating badge | `App.tsx` → `__APP_VERSION__` (injected by Vite) |
| Release workflow | `.github/workflows/release.yml` |
| Tags | `git tag vX.Y.Z` format |
| GitHub Releases | Auto-created by workflow on tag push |
