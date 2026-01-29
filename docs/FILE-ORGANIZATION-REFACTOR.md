# File Organization Refactor - Project-Based Hierarchy

## Overview
Refactoring MUSE artifact storage from flat structure to hierarchical project-based organization.

## New Structure

```
/docs/projects/{project-id}/
  governance/           # Original governance documents
  epics/
    {epic-id}/
      epic.yaml         # Epic metadata file
      features/
        {feature-id}/
          feature.yaml  # Feature metadata file
          userstories/
            {story-id}/
              story.yaml      # User story metadata file
              aiprompts/
                {prompt-id}.md # AI prompt markdown files
```

## Old Structure (Deprecated)
```
/docs/
  epics/{epic-name}.yaml
  features/{feature-name}.yaml
  stories/{story-name}.yaml
  prompts/{story-name}.prompt.md
  governance/{doc-id}.md
```

## Benefits
1. **Clear Hierarchy**: Nested structure makes relationships explicit
2. **Project Isolation**: Each project's artifacts are self-contained
3. **Scalability**: Easy to add new projects without clutter
4. **Traceability**: Path itself shows epic → feature → story → prompt lineage
5. **File Naming**: No more slug-based filenames; use consistent `epic.yaml`, `feature.yaml`, `story.yaml`

## Implementation Status

### ✅ Completed
- [x] Created `utils/projectPaths.ts` helper module
- [x] Updated `materialize-endpoint.ts` to use new structure
- [x] Added `projectId` requirement to materialize API
- [x] Updated `MusePipelineOrchestrator.ts` to use project-based paths
- [x] Updated MCP `materializationService.ts` to use hierarchical structure
- [x] Updated `index.ts` API routes to pass projectId through pipeline
- [x] Updated orchestrator test to expect new directory structure

### 🚧 In Progress
- [ ] Run full test suite to identify remaining path references

### 📝 TODO
- [ ] Migration script for existing artifacts
- [ ] Update frontend to display new hierarchy
- [ ] Update governance documents
- [ ] Update remaining test files if needed

## API Changes

### Materialize Endpoint
**Before:**
```typescript
POST /features/:featureId/materialize
{
  epic: {...},
  feature: {...},
  stories: [...],
  prompts: [...]
}
```

**After:**
```typescript
POST /features/:featureId/materialize
{
  projectId: "my-project",  // REQUIRED
  epic: {...},
  feature: {...},
  stories: [...],
  prompts: [...]
}
```

## Migration Path

### For Existing Artifacts
1. Determine project ID from epic ID or governance doc
2. Create new directory structure
3. Copy files to new locations
4. Update internal references if any
5. Mark old structure as deprecated

### For New Development
- All new artifacts use the new structure immediately
- Frontend updated to expect new paths
- MCP server tools updated to read from new paths

## Testing Plan
1. Unit tests for `projectPaths.ts` utilities
2. Integration tests for materialize endpoint
3. End-to-end test: upload → derive → materialize → verify files
4. Verify MCP tools can read new structure
5. Test GitHub commit workflow with new paths

## Rollout Strategy
1. **Phase 1** (Current): Backend refactor
   - Update API endpoints
   - Update file writing logic
   - Maintain backward compatibility for reads

2. **Phase 2**: MCP & Frontend
   - Update MCP server to read from new structure
   - Update frontend to display new hierarchy
   - Add migration UI/tool

3. **Phase 3**: Cleanup
   - Remove old path references
   - Delete deprecated code
   - Archive old artifacts

## Notes
- `projectId` should be provided by user during upload or derived from governance doc
- Default to `projectId = "default-project"` if not specified (temporary)
- Each epic/feature/story now has a dedicated directory
- Governance docs remain in project root (`governance/` folder)
