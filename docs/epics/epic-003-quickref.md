# EPIC-003 Quick Reference

## 🎯 What This Does

Enables **Copilot** to retrieve previously-derived artifacts (Epics, Features, Stories, Prompts) from **MinIO** and materialize them into **GitHub** via pull requests—without regenerating them.

## 📋 Architecture

```
Copilot (via MCP)
  ↓
MUSE API (/mcp/*)
  ├── Read: List/get artifacts from muse.yaml
  ├── Write: Materialize to /docs/
  └── GitHub: Create PR via `gh` CLI
  ↓
MinIO (muse.yaml)
GitHub (version control)
```

## 🛠️ Components Implemented

| Component | File | Purpose |
|-----------|------|---------|
| MCPToolServer | `services/api/src/mcp/mcpToolServer.ts` | Retrieves artifacts from muse.yaml |
| MaterializationService | `services/api/src/mcp/materializationService.ts` | Renders artifacts to /docs |
| GitHubService | `services/api/src/mcp/githubService.ts` | Safe GitHub operations |
| MCP Registry | `services/api/src/mcp/index.ts` | Tool definitions for Copilot |
| API Routes | `services/api/src/index.ts` | HTTP endpoints for tools |

## 🚀 Key Endpoints

### Read-Only (Retrieval)

```bash
GET  /mcp/epics              # List all epics
GET  /mcp/epics/{epicId}     # Get epic details
GET  /mcp/features           # List all features
GET  /mcp/stories            # List all stories
GET  /mcp/prompts            # List all prompts
POST /mcp/validate-lineage   # Validate artifact hierarchy
```

### Write (Materialization)

```bash
POST /mcp/materialize        # Render artifacts to /docs
POST /mcp/commit             # Create PR with artifacts
```

## 🔒 Constraints

✅ Copilot only **retrieves** and **materializes** (never regenerates)  
✅ `muse.yaml` is **immutable** (source of truth)  
✅ Only **/docs/** paths writable  
✅ No direct **main** pushes (feature branch → PR)  
✅ **Rate-limited**: 10 writes/15min, 100 reads/15min per IP  
✅ **Lineage validation** before materialization  

## 📝 Example Workflow

### 1. List Artifacts
```bash
curl http://localhost:4000/mcp/epics
```

### 2. Validate Hierarchy
```bash
curl -X POST http://localhost:4000/mcp/validate-lineage \
  -H "Content-Type: application/json" \
  -d '{"epic_id": "EPIC-001"}'
```

### 3. Materialize to /docs
```bash
curl -X POST http://localhost:4000/mcp/materialize
```

### 4. Create PR
```bash
curl -X POST http://localhost:4000/mcp/commit \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name": "epic-003-artifacts",
    "pr_title": "feat: materialize EPIC-001 artifacts",
    "pr_body": "Artifacts: 1 epic, 3 features, 12 stories",
    "labels": ["muse", "epic-003"],
    "reviewers": ["@username"]
  }'
```

## 🧪 Testing

### Automated Test
```bash
bash scripts/test_epic_003.sh
```

### Manual API Test
```bash
# Start API
docker-compose up --build

# In another terminal
curl http://localhost:4000/mcp/epics
```

## 📚 Documentation

- [Full Implementation Guide](docs/EPIC-003-IMPLEMENTATION.md)
- [Summary](docs/EPIC-003-SUMMARY.md)
- [Completion Report](EPIC-003-COMPLETION.md)
- [EPIC Definition](backlog/EPIC-003:%20CoPilot%20MCP%20to%20create%20GovernanceDocs)

## ✅ Status

- ✅ MCPToolServer implemented
- ✅ API endpoints added
- ✅ GitHub service implemented
- ✅ Documentation complete
- ✅ TypeScript compilation passing
- ✅ Integration test script ready
- ⏳ End-to-end testing (pending API startup)
- ⏳ GitHub CLI integration (pending gh auth)

## 🔧 Requirements

- Node.js 18+ (for API)
- GitHub CLI `gh` (for PR creation)
- Docker (optional, for MinIO)
- curl (for testing)

## 🎓 For Copilot Integration

Add to `.github/copilot-instructions.md`:

```markdown
# EPIC-003: Retrieve and Materialize Artifacts

Use these MCP tools (never regenerate artifacts):

- GET /mcp/epics — list all epics
- POST /mcp/validate-lineage — validate hierarchy
- POST /mcp/materialize — render to /docs
- POST /mcp/commit — create PR
```

## 🚨 Important Notes

⚠️ Copilot **never regenerates** artifacts—it only retrieves and materializes  
⚠️ All changes go through **feature branch → PR review** (no main pushes)  
⚠️ Only **/docs/** paths are allowed in commits  
⚠️ Artifacts are **immutable** once in `muse.yaml`  

## 📞 Support

- See [Implementation Guide](docs/EPIC-003-IMPLEMENTATION.md) for detailed API docs
- See [Completion Report](EPIC-003-COMPLETION.md) for architecture overview
- Check [Test Script](scripts/test_epic_003.sh) for validation examples
