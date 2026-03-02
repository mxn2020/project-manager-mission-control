# Contributing to Mission Control

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 10+ (`corepack enable` to activate)
- A running [Convex](https://www.convex.dev/) project (for backend features)

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/project-manager-mission-control.git
cd project-manager-mission-control

# 2. Install dependencies
pnpm install

# 3. Copy environment config
cp .env.example .env.local

# 4. Start the dev server
pnpm dev:web
```

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or: fix/some-bug, docs/update-readme, chore/cleanup
   ```

2. **Make your changes** following the code style below.

3. **Verify locally**:
   ```bash
   pnpm turbo run build      # Ensure everything compiles
   pnpm turbo run lint        # Lint check
   ```

4. **Add a changelog entry** under `[Unreleased]` in `CHANGELOG.md`.

5. **Open a Pull Request** against `main`.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix     | Purpose                          |
|------------|----------------------------------|
| `feat:`    | New feature                      |
| `fix:`     | Bug fix                          |
| `docs:`    | Documentation only               |
| `style:`   | Formatting, no logic change      |
| `refactor:`| Code change, no feature/fix      |
| `test:`    | Adding or updating tests         |
| `chore:`   | Build, CI, tooling changes       |

Example: `feat: add tree view to dashboard`

## Project Structure

```
apps/
  web/         → Vite + React web dashboard
  mobile/      → Expo React Native app
packages/
  types/       → Shared TypeScript types & design tokens
  api/         → Platform-agnostic API client
  hooks/       → Shared React hooks
```

## Code Style

- **TypeScript** for all new code
- **Functional components** with hooks (no class components)
- **CSS** in `index.css` using the existing design token system (`var(--accent)`, etc.)
- Keep components focused — one per file when possible
- Use existing patterns: check `GridPage.tsx`, `TablePage.tsx`, `KanbanPage.tsx` for reference

## Versioning & Releases

We use [SemVer](https://semver.org/) with git tags:

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to a new version section
2. Tag the commit: `git tag v1.0.3`
3. Push the tag: `git push --tags`
4. The [Release workflow](.github/workflows/release.yml) auto-creates a GitHub Release

## Reporting Issues

- Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template for bugs
- Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template for ideas
- Check existing issues before opening a new one

## License

By contributing, you agree that your contributions will be licensed under the project's [BSL-1.1 License](../LICENSE).
