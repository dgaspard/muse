# Semantic Pipeline Architecture (Staged Derivation)

## Overview

A multi-phase, token-aware governance-to-delivery pipeline designed to process large governance documents without LLM rate-limit failures. The pipeline is deterministic, traceable, and cache-friendly.

## Pipeline (Textual Diagram)

Document (Markdown) → Deterministic Sectioning → Section Summaries (cached) → Top-Down Derivation:

- Epics (≤12) ← references Section IDs
- Features (≤5 per Epic, nested allowed) ← references Epic ID + Section IDs
- User Stories (1–5 per Feature) ← references Feature ID + Epic ID + Section IDs

Then: Artifact caching + traceability, token-aware throttling and safe parallelism.

## Deterministic Sectioning

- Split by semantic headers (`##`, `###`), preserving order and hierarchy.
- Generate stable Section IDs: `sec-<docId>-<nn>` derived from content hash and position.
- Preserve `source_path`, `start_line`, `end_line` for traceability.

## Section-Level Summaries

- `SectionSummaryJob` processes one section per LLM call.
- Output: obligations, actors, constraints, references.
- Cached by section hash to ensure idempotency and reuse.
- Safe parallel execution guarded by token budgeting and concurrency limits.

## Top-Down Derivation

- `EpicDerivationJob`: consumes all section summaries; emits ≤12 Epics with contributing section IDs.
- `FeatureDerivationJob`: runs per Epic; emits ≤5 Features; supports nesting; explicit `epic_id` linkage.
- `UserStoryDerivationJob`: runs per Feature; emits 1–5 stories; includes `epic_id`, `feature_id`, and governance references.

## Caching Strategy

- Summary caching: content-hash key → summary artifact.
- Downstream jobs include summary references to avoid recompute.
- Idempotent re-runs reuse cached summaries; downstream derivation remains deterministic given same inputs.

## Rate-Limit Mitigation

- Token budgeting per stage with maximum tokens per call.
- Concurrency caps using a rate limiter.
- Exponential backoff retries with clear diagnostics.
- No blind retries; failures surface explicit messages with actionable detail.

## Traceability

- All artifacts carry provenance:
  - `derived_from`: governance document ID
  - `source_sections`: list of section IDs and locations
  - `epic_id` / `feature_id` relationships
  - `source_path` and checksum references

## Non-Goals

- No external API changes in this refactor stage.
- No prompt optimization beyond scope control.
- No UI changes.
