# Mission Control — Monorepo

A project management dashboard built with a Turborepo monorepo structure.

## Structure

```
.
├── apps/
│   ├── web/          # Vite + React web app (full-featured dashboard)
│   └── mobile/       # Expo React Native mobile app
├── packages/
│   ├── types/        # Shared TypeScript types & design tokens
│   ├── api/          # Shared API client (fetch-based, platform agnostic)
│   └── hooks/        # Shared React hooks (useProjectsData, useTasksData, useIsMobile)
├── turbo.json        # Turborepo configuration
└── package.json      # Workspace root
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+ (with workspaces support)

### Install dependencies

```bash
npm install
```

### Start the web app (development)

```bash
npm run dev:web
# or
cd apps/web && npm run dev
```

### Start the mobile app

```bash
cd apps/mobile && npx expo start
```

## Apps

### Web App (`apps/web`)

Full-featured dashboard with:
- Project overview, grid, table, kanban, and focus views
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
npm run build        # Build all apps
npm run lint         # Lint all packages
```

