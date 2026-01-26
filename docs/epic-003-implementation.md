# EPIC-003 Implementation Guide: Copilot MCP-Driven Artifact Materialization

## Overview

EPIC-003 enables **GitHub Copilot** to retrieve previously derived artifacts (Epics, Features, User Stories, AI Prompts) from MUSE's MinIO storage and materialize them into GitHub via pull requests—**without regenerating them**.

This workflow enforces clear role separation:
- **MUSE**: Derives artifacts and persists to `muse.yaml` (system of record)
- **Copilot MCP**: Retrieves artifacts and orchestrates GitHub operations
- **Anthropic**: Derives content only (no GitHub interaction)
- **GitHub**: Acts as version-controlled artifact repository

---

## Architecture

### Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                     Copilot MCP Client                       │
│  (GitHub Copilot asking for artifact retrieval/materialization) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MUSE API (services/api)                          │
│                                                                │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │ MCPToolServer    │    │ MaterializationService  │          │
│  ├──────────────────┤    ├──────────────────┤                │
│  │ list_epics       │    │ render epics     │                │
│  │ get_epic         │    │ render features  │                │
│  │ list_features    │    │ render stories   │                │
│  │ list_stories     │    │ render prompts   │                │
│  │ list_prompts     │    │ → /docs/**       │                │
│  │ validate_lineage │    └──────────────────┘                │
│  └──────────────────┘                                          │
│                                                                │
│  ┌──────────────────┐                                          │
│  │ GitHubService    │                                          │
│  ├──────────────────┤                                          │
│  │ create branch    │                                          │
│  │ stage files      │                                          │
│  │ commit           │                                          │
│  │ create PR        │                                          │
│  └──────────────────┘                                          │
└──────────┬───────────────────┬────────────────┬───────────────┘
           │                   │                │
           ▼                   ▼                ▼
     ┌──────────┐        ┌──────────┐    ┌──────────┐
     │muse.yaml │        │/docs     │    │ GitHub   │
     │          │        │artifacts │    │ CLI (gh) │
     │(artifacts)        │          │    │          │
     └──────────┘        └──────────┘    └──────────┘
```

### Data Flow

**Read Path (Retrieval)**:
```
Copilot MCP Tool Request
  ↓
MCPToolServer.listDerivedEpics()
  ↓
Load muse.yaml
  ↓
Return { epic_id, title, objective, success_criteria, ... }
```

**Write Path (Materialization)**:
```
Copilot MCP Tool Request: materialize_artifacts
  ↓
MaterializationService.materialize()
  ↓
Load muse.yaml (read all artifacts)
  ↓
For each artifact type (epics, features, stories, prompts):
  - Render to /docs/{type}/{id}.md
  - Include YAML front matter with metadata
  ↓
Return { files_created: [...], summary: {...} }
```

**GitHub Commit Path**:
```
Copilot MCP Tool Request: commit_artifacts_to_github
  ↓
Create feature branch: epic-003-materialization
  ↓
Stage /docs/** files
  ↓
Commit with message
  ↓
Create PR to main
  ↓
Return { prUrl: "https://github.com/.../pull/123" }
```

---

## API Endpoints

### Read-Only Retrieval (No Copilot Guardrails Needed)

#### `GET /mcp/epics`
Lists all epics from `muse.yaml`.

**Response**:
```json
{
  "success": true,
  "data": {
    "epic_count": 1,
    "epics": [
      {
        "epic_id": "EPIC-001",
        "title": "Governance-to-Code Translation",
        "objective": "Enable AI derivation of delivery artifacts from governance documents",
        "governance_references": ["..."],
        "derived_from": "governance.md",
        "generated_at": "2026-01-23T12:00:00Z"
      }
    ]
  }
}
```

#### `GET /mcp/epics/{epicId}`
Get details of a specific epic.

#### `GET /mcp/features?epic_id={epicId}`
List features, optionally filtered by epic.

#### `GET /mcp/features/{featureId}`
Get details of a specific feature.

#### `GET /mcp/stories?feature_id={featureId}&epic_id={epicId}`
List user stories, optionally filtered by feature or epic.

#### `GET /mcp/stories/{storyId}`
Get details of a specific user story.

#### `GET /mcp/prompts?story_id={storyId}`
List AI prompts, optionally filtered by story.

#### `GET /mcp/prompts/{promptId}`
Get full prompt content.

#### `POST /mcp/validate-lineage`
Validate epic → feature → story → prompt lineage.

**Request**:
```json
{
  "epic_id": "EPIC-001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "epic_id": "EPIC-001",
    "valid": true,
    "feature_count": 3,
    "story_count": 12,
    "prompt_count": 12,
    "errors": null
  }
}
```

---

### Write Operations (Requires Copilot Oversight)

#### `POST /mcp/materialize`
Renders all artifacts from `muse.yaml` to `/docs` Markdown files.

**Constraints**:
- Only writes to `/docs/**` paths
- Idempotent (overwrites existing files with same structure)
- Includes YAML front matter for traceability
- Rate-limited to 10 requests per 15 minutes per IP

**Response**:
```json
{
  "success": true,
  "data": {
    "files_created": [
      "docs/epics/EPIC-001.md",
      "docs/features/FEAT-001.md",
      "docs/stories/STORY-001-01-xxx.md",
      "docs/prompts/PROMPT-001.md"
    ],
    "summary": {
      "epics": 1,
      "features": 3,
      "stories": 12,
      "prompts": 12
    }
  }
}
```

#### `POST /mcp/commit`
Stages materialized artifacts, commits them, and creates a pull request.

**Constraints**:
- Only commits `/docs/**` paths
- Requires GitHub CLI (`gh`) installed
- Creates feature branch (never pushes to main)
- All changes go through PR review

**Request**:
```json
{
  "branch_name": "epic-003-materialization",
  "pr_title": "muse-epic-003: materialize derived artifacts",
  "pr_body": "This PR materializes Epic, Feature, Story, and Prompt artifacts derived from governance documents.\n\n- Epic: EPIC-001\n- Features: 3\n- Stories: 12\n- Prompts: 12",
  "labels": ["muse", "epic-003", "governance-artifacts"],
  "reviewers": ["@org/governance-team"]
}
```

**Response**:
```json
{
  "success": true,
  "branch": "epic-003-materialization",
  "commitHash": "a1b2c3d",
  "prUrl": "https://github.com/dgaspard/muse/pull/42"
}
```

---

## Integration with Copilot

### Copilot Instructions (`.github/copilot-instructions.md`)

Add to your copilot instructions:

```markdown
# EPIC-003: Artifact Materialization

Use these MCP tools to retrieve and materialize derived artifacts without regenerating them:

## Retrieval (read-only)
- `GET /mcp/epics` — list all derived epics
- `GET /mcp/epics/{epicId}` — get epic details
- `GET /mcp/features?epic_id={epicId}` — list features for an epic
- `GET /mcp/stories?feature_id={featureId}` — list stories for a feature
- `GET /mcp/prompts?story_id={storyId}` — list prompts for a story
- `POST /mcp/validate-lineage` — validate artifact hierarchy

## Materialization (write)
- `POST /mcp/materialize` — render artifacts to /docs
- `POST /mcp/commit` — create PR with materialized artifacts

## Workflow

1. **List artifacts**: Use `GET /mcp/epics` to enumerate scope
2. **Validate**: Use `POST /mcp/validate-lineage` to ensure consistency
3. **Materialize**: Use `POST /mcp/materialize` to render Markdown files
4. **Commit**: Use `POST /mcp/commit` to stage, commit, and open PR

## Constraints

- **Never regenerate artifacts** — always retrieve from MinIO via MCP tools
- **No direct main pushes** — all changes flow through PR review
- **Path whitelist**: Only `/docs/**` paths are allowed in commits
- **Rate limits**: 10 write operations per 15 minutes per IP
```

---

## Data Structures

### Epic Artifact (muse.yaml)
```yaml
artifacts:
  epics:
    - epic_id: EPIC-001
      title: Governance-to-Code Translation
      objective: Enable AI derivation of delivery artifacts...
      success_criteria:
        - 1. Epics derive from governance documents with audit trail
        - 2. Features map to epic scope
      governance_references:
        - section_id: Section 2.1
          rationale: Core requirement
      derived_from: governance.md
      generated_at: 2026-01-23T12:00:00Z
```

### Feature Artifact (muse.yaml)
```yaml
artifacts:
  features:
    - feature_id: FEAT-001
      title: Expose Derived Artifacts via MCP
      description: Enable Copilot to retrieve artifacts...
      epic_id: EPIC-001
      acceptance_criteria:
        - List all derived epics via read-only MCP tool
        - Each epic includes ID, title, objective
      user_story_ids:
        - STORY-001-01-list-epics
        - STORY-001-02-get-epic
      governance_references:
        - section_id: Section 3.1
          rationale: MCP interface requirement
```

### Story Artifact (muse.yaml)
```yaml
artifacts:
  stories:
    - story_id: STORY-001-01-list-epics
      title: List all derived epics for a project
      role: "Copilot MCP client"
      capability: retrieve derived epics
      benefit: enumerate delivery scope before committing
      feature_id: FEAT-001
      epic_id: EPIC-001
      acceptance_criteria:
        - MCP tool `list_derived_epics` exists
        - Returns epic IDs, titles, governance references
        - Read-only access
        - Deterministic ordering
      governance_reference: Section 3.1
```

### Prompt Artifact (muse.yaml)
```yaml
artifacts:
  prompts:
    - prompt_id: PROMPT-EPIC-001-001
      story_id: STORY-001-01-list-epics
      feature_id: FEAT-001
      epic_id: EPIC-001
      role: "system architect"
      task: "Design MCP tool for epic retrieval"
      content: |
        Design a read-only MCP tool that lists all epics...
      template: "basic"
      generated_at: 2026-01-23T12:00:00Z
```

---

## File Structure After Materialization

```
docs/
├── epics/
│   └── EPIC-001.md
│       ├── YAML Front Matter (epic_id, derived_artifact: epic_markdown)
│       ├── # Epic: {title}
│       ├── ## Objective
│       ├── ## Success Criteria
│       └── ## Governance References
├── features/
│   ├── FEAT-001.md
│   ├── FEAT-001-001.md
│   └── FEAT-001-002.md
│       ├── YAML Front Matter (feature_id, epic_id, derived_artifact: feature_markdown)
│       ├── # Feature: {title}
│       ├── ## Description
│       ├── ## Acceptance Criteria
│       └── ## Governance References
├── stories/
│   ├── STORY-001-01-list-epics.md
│   ├── STORY-001-02-get-epic.md
│   └── ...
│       ├── YAML Front Matter (story_id, feature_id, epic_id, derived_artifact: story_markdown)
│       ├── # User Story: {title}
│       ├── As a {role}
│       ├── I want to {capability}
│       ├── So that {benefit}
│       ├── ## Acceptance Criteria
│       └── ## Governance Reference
└── prompts/
    ├── PROMPT-EPIC-001-001.md
    └── ...
        ├── YAML Front Matter (prompt_id, story_id, feature_id, epic_id)
        ├── # AI Prompt: {prompt_id}
        ├── ## Role
        ├── ## Task
        ├── ## Prompt Content
        └── ## Template
```

---

## Implementation Checklist

- [x] Create `MCPToolServer` with artifact retrieval tools
- [x] Create `MaterializationService` to render artifacts to `/docs`
- [x] Create `GitHubService` to stage/commit/PR via `gh` CLI
- [x] Add API endpoints for all MCP tools
- [x] Rate-limit write operations
- [x] Validate artifact lineage before materialization
- [x] Add Copilot instructions
- [x] Create GitHub PR templates
- [ ] **Pending**: Test materialization end-to-end
- [ ] **Pending**: Test GitHub commit workflow with gh CLI
- [ ] **Pending**: Update Copilot instructions in `.github/copilot-instructions.md`
- [ ] **Pending**: Add GitHub Actions workflow to validate artifacts on PR

---

## Testing

### Manual Test: Retrieve Epics

```bash
curl http://localhost:4000/mcp/epics
```

### Manual Test: Materialize

```bash
curl -X POST http://localhost:4000/mcp/materialize
```

### Manual Test: Validate Lineage

```bash
curl -X POST http://localhost:4000/mcp/validate-lineage \
  -H "Content-Type: application/json" \
  -d '{"epic_id": "EPIC-001"}'
```

### Manual Test: Commit to GitHub

Requires GitHub CLI (`gh`) installed and authenticated:

```bash
curl -X POST http://localhost:4000/mcp/commit \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name": "epic-003-test",
    "pr_title": "test: epic-003 materialization",
    "pr_body": "Testing artifact materialization workflow",
    "labels": ["test", "epic-003"],
    "reviewers": ["@username"]
  }'
```

---

## Constraints & Guardrails

### Path Whitelist
- Only `/docs/**` paths are allowed in commits
- Attempts to write outside `/docs` are rejected

### Rate Limiting
- Read operations: 100 requests per 15 minutes per IP
- Write operations: 10 requests per 15 minutes per IP

### Artifact Immutability
- Artifacts in `muse.yaml` are never modified by Copilot
- Copilot only reads and materializes (writes to `/docs`)
- MUSE pipeline remains the source of truth

### GitHub Constraints
- Copilot never pushes directly to `main`
- All changes flow through feature branch → PR review
- PR requires passing CI and human review before merge

---

## Rollback Procedure

If materialized artifacts are incorrect:

1. **Delete the feature branch**: `git branch -D epic-003-materialization`
2. **Close the PR** without merging
3. **Fix artifacts in `muse.yaml`** (via MUSE pipeline, not manually)
4. **Re-run materialization** with corrected data

---

## Success Criteria

✅ Copilot retrieves artifacts without regenerating them  
✅ Artifacts are traceable to governance documents  
✅ All changes flow through PR review  
✅ No direct pushes to main  
✅ Artifact lineage is validated before materialization  
✅ Rate limiting prevents abuse  

---

## See Also

- [EPIC-002: GitHub Integrations](../EPIC-002:%20Deploy%20to%20Azure.md)
- [EPIC-001: Create Epics, Features, Stories, AI Prompts](../EPIC-001:%20Governance-to-Code%20Translation.md)
- [Artifact Persistence](../ARTIFACT-BOUNDARY-VALIDATION.md)
