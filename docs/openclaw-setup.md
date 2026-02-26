# OpenClaw + Mission Control Integration

Connect [OpenClaw](https://openclaw.ai) agents to your Mission Control portfolio data.

## Setup

### 1. Prerequisites
- OpenClaw installed and running ([docs](https://openclaw.ai))
- Mission Control API running (default: `http://localhost:3001`)

### 2. Configure Environment
```bash
# In your OpenClaw environment or .env file:
export MC_API_URL=http://localhost:3001    # or your VPS URL
export MC_API_KEY=your-api-key-here        # optional
```

### 3. Register the AgentSkill

**Option A — Copy skill file:**
```bash
cp scripts/openclaw-skill.mjs ~/.openclaw/skills/mission-control.mjs
```

**Option B — Reference via config:**
Add to your OpenClaw skills configuration:
```yaml
skills:
  - name: mission-control
    path: /path/to/mission-control-app/scripts/openclaw-skill.mjs
    env:
      MC_API_URL: http://localhost:3001
```

## Available Functions

| Function | Description |
|---|---|
| `mc_list_projects` | List all projects with tier/lane/priority/stack |
| `mc_project_health` | Get details + health score for a project |
| `mc_create_task` | Create a task (projectPath, title, priority, type) |
| `mc_list_tasks` | List tasks (optionally filter by status/project) |
| `mc_task_stats` | Aggregated task statistics |
| `mc_run_scan` | Trigger full project re-scan |
| `mc_run_automation` | Run scan + stale detection + git status + health |
| `mc_dependencies` | Get shared dependency graph summary |

## CLI Usage

Test functions directly:
```bash
node scripts/openclaw-skill.mjs mc_list_projects
node scripts/openclaw-skill.mjs mc_create_task '{"projectPath":"my-project","title":"Fix bug"}'
node scripts/openclaw-skill.mjs mc_run_automation
```

## Example Prompts

Once connected, ask OpenClaw:
- *"What projects are in the building tier?"*
- *"Create a task for project X to implement feature Y"*  
- *"Run automation and tell me which projects are stale"*
- *"What are the most shared dependencies across projects?"*
