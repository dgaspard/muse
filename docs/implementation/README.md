# Implementation Documentation

**Completed work documentation, architecture decisions, bug fixes, and validation records.**

## Structure

### [Artifact Separation](./artifact-separation.md)

Enforcement of clean boundaries between product artifacts (User Stories) and execution artifacts (AI Prompts). Documents the architectural fix, type system changes, and validation rules implemented.

### [Boundary Validation](../ARTIFACT-BOUNDARY-VALIDATION.md)

Comprehensive specification of artifact boundaries, validation rules, and implementation patterns. Defines what must/must not be in each artifact type.

### Historical Merges

Located in `/merges/`:

- [2026-01-13](./merges/2026-01-13.md) - User Story / AI Prompt Boundary Separation merge

### Bug Fixes & Patches

Located in `/fixes/`:

- [prompt-contradiction.md](./fixes/prompt-contradiction.md) - Summary of prompt contradiction fix
- [prompt-contradiction-validation.md](./fixes/prompt-contradiction-validation.md) - Validation testing for prompt contradiction fix

## Navigation

- [Back to Docs Home](../README.md)
- [Quality & Standards](../quality/)
- [Architecture Decisions](../architecture/)
- [Examples & Tutorials](../examples/)

---

**Convention:** Merge summaries are timestamped by date (YYYY-MM-DD) to maintain historical clarity.

**Last Updated:** January 18, 2026
