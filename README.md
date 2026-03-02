# Mission Control

[![CI](https://github.com/mxn2020/project-manager-mission-control/actions/workflows/ci.yml/badge.svg)](https://github.com/mxn2020/project-manager-mission-control/actions/workflows/ci.yml)
[![License: BSL-1.1](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/mxn2020/project-manager-mission-control)](https://github.com/mxn2020/project-manager-mission-control/releases)

A project management dashboard built with a Turborepo monorepo structure.

## Structure

```
.
├── .github/           # CI/CD workflows, issue & PR templates, Dependabot
├── apps/
│   ├── web/           # Vite + React web app (full-featured dashboard)
│   └── mobile/        # Expo React Native mobile app
├── packages/
│   ├── types/         # Shared TypeScript types & design tokens
│   ├── api/           # Shared API client (fetch-based, platform agnostic)
│   └── hooks/         # Shared React hooks
├── turbo.json         # Turborepo configuration
└── package.json       # Workspace root (pnpm)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+ (`corepack enable` to activate)

### Install dependencies

```bash
pnpm install
```

### Start the web app (development)

```bash
pnpm dev:web
# or
cd apps/web && pnpm dev
```

### Start the mobile app

```bash
cd apps/mobile && npx expo start
```

## Apps

### Web App (`apps/web`)

Full-featured dashboard with:
- Project overview, grid, table, **tree**, kanban, and focus views
- Task management with kanban/list views
- AI chat assistant (powered by Convex)
- Content planner, ideas, wiki, roadmap
- Analytics, costs, admin settings
- **Fully responsive** — dialogs on desktop, full-page routes on mobile

#### Mobile-Specific Routes (web)

| Route | Purpose |
|-------|---------| 
| `/projects/new` | Full-page create project form (mobile) |
| `/tasks/new` | Full-page create task form (mobile) |
| `/projects/delete/:path` | Full-page delete confirmation (mobile) |

On desktop, create/delete actions use modal dialogs instead.

### Mobile App (`apps/mobile`)

React Native app built with Expo featuring:
- Dashboard with project statistics
- Task list with create/update/delete
- Projects browser with search & filters
- AI assistant screen

#### Setup

1. Copy `.env.example` to `.env.local` in `apps/mobile/`
2. Set `EXPO_PUBLIC_API_URL` to your server URL

## Packages

### `@mission-control/types`

Shared TypeScript types and configuration:
- `Project`, `Task`, `StatusData` interfaces
- `TIER_CONFIG`, `PRIORITY_CONFIG` lookup tables
- `colors` design token constants
- `WORKSPACES` navigation config

### `@mission-control/api`

Platform-agnostic API client factory:

```ts
import { createApiClient } from '@mission-control/api';

const api = createApiClient({
  baseUrl: 'http://localhost:3001',
  getAuthToken: () => localStorage.getItem('token'),
});

const projects = await api.projects.list();
const tasks = await api.tasks.list({ status: 'in_progress' });
```

### `@mission-control/hooks`

Shared React hooks:
- `useProjectsData(api)` — load project data with loading/error state
- `useTasksData(api, filters)` — load filtered tasks
- `useIsMobile()` — responsive breakpoint detection
- `useMediaQuery(query)` — generic media query hook

## Build

```bash
pnpm turbo run build     # Build all apps
pnpm turbo run lint      # Lint all packages
```

## Deployment (VPS via rsync + PM2)

Mission Control is designed to run on a single VPS. Deployment uses `rsync` to sync files and `PM2` for process management.

### Environment Setup

Copy `.env.vps` and configure your server details:

```bash
# .env.vps (not committed — see .env.example for template)
MC_SSH_HOST=your.server.ip
MC_SSH_USER=root
MC_SSH_KEY=~/.ssh/id_your_key
MC_VPS_PATH=/root/Projects/mission-control-app
```

### Deploy with rsync

```bash
# Sync the built app to VPS
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .turbo \
  --exclude .env.local \
  -e "ssh -i $MC_SSH_KEY" \
  ./ ${MC_SSH_USER}@${MC_SSH_HOST}:${MC_VPS_PATH}/

# SSH in and restart
ssh -i $MC_SSH_KEY ${MC_SSH_USER}@${MC_SSH_HOST} \
  "cd ${MC_VPS_PATH} && pnpm install --frozen-lockfile && pnpm turbo run build && pm2 restart mission-control"
```

### PM2 Process

On the VPS, the Express API server runs under PM2:

```bash
# First-time setup
pm2 start server/index.mjs --name mission-control
pm2 save

# Restart after deploy
pm2 restart mission-control
```

## Authentication

Mission Control is a **single-user application**. There are two ways to access it:

### 1. Login Screen (Owner Only)

The web app shows a login screen. Only the owner account (created during first-time setup) can sign in. The first visit triggers a one-time account creation flow.

### 2. Agent Token (Programmatic / URL Access)

For programmatic access (e.g., AI agents, automation), append `?agent_token=<secret>` to the URL:

```
http://your-server/?agent_token=<AGENT_SECRET>
```

The `AGENT_SECRET` is configured in your Convex deployment:

```bash
npx convex env set AGENT_SECRET <your-secret>
```

This token auto-authenticates without the login screen — useful for browser-based agents or bookmarks.

## Versioning & Releases

This project uses [Semantic Versioning](https://semver.org/) with git tags:

1. Add changes under `[Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md)
2. When ready to release, rename `[Unreleased]` to `[x.y.z] — YYYY-MM-DD`
3. Tag the commit: `git tag v1.0.3`
4. Push the tag: `git push --tags`
5. The [Release workflow](.github/workflows/release.yml) auto-creates a GitHub Release with the changelog body

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure policy.

## License

This project is licensed under the [Business Source License 1.1](LICENSE) (BSL-1.1).

- **Non-production use** (testing, development, evaluation) is permitted
- **Production use** requires a commercial license until the Change Date (2030-02-28)
- After the Change Date, the license converts to Apache 2.0
