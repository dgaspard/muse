# AI Derivation Guardrails

## Scope Rules
- No LLM call may exceed a single semantic scope (one section or one job input).
- Epics cannot be derived directly from raw Markdown; they must be composed from section summaries.
- Features must reference their `epic_id` and contributing `section_ids`.
- User stories must reference both `feature_id` and `epic_id`, plus governance `section_ids`.
- All artifacts must reference governance source files and document IDs.

## Determinism & Idempotency
- Section splitting must be deterministic for the same input.
- Summary caching ensures idempotent re-runs; cached artifacts must be reused without regeneration.
- IDs (epic, feature, story, section) must be stable given the same inputs.

## Prompt Discipline
- Each LLM call must be bounded to its input scope only.
- Do not leak implementation details across stages.
- Fail fast on ambiguous or unsupported inputs.

## Rate-Limit Safety
- Apply token budgeting and concurrency limits for all LLM calls.
- Use exponential backoff for retry; no blind retries.
- Emit clear diagnostics for failures (rate limit, invalid output, schema mismatch).
