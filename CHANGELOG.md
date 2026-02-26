# Changelog

All notable changes to Mission Control are documented here.

## [1.0.2] — 2026-02-26

### 🐛 Bug Fixes
- **Ideas page showing all projects** — `listByType()` passed `{ type: type.id }` to `listMinions()`, but the SDK's `StorageFilter` expects `{ minionTypeId: type.id }`. The incorrect field name made the filter a no-op, returning all 245 minions instead of only the requested type.
- **Missing type in API responses** — `minionToFlat()` now includes `type` and `minionTypeId` fields so the frontend can identify each minion's type.

## [1.0.1] — 2026-02-26

### 🐛 Bug Fixes
- **Minions Adapter** — Fixed `client.createMinion is not a function` crash in `minions-adapter.mjs`
  - `createMinion` → `client.create()` + `client.save()`
  - `getMinion` → `client.load()`
  - `updateMinion` → `client.load()` + `client.update()` + `client.save()`
  - `deleteMinion` → `client.load()` + `client.remove()`
- **Ideas API** — Fixed 500 Internal Server Error on `POST /api/ideas` (caused by above)

## [1.0.0] — 2026-02-26

### 🚀 Features
- **Dashboard** — Overview with donut charts (tier/priority), active projects feed, quick actions, create project button
- **Tasks** — Full CRUD task management backed by Minions YAML (`directoryMode: true`)
  - Kanban and List views, priority/project filters, effort tracking
- **Content Planner** — Release-based content plan management with multi-platform items
  - Draft → Planned → In Progress → Published workflow
- **Dependency Graph** — Cross-project dependency analysis
  - Shared Dependencies view with bar chart + detail panel
  - By Project view with tier-colored cards
  - Version conflict detection
- **Automation** — Portfolio automation dashboard
  - Project scan, stale detection (>30 days), git status, health overview
- **OpenClaw Integration** — AgentSkill with 8 functions + CLI mode + setup docs
- **AI Assistant** — Chat with NVIDIA NIM + Minions tool-calling
- **AI Logs** — Searchable log viewer for AI interactions
- **Roadmap** — Pipeline, List, Compact Grid views with category/subcategory filters
- **Integrations** — GitHub integration with clone/pull, status tracking
- **Files** — Project file browser with git awareness
- **Admin** — Data sources configuration (YAML filenames, scan depth, ignore patterns)
- **Minions Browser** — File-tree browser + YAML viewer for Minions data
- **Analytics** — Cross-cutting stats from projects, tasks, content, AI, costs
- **Costs** — Budget tracking and expense management
- **Create Project Wizard** — Directory creation, PROJECT.yaml generation, GitHub repo, Minions sync
- **Gap Analysis** — Node.js script for project health reports (10 checks)
- **SearchableSelect** — Reusable searchable dropdown used across all pages

### 🔒 Security
- API locked down with Convex session token validation
- Auth gate with login/register flows

### 🏗️ Architecture
- Express.js backend with Minions YAML storage (directoryMode)
- React + Vite + Convex frontend
- Hybrid project source: legacy PROJECT.yaml scanner + Minions adapter
- VPS deployment via rsync + PM2

[1.0.2]: https://github.com/mxn2020/project-manager-mission-control/releases/tag/v1.0.2
[1.0.1]: https://github.com/mxn2020/project-manager-mission-control/releases/tag/v1.0.1
[1.0.0]: https://github.com/mxn2020/project-manager-mission-control/releases/tag/v1.0.0
