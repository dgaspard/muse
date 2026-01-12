# Artifact Contract Hardening - Quick Reference

## What Changed?

Three main improvements to enforce stricter artifact contracts:

### 1. **New Validation Module** (`src/shared/ArtifactValidation.ts`)

Centralized all validation logic for:

- ID format checking (epics, features, stories)
- Tautology detection (restatement of epic in feature, feature in story)
- Generic acceptance criteria detection
- Business value distinctness validation
- Governance reference structure validation

### 2. **Standardized GovernanceReference Type**

All governance references now follow this structure:

```typescript
{
  document_id: string     // Source document ID
  filename: string        // Name of governance file
  markdown_path: string   // Path to markdown file
  sections: string[]      // Section headers referenced
}
```

### 3. **Enhanced Agent Validation**

- **FeatureValueDerivationAgent**: Now validates features against hardening rules
- **FeatureToStoryAgent**: Now validates stories against hardening rules + uses standardized references

## ID Format Rules

### Feature IDs

```yaml
Format: <project>-<epic_id>-feature-<NN>
Example: demo-project-epic-doc123-feature-01
```

### Story IDs

```yaml
Format: <project>-<feature_id>-story-<NN>-<short-name>
Example: demo-project-epic-doc123-feature-01-story-01-user-auth
```

## Validation Rules

### Features MUST Have

- `business_value` (distinct from epic, min 20 chars)
- `risk_of_not_delivering` (non-empty array)
- `governance_references` (non-empty with markdown paths)
- `acceptance_criteria` (outcome-based, not generic)
- Proper ID format
- Not tautologically restate epic

### Stories MUST Have

- Canonical format (role, capability, benefit)
- `acceptance_criteria` (testable, non-generic)
- `governance_references` (non-empty with markdown paths)
- Proper ID format
- Not tautologically restate feature
- Explicit lineage (derived_from_feature, derived_from_epic)

## Generic Criteria Examples (REJECTED)

❌ "Feature is implemented"  
❌ "System supports X"  
❌ "As described"  
❌ "Works correctly"  
❌ "Verify the feature works"  

## Migration Notes

If you have existing code that creates GovernanceReferences:

**OLD:**

```typescript
{ section: 'X', path: './file.md' }
```

**NEW:**

```typescript
{
  document_id: 'epic-123',
  filename: 'file.md',
  markdown_path: './file.md',
  sections: ['X']
}
```

## Files Modified

1. `src/shared/ArtifactValidation.ts` - NEW
2. `src/features/FeatureValueDerivationAgent.ts` - Enhanced validation
3. `src/stories/FeatureToStoryAgent.ts` - Updated references + enhanced validation

## Compilation Status

✅ TypeScript: No errors  
✅ ESLint: All rules pass  
✅ Build: Successful  

## Testing

To verify hardening is working:

1. Run pipeline with test governance document
2. Check generated artifacts have:
   - Correct ID formats
   - All required fields (business_value, risks, governance refs)
   - Non-generic acceptance criteria
3. Verify validation fails if:
   - Feature restates epic text
   - Story restates feature text
   - Missing governance references
   - Generic criteria present

---

**Questions?** See `MUSE-Artifact-Contract-Hardening-Implementation.md` for full details.
