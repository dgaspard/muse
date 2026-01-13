# Derivation Contracts (Testing)

## Stage Inputs / Outputs

### Deterministic Sectioning
- Input: governance Markdown (path, content)
- Output: array of sections `{ id, title, content, source_path, start_line, end_line }`

### SectionSummaryJob
- Input: single section
- Output: `{ section_id, obligations[], actors[], constraints[], references[] }`
- Cache key: content hash + section id

### EpicDerivationJob
- Input: all section summaries
- Output: `<=12` Epics `{ epic_id, objective, success_criteria[], source_sections[] }`

### FeatureDerivationJob
- Input: per Epic
- Output: `<=5` Features (may nest) `{ feature_id, title, description, epic_id, source_sections[] }`

### UserStoryDerivationJob
- Input: per Feature
- Output: `1–5` Stories `{ story_id, title, role, capability, benefit, epic_id, feature_id, source_sections[] }`

## Deterministic Behavior
- Given the same input, section splitter must produce identical section arrays.
- IDs for all artifacts must remain stable.

## Idempotency Rules
- Re-runs must reuse cached section summaries; no regeneration if unchanged.
- Downstream derivations must be deterministic given identical inputs.

## Validation
- Governance lineage is explicit and test-verified.
- No single LLM call exceeds its scope.
- Artifacts are generated hierarchically and cached stages are reused.
