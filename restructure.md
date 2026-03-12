# Mission Control — Unified Workflow Restructure

> **Goal:** Transform the five silo'd modules (Ideas, Roadmap, Marketing, Content, Tasks) into an interconnected product lifecycle system with two primary workflows and a new "Development" page. Reorganise project metadata files into a `.project/` folder per repo.

---

## Table of Contents

1. [Context & Current State](#1-context--current-state)
2. [Target Architecture](#2-target-architecture)
3. [Phase 1 — Data Model & Schema Changes](#3-phase-1--data-model--schema-changes)
4. [Phase 2 — `.project/` Folder & YAML Files](#4-phase-2--project-folder--yaml-files)
5. [Phase 3 — Ideas Page Enhancements](#5-phase-3--ideas-page-enhancements)
6. [Phase 4 — Roadmap Page Overhaul](#6-phase-4--roadmap-page-overhaul)
7. [Phase 5 — New Development Page](#7-phase-5--new-development-page)
8. [Phase 6 — Marketing Page Restructure](#8-phase-6--marketing-page-restructure)
9. [Phase 7 — Content Page Expansion](#9-phase-7--content-page-expansion)
10. [Phase 8 — Tasks Page Unification](#10-phase-8--tasks-page-unification)
11. [Phase 9 — Navigation & Sidebar Updates](#11-phase-9--navigation--sidebar-updates)
12. [Phase 10 — Cross-Module Workflows](#12-phase-10--cross-module-workflows)
13. [Phase 11 — AI Chatbot Integration](#13-phase-11--ai-chatbot-integration)
14. [Phase 12 — UI Component Audit](#14-phase-12--ui-component-audit)
15. [Verification & Acceptance Criteria](#15-verification--acceptance-criteria)

---

## 1. Context & Current State

**Mission Control** is a developer-first project management dashboard (Turborepo monorepo, Convex backend, React web app).

### Current modules & their problems

| Module | Location | Current State | Problem |
|--------|----------|--------------|---------|
| **Ideas** | `/ideas` | Cards/pipeline/list/kanban/canvas views. Can "promote to task". | Cannot promote to feature/roadmap item. No AI brainstorm chatbot. No "create marketing strategy" action. |
| **Roadmap** | `/roadmap` | Shows **projects** by tier (Idea→MVP→Growth→Scale). | Does NOT manage **features**. It is a project lifecycle view, not a feature roadmap. No feature CRUD. |
| **Marketing** | `/marketing` | 4 tabs: Strategies, Pipeline, Calendar, Cross-Project. Has `marketingTasks` table. | Pipeline/Calendar/Cross-Project tabs belong in Content, not Marketing. Marketing should focus on **strategies & campaigns**. |
| **Content** | `/content` | Release content planner (`contentPlans` + `contentItems`). | Only handles release announcements. Should become the full content pipeline (calendar, cross-project, scheduling, publishing). |
| **Tasks** | `/tasks` | Kanban/list with `tasks` table. | Has `taskType` field but doesn't differentiate between dev tasks, marketing tasks, etc. No link to features or marketing campaigns. |

### Key data tables (Convex `schema.ts`)

- `ideas` — title, body, category, score, tags, linkedProjects, status
- `tasks` — title, description, taskType, status, priority, effort, projectId
- `marketingPlans` — title, category, budget, goals, linkedProjects, channels
- `marketingStrategies` — name, projectCategory, channels, contentTypes, cadence, tactics
- `marketingTasks` — platform, contentType, tone, status pipeline (idea→draft→review→scheduled→posted)
- `contentPlans` + `contentItems` — release-based content planning
- `workflows` — generic workflow templates

---

## 2. Target Architecture

### Two primary workflows

```
┌─────────┐     promote      ┌───────────┐     apply       ┌────────────┐     generate     ┌─────────┐
│  IDEAS   │ ──────────────→  │  ROADMAP   │ ──────────────→ │ MARKETING  │ ──────────────→  │ CONTENT │
│          │                  │ (features) │                  │(strategies │                  │(pipeline│
│brainstorm│                  │            │                  │ campaigns) │                  │calendar)│
└─────────┘                  └─────┬──────┘                  └────────────┘                  └─────────┘
                                    │
                              create │ dev tasks
                                    ▼
                            ┌───────────────┐     tracked in    ┌─────────┐
                            │  DEVELOPMENT   │ ──────────────→  │  TASKS  │
                            │(sprints, impl) │                  │(unified)│
                            └───────────────┘                  └─────────┘
```

**Workflow A — Marketing:** Idea/Feature/Project → Marketing Strategy → Campaign → Content Tasks → Content Calendar & Publishing
**Workflow B — Development:** Idea/Feature/Project → Development Sprint → Dev Tasks → Implementation & Testing & Tracking

### Entity relationships

```
Idea ──promotes-to──→ Feature (in Roadmap)
Idea ──creates──→ Marketing Strategy
Feature ──creates──→ Marketing Strategy
Feature ──creates──→ Development Sprint
Marketing Strategy ──applies-to──→ Campaign (new entity)
Campaign ──generates──→ Marketing Tasks (in Content pipeline)
Development Sprint ──generates──→ Dev Tasks (in Tasks)
```

---

## 3. Phase 1 — Data Model & Schema Changes

### New tables to add to `schema.ts`

```typescript
// ─── Features (Roadmap Items) ────────────────────────────────────────────
features: defineTable({
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),           // "proposed" | "planned" | "in-progress" | "shipped" | "cancelled"
    priority: v.string(),         // "critical" | "high" | "medium" | "low"
    effort: v.optional(v.string()), // "XS" | "S" | "M" | "L" | "XL"
    category: v.optional(v.string()), // "core" | "ux" | "infra" | "integration" | "perf"
    targetRelease: v.optional(v.string()),
    sourceIdeaId: v.optional(v.id("ideas")),
    tags: v.array(v.string()),
    acceptanceCriteria: v.optional(v.string()), // markdown
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_org", ["orgId"])
    .index("by_project", ["projectId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_source_idea", ["sourceIdeaId"]),

// ─── Campaigns (Marketing Execution) ────────────────────────────────────
campaigns: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.id("marketingStrategies"),
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    description: v.optional(v.string()),
    schedule: v.string(),         // "one-time" | "daily" | "weekly" | "custom"
    scheduleDays: v.optional(v.array(v.string())), // ["mon","wed","fri"]
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),  // null = indefinite
    status: v.string(),           // "draft" | "active" | "paused" | "completed"
    sourceFeatureId: v.optional(v.id("features")),
    sourceIdeaId: v.optional(v.id("ideas")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_org", ["orgId"])
    .index("by_strategy", ["strategyId"])
    .index("by_org_status", ["orgId", "status"]),

// ─── Development Sprints ─────────────────────────────────────────────────
devSprints: defineTable({
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(),           // "planning" | "active" | "completed" | "cancelled"
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    featureIds: v.array(v.id("features")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_org", ["orgId"])
    .index("by_project", ["projectId"])
    .index("by_org_status", ["orgId", "status"]),
```

### Modifications to existing tables

```typescript
// tasks — add these fields:
    category: v.optional(v.string()),     // "development" | "marketing" | "general"
    featureId: v.optional(v.id("features")),
    sprintId: v.optional(v.id("devSprints")),
    campaignId: v.optional(v.id("campaigns")),

// ideas — add this field:
    promotedTo: v.optional(v.string()),   // "feature" | "task" | "strategy" — tracks what it became

// marketingTasks — add this field:
    campaignId: v.optional(v.id("campaigns")),
```

### New Convex function files

| File | Purpose |
|------|---------|
| `features.ts` | CRUD + list/filter for features, promote-from-idea mutation |
| `campaigns.ts` | CRUD + start/pause/complete, generate tasks from campaign |
| `devSprints.ts` | CRUD + sprint management, generate dev tasks from features |

---

## 4. Phase 2 — `.project/` Folder & YAML Files

Each project repository should organise its metadata YAML files inside a `.project/` directory:

```
my-project/
├── .project/
│   ├── PROJECT.yaml      # project metadata (currently at root)
│   ├── ACCOUNTS.yaml     # service accounts & credentials (currently ACCOUNT.yaml at root)
│   ├── ROADMAP.yaml      # feature roadmap for this project
│   └── IDEAS.yaml        # project-specific idea backlog
├── src/
└── ...
```

### Implementation steps

1. **Update GitHub sync** (`packages/backend/convex/github.ts`):
   - When scanning repos, look for `.project/PROJECT.yaml` first, fall back to root `PROJECT.yaml`
   - Also parse `.project/ROADMAP.yaml` and `.project/IDEAS.yaml` if they exist
   - Sync features from `ROADMAP.yaml` into the `features` table
   - Sync ideas from `IDEAS.yaml` into the `ideas` table

2. **Update `@beautifulMention`** references (if this is an external tool/plugin that reads these files to provide project context, update its config to look in `.project/` instead of root)

3. **Migration strategy**: Keep backward compat — check both `.project/` and root locations

### YAML file formats

**ROADMAP.yaml:**
```yaml
features:
  - title: "Dark mode support"
    status: planned
    priority: high
    effort: M
    category: ux
    target_release: "v2.0"
    description: "Add system-aware dark/light theme toggle"
    acceptance_criteria: |
      - Toggle in settings
      - Respects OS preference
      - Persists across sessions

  - title: "Export to PDF"
    status: proposed
    priority: medium
    effort: L
    category: core
```

**IDEAS.yaml:**
```yaml
ideas:
  - title: "AI-powered code review"
    category: product
    score: 8
    body: "Integrate with GitHub to provide AI suggestions on PRs"
    tags: [ai, github, automation]

  - title: "Weekly digest email"
    category: feature
    score: 6
    body: "Send stakeholders a weekly summary of project progress"
    tags: [email, reporting]
```

---

## 5. Phase 3 — Ideas Page Enhancements

**File:** `apps/web/src/pages/IdeasPage.tsx`

### Current capabilities (keep)
- ✅ Cards, Pipeline, List, Kanban, Canvas views
- ✅ Create, score, combine, archive ideas
- ✅ Link ideas to projects
- ✅ Search, filter by category/project

### New capabilities to add

1. **Promote to Feature** (in addition to existing "Promote to Task"):
   - Add a "🚀 Promote to Feature" action button on each idea card
   - Opens modal: select target project, set priority/effort/category, optionally set target release
   - Calls `features.promoteFromIdea` mutation
   - Sets `idea.promotedTo = "feature"` and stores the feature ID as a reference

2. **Create Marketing Strategy from Idea**:
   - Add a "📣 Create Strategy" action button
   - Opens modal pre-populated with idea context (title, body, linked project)
   - Calls `marketingStrategies.createFromIdea` mutation
   - Sets `idea.promotedTo = "strategy"`

3. **AI Brainstorm Mini-Chatbot**:
   - Add a collapsible chat panel on the right side of the page (or a floating button that opens a slide-over panel)
   - User selects a **project** from a dropdown → system prompt and initial context are auto-populated with project info (PROJECT.yaml data, existing ideas for that project, tech stack)
   - Provide 3-4 **AI profile presets** the user can pick:
     - 🧠 **Creative Brainstormer** — generates wild, innovative ideas
     - 🔍 **Market Analyst** — suggests ideas based on market gaps and trends
     - 🏗️ **Technical Architect** — proposes infrastructure and DX improvements
     - 🎯 **Product Strategist** — focuses on user value and competitive positioning
   - Each profile has a different system prompt tuned to that persona
   - Chat responses can include a "💡 Save as Idea" button that creates an idea from the AI's suggestion
   - Use existing `chatSessions` / `chatMessages` infrastructure with a new `chatbotConfig` per profile

4. **Promoted Status Badges**:
   - Show a badge on ideas that have been promoted: "→ Feature", "→ Task", "→ Strategy"
   - Click badge to navigate to the promoted entity

---

## 6. Phase 4 — Roadmap Page Overhaul

**File:** `apps/web/src/pages/RoadmapPage.tsx`

### Current state
- Shows **projects** grouped by tier (Idea → MVP → Growth → Scale → Shipped)
- Pure project lifecycle view — no feature management

### New design: Two sub-views via tabs

**Tab 1: "Projects" (current functionality, keep as-is)**
- Pipeline, List, Compact, Kanban views of projects by tier
- "+ New Project" button
- This is the project lifecycle roadmap

**Tab 2: "Features" (NEW)**
- Kanban board with columns: Proposed → Planned → In Progress → Shipped → Cancelled
- Each card shows: feature title, project badge, priority, effort, tags
- Click card → side panel or modal with full details + acceptance criteria (markdown editor)
- Filter by: project, priority, category, target release
- Sort by: priority, updated date, effort
- **"+ New Feature"** button → create form (title, project, priority, effort, category, description, acceptance criteria)
- **Bulk actions**: select multiple → batch status change, batch assign to sprint
- **Promote actions on each feature card**:
  - "🏗️ Create Dev Sprint" → opens modal to create a devSprint with this feature pre-attached
  - "📣 Create Marketing Strategy" → opens modal to start a marketing strategy for this feature

### AI Chatbot (same pattern as Ideas page)
- Project-scoped context, AI profiles tailored for roadmap planning:
  - 🗺️ **Roadmap Planner** — helps prioritise and sequence features
  - 📊 **Competitor Analyst** — suggests features based on competitive landscape
  - 👥 **User Advocate** — focuses on user pain points and desired outcomes
- AI can suggest features → "Save as Feature" action

---

## 7. Phase 5 — New Development Page

**New file:** `apps/web/src/pages/DevelopmentPage.tsx`

This is the missing piece — analogous to Marketing but for the **implementation workflow**.

### Core concept
Manage the development lifecycle: Features → Sprints → Tasks → Implementation tracking.

### Tabs

**Tab 1: "Sprints"**
- Kanban with columns: Planning → Active → Completed
- Each sprint card shows: name, project, date range, feature count, task progress (X/Y done)
- Click card → expand to show linked features and tasks
- **"+ New Sprint"** button → create form:
  - Name, project, date range, description
  - Select features to include (multi-select from project's features)
- **"⚡ Generate Tasks"** action on a sprint:
  - For each feature in the sprint, auto-generate tasks:
    - "Implement [feature title]" (type: feature)
    - "Write tests for [feature title]" (type: chore)
    - "Update docs for [feature title]" (type: docs)
  - Tasks are created in the `tasks` table with `category: "development"`, `sprintId` set, `featureId` set

**Tab 2: "Board"**
- Kanban of all dev tasks (`tasks` where `category = "development"`)
- Columns: To Do → In Progress → In Review → Done
- Filter by sprint, project, feature, priority
- Drag-and-drop between columns to update status

**Tab 3: "Timeline" (Gantt-style)**
- Horizontal timeline showing sprints as bars
- Features within sprints as sub-bars
- Colour-coded by status/priority
- Simple implementation: CSS grid or flex with date-based positioning

**Tab 4: "Metrics"**
- Sprint velocity (tasks completed per sprint)
- Feature completion rate
- Task burndown chart (simple bar chart)
- Development load by project

### AI Chatbot
- 🏗️ **Sprint Planner** — helps break down features into tasks
- 🐛 **Bug Triager** — helps categorise and prioritise bugs
- 📐 **Architecture Advisor** — suggests implementation approaches

---

## 8. Phase 6 — Marketing Page Restructure

**File:** `apps/web/src/pages/MarketingPage.tsx`

### What changes

**REMOVE** from Marketing page (move to Content page):
- Pipeline tab (the marketingTasks kanban)
- Calendar tab
- Cross-Project tab

**KEEP** in Marketing page:
- Strategies tab (existing, enhanced)

**ADD** to Marketing page:
- **Campaigns tab** (new)

### Updated tabs

**Tab 1: "Strategies"** (enhanced from current)
- Existing strategy cards with expand/collapse
- "🚀 Apply" → now creates a **Campaign** instead of directly generating tasks
- "Seed Default Strategies" button stays
- Add: "Create Custom Strategy" form (currently you can only seed defaults)
- Each strategy can show linked campaigns count

**Tab 2: "Campaigns"** (NEW)
- List/cards of campaigns
- Each campaign card shows: name, strategy badge, project, schedule, status, task count
- Click to expand: shows all generated marketing tasks, progress stats
- **Create campaign form**: Select strategy, select project, choose schedule:
  - **One-time** — generate tasks once
  - **Recurring** — set cadence (daily / specific days / weekly) + optional end date
  - Campaign name, description
- **"⚡ Generate Tasks"** on a campaign → creates `marketingTasks` with `campaignId` set
- **Campaign actions**: Start, Pause, Complete, Archive
- Campaign status Dashboard: active campaigns, tasks by status, upcoming due dates

### AI Chatbot
- 📣 **Marketing Strategist** — helps craft marketing plans and messaging
- 📈 **Growth Hacker** — suggests viral tactics and growth experiments
- ✍️ **Copywriter** — generates marketing copy, headlines, CTAs

---

## 9. Phase 7 — Content Page Expansion

**File:** `apps/web/src/pages/ContentPage.tsx`

### What changes

Content becomes the **operational hub** for all marketing content — where tasks are tracked, scheduled, and published.

### Updated tabs

**Tab 1: "Pipeline"** (MOVED from Marketing)
- The existing marketingTasks kanban (Idea → Draft → In Review → Scheduled → Posted → Archived)
- Enhanced with: campaign filter, AI-generated content indicator
- Each task card: click to expand full editor for content draft
- Show linked campaign name on each card

**Tab 2: "Calendar"** (MOVED from Marketing)
- The existing weekly calendar view
- Enhanced: month view option, drag-to-reschedule
- Show tasks by platform with colour coding
- Unscheduled bucket at bottom

**Tab 3: "Cross-Project"** (MOVED from Marketing)
- Multi-project content overview
- Group by project, show content task counts by status
- Useful for seeing the big picture across all campaigns

**Tab 4: "Release Content"** (EXISTING ContentPage functionality)
- The current release-based content planner (`contentPlans` + `contentItems`)
- Rename from the root page to a tab so it fits alongside the moved content
- Keep all existing CRUD functionality

### AI Chatbot
- ✍️ **Content Writer** — generates drafts for social posts, blog articles, threads
- 🎨 **Creative Director** — suggests visual concepts and content angles
- 📊 **Analytics Advisor** — recommends posting times and content strategies based on engagement patterns

---

## 10. Phase 8 — Tasks Page Unification

**File:** `apps/web/src/pages/TasksPage.tsx`

### What changes

Tasks becomes the **unified task view** across all categories. It shows ALL tasks from both the `tasks` table (dev tasks) and `marketingTasks` table (content tasks).

### Enhancements

1. **Category tabs/filter at the top**:
   - **All** — show everything
   - **Development** — `tasks` where `category = "development"` (linked to sprints/features)
   - **Marketing** — `marketingTasks` (linked to campaigns/strategies)
   - **General** — `tasks` where `category = "general"` or null (standalone tasks)

2. **Contextual badges on task cards**:
   - Show sprint name for dev tasks
   - Show campaign name for marketing tasks
   - Show feature name if linked
   - Click badges to navigate to the parent entity

3. **Filter by**: category, project, sprint, campaign, priority, status, due date range

4. **Existing views stay**: Kanban and List views

---

## 11. Phase 9 — Navigation & Sidebar Updates

### Top-bar navigation changes

Update the grouped dropdowns in `App.tsx`:

```typescript
// CURRENT:
{ label: '📋 Work', ids: ['tasks', 'workflows', 'marketing', 'content', 'ideas'] },
{ label: '📖 Knowledge', ids: ['wiki', 'roadmap', 'files'] },

// NEW:
{ label: '📋 Work', ids: ['tasks', 'development', 'workflows'] },
{ label: '💡 Product', ids: ['ideas', 'roadmap', 'marketing', 'content'] },
{ label: '📖 Knowledge', ids: ['wiki', 'files'] },
```

### Add to WORKSPACES config (in `lib/types.ts`):

```typescript
{ id: 'development', label: 'Development', icon: '🏗️', path: '/development' },
```

### Move Roadmap
- Move Roadmap from Knowledge into the new **Product** dropdown since it's part of the product lifecycle, not knowledge/documentation.

### New route in `App.tsx`:

```tsx
<Route path="/development" element={<DevelopmentPage />} />
```

---

## 12. Phase 10 — Cross-Module Workflows

These are the **connecting actions** that make the modules work together. Each is a button/action on the source page that creates an entity on the target page.

### Workflow A: Idea → Marketing → Content

| Step | Source | Action | Target | Mutation |
|------|--------|--------|--------|----------|
| 1 | Ideas | "📣 Create Strategy" | Marketing → Strategies | `marketingStrategies.createFromIdea` |
| 2 | Marketing → Strategies | "🚀 Apply to Project" | Marketing → Campaigns | `campaigns.createFromStrategy` |
| 3 | Marketing → Campaigns | "⚡ Generate Tasks" | Content → Pipeline | `marketingTasks.generateFromCampaign` |
| 4 | Content → Pipeline | Drag to "Scheduled" | Content → Calendar | `marketingTasks.update` (set scheduledDate) |
| 5 | Content → Pipeline | Move to "Posted" | Content → Calendar | `marketingTasks.update` (set postedDate) |

### Workflow B: Idea → Development → Tasks

| Step | Source | Action | Target | Mutation |
|------|--------|--------|--------|----------|
| 1 | Ideas | "🚀 Promote to Feature" | Roadmap → Features | `features.promoteFromIdea` |
| 2 | Roadmap → Features | "🏗️ Create Sprint" | Development → Sprints | `devSprints.createFromFeatures` |
| 3 | Development → Sprints | "⚡ Generate Tasks" | Tasks (dev) | `tasks.generateFromSprint` |
| 4 | Tasks | Status updates | Development → Board | visible via filter |

### Cross-references (breadcrumbs)
Every entity should show its lineage. Examples:
- A dev task card shows: `💡 [Original Idea] → ✨ [Feature] → 🏃 [Sprint]`
- A marketing task shows: `💡 [Idea/Feature] → 📣 [Strategy] → 📅 [Campaign]`
- Clicking any breadcrumb item navigates to that entity's page/detail

---

## 13. Phase 11 — AI Chatbot Integration

### Shared chatbot infrastructure

Each page's AI chatbot should reuse the existing chat infrastructure:

1. **Chat Panel Component** (`components/AIChatPanel.tsx`) — reusable slide-over or collapsible panel
2. **Props**: page context (page name, selected project), AI profiles for this page, initial system prompt template
3. **Profiles** stored in `chatbotConfigs` table — create seed profiles per page

### System prompt template (per profile)

```
You are a {profile_name} for {project_name}.

Project context:
- Name: {project.name}
- Stack: {project.stack}
- Description: {project.description}
- Tier: {project.tier}

{page_specific_context}

Help the user by {profile_instructions}.
```

### Save-to-entity actions
Each AI response can optionally contain structured suggestions. Add a toolbar button on AI messages:
- 💡 Save as Idea
- ✨ Save as Feature
- 📋 Save as Task
- 📣 Save as Strategy

---

## 14. Phase 12 — UI Component Audit

### Replace raw HTML with proper UI components

Audit ALL pages and replace:

| Raw HTML | Replace with |
|----------|-------------|
| `<input className="form-input">` | `<FormInput>` |
| `<textarea className="form-textarea">` | `<FormTextarea>` |
| `<button className="btn btn-*">` | Keep — these are already component-level CSS classes |
| Raw `<div>` stat cards | `<StatCard>` from `components/ui` |
| Raw `<div>` empty states | `<EmptyState>` from `components/ui` |
| Raw page headers | `<PageHeader>` from `components/ui` |
| `confirm()` dialogs | Proper `<Dialog>` component from `components/Dialog.tsx` |

**Pages to audit** (known issues from code review):
- `MarketingPage.tsx` — Pipeline `<input>` should be `<FormInput>`
- `TasksPage.tsx` — Create form uses raw `<input>` and `<textarea>`
- All pages using `confirm()` for delete actions

---

## 15. Verification & Acceptance Criteria

### Functional checks

- [ ] **Idea → Feature promotion** works end-to-end with data persisted in `features` table
- [ ] **Idea → Marketing Strategy** creation works with pre-populated context
- [ ] **Feature → Dev Sprint → Tasks** generation creates proper tasks with `category: "development"`
- [ ] **Strategy → Campaign → Marketing Tasks** generation creates proper tasks with `campaignId`
- [ ] **Tasks page** shows unified view of dev + marketing + general tasks with category filter
- [ ] **Content page** has Pipeline, Calendar, Cross-Project, and Release Content tabs
- [ ] **Marketing page** has Strategies and Campaigns tabs (pipeline/calendar moved out)
- [ ] **Development page** has Sprints, Board, Timeline, and Metrics tabs
- [ ] **Roadmap page** has Projects and Features tabs
- [ ] **AI chatbot** works on Ideas, Roadmap, Development, and Marketing pages
- [ ] **Navigation** updated with new Product dropdown containing Ideas, Roadmap, Marketing, Content
- [ ] **Cross-references** (breadcrumbs) show entity lineage and are clickable
- [ ] **`.project/` folder** supported by GitHub sync with backward compat

### UI checks

- [ ] All forms use `<FormInput>`, `<FormTextarea>`, `<FormCheckbox>` components
- [ ] All pages use `<PageHeader>`, `<EmptyState>`, `<StatCard>` where appropriate
- [ ] Delete actions use `<Dialog>` instead of `confirm()`
- [ ] All new pages are responsive and work on mobile via `useIsMobile()`
- [ ] Consistent styling with existing dark theme and CSS variables

### Data integrity

- [ ] Existing `tasks`, `ideas`, `marketingTasks` data is preserved during migration
- [ ] New `category` field on tasks defaults to `"general"` for existing records
- [ ] All new tables have proper `by_org` indexes for multi-tenant safety
- [ ] Schema migration is non-breaking (all new fields are optional)
