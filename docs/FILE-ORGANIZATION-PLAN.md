# Documentation Organization Plan

**Status**: Proposed
**Date**: January 18, 2026
**Goal**: Reduce root-level clutter and establish clear documentation structure

---

## Problem Statement

The repository has accumulated several markdown files at the root level and in various locations that:

- Create visual clutter for new developers
- Lack clear organization by topic
- Risk becoming stale without centralized ownership
- Make it harder to understand what documentation exists

**Current Root-Level Files** (8 files):

- `ARTIFACT-SEPARATION-SUMMARY.md`
- `CONTRIBUTING.md`
- `DEVELOPER_GUIDE.md`
- `MARKDOWN-LINTING-SUMMARY.md`
- `MERGE-SUMMARY.md`
- `PROMPT-CONTRADICTION-FIX-SUMMARY.md`
- `PROMPT-CONTRADICTION-FIX-VALIDATION.md`
- `VALIDATION_GUIDE.md`

**Additional Root/Scattered Files**:

- `architecture/muse-architecture.md` (in separate folder)
- `examples/muse-end-to-end-example.md` (in separate folder)
- `README.md` (stays at root - project entrypoint)

---

## Proposed Structure

### Keep at Root

These files remain at root because they are project-level entry points:

- **`README.md`** - Project overview and quick start
- **`CONTRIBUTING.md`** - Contribution guidelines (standard location)

### Move to `/docs`

#### 1. `/docs/guides/` - Developer and Contributor Guides

**Purpose**: Practical how-to documentation for developers

**Files to Move**:

- `DEVELOPER_GUIDE.md` → `/docs/guides/developer-guide.md`
- `VALIDATION_GUIDE.md` → `/docs/guides/validation-guide.md`

**New Content**:

- `contributing-guide.md` (copy from root `CONTRIBUTING.md` with expanded examples)
- `setup-guide.md` (local development environment setup)
- `testing-guide.md` (testing patterns and practices)

**README**: Create `/docs/guides/README.md` with index

#### 2. `/docs/architecture/` - Architecture and Design

**Purpose**: System design, data models, and architectural decisions

**Existing**:

- `/docs/architecture/semantic-pipeline.md`

**Files to Move**:

- `architecture/muse-architecture.md` → `/docs/architecture/system-architecture.md`

**New Content**:

- `design-decisions.md` (ADRs - Architectural Decision Records)
- `data-models.md` (domain entities and relationships)

**README**: Create `/docs/architecture/README.md` with overview

#### 3. `/docs/implementation/` - Implementation Summaries & Artifacts

**Purpose**: Completed work documentation, fixes, and validation

**Existing**:

- `/docs/Implementation Summaries/` (folder with Epic-specific docs)

**Files to Move**:

- `ARTIFACT-SEPARATION-SUMMARY.md` → `/docs/implementation/artifact-separation.md`
- `ARTIFACT-BOUNDARY-VALIDATION.md` → `/docs/implementation/boundary-validation.md` (already in docs, stays)
- `MERGE-SUMMARY.md` → `/docs/implementation/merge-2026-01-13.md`
- `PROMPT-CONTRADICTION-FIX-SUMMARY.md` → `/docs/implementation/fixes/prompt-contradiction.md`
- `PROMPT-CONTRADICTION-FIX-VALIDATION.md` → `/docs/implementation/fixes/prompt-contradiction-validation.md`

**Structure**:

```text
/docs/implementation/
├── README.md (index of all implementation docs)
├── artifact-separation.md
├── boundary-validation.md
├── merges/ (historical merge summaries)
│   └── 2026-01-13.md
└── fixes/ (bug fixes and patches)
    ├── prompt-contradiction.md
    └── prompt-contradiction-validation.md
```

**README**: Create `/docs/implementation/README.md` with summary

#### 4. `/docs/quality/` - Quality & Linting Standards

**Purpose**: Code quality, linting, and standards documentation

**Files to Move**:

- `MARKDOWN-LINTING-SUMMARY.md` → `/docs/quality/markdown-linting.md`

**New Content**:

- `linting-configuration.md` (all linting tool configs)
- `code-standards.md` (TypeScript, Python, general standards)
- `testing-standards.md` (test coverage expectations)
- `security-checklist.md` (security validation steps)

**README**: Create `/docs/quality/README.md` with overview

#### 5. `/docs/examples/` - Examples & Tutorials

**Purpose**: Practical examples and end-to-end tutorials

**Existing**: `examples/muse-end-to-end-example.md`

**Files to Move**:

- `examples/muse-end-to-end-example.md` → `/docs/examples/end-to-end-workflow.md`

**New Content**:

- `quick-start.md` (5-minute setup)
- `feature-implementation.md` (implement an epic → feature → story)
- `ai-prompt-generation.md` (generate and run AI prompts)

**README**: Create `/docs/examples/README.md` with overview

---

## Migration Strategy

### Phase 1: Prepare (Low Risk)

1. Create new directory structure under `/docs`
2. Create `README.md` files for each new subfolder with indices
3. Leave root files in place (no deletes yet)

### Phase 2: Move Files

1. Create `/docs/guides/`, `/docs/implementation/`, `/docs/quality/`, `/docs/examples/`
2. Move files with exact content (no edits)
3. Update internal links in moved files to reference new paths

### Phase 3: Update References

1. Update root `README.md` to link to documentation in `/docs`
2. Update `.github/README.md` and copilot instructions to point to `/docs/guides`
3. Add `CONTRIBUTING.md` cross-reference: "See `/docs/guides/contributing-guide.md` for details"

### Phase 4: Verify & Clean (After Tests Pass)

1. Run full smoke tests to verify no broken links
2. Create a `DOCS_MIGRATION_LOG.md` documenting what moved where
3. Delete original root-level files once verified
4. Update git history if needed (or leave as tombstones for blame)

---

## Updated Root Structure (After Migration)

```text
.
├── README.md                      # Project overview
├── CONTRIBUTING.md                # Contribution quick reference (link to docs)
├── docker-compose.yml
├── package.json
├── .markdownlintrc.yaml
├── .github/
├── apps/
├── services/
├── contracts/
├── docs/
│   ├── README.md                  # Documentation home
│   ├── guides/
│   │   ├── README.md
│   │   ├── developer-guide.md
│   │   ├── validation-guide.md
│   │   ├── contributing-guide.md
│   │   └── testing-guide.md
│   ├── architecture/
│   │   ├── README.md
│   │   ├── system-architecture.md
│   │   └── semantic-pipeline.md
│   ├── implementation/
│   │   ├── README.md
│   │   ├── artifact-separation.md
│   │   ├── boundary-validation.md
│   │   ├── merges/
│   │   │   └── 2026-01-13.md
│   │   └── fixes/
│   │       ├── prompt-contradiction.md
│   │       └── prompt-contradiction-validation.md
│   ├── quality/
│   │   ├── README.md
│   │   └── markdown-linting.md
│   ├── examples/
│   │   ├── README.md
│   │   └── end-to-end-workflow.md
│   ├── governance/
│   ├── stories/
│   ├── epics/
│   ├── ui/
│   └── testing/
├── prompts/
├── backlog/
├── examples/
└── storage/
```

---

## Benefits

1. **Clarity**: New developers see a clean root, know where to look for documentation
2. **Scalability**: Subdirectories organized by purpose, not by date or issue number
3. **Maintenance**: Documentation grouped by topic makes it easier to keep related docs in sync
4. **Discoverability**: `/docs/README.md` becomes the central index
5. **Onboarding**: New contributors can follow `/docs/guides/` in order
6. **Reduced Noise**: Root directory focuses on essentials (README, CONTRIBUTING, configs)

---

## Implementation Notes

- Keep `.github/` files in `.github/` (standard GitHub location)
- Keep `/contracts` separate (governance policies, not developer docs)
- Consider adding `docs/.gitkeep` to subdirectories if initially empty
- Update CI/CD and linting configurations to include new paths
- Ensure link validation in smoke tests catches broken references

---

## Timeline

- **Week 1**: Phase 1 (setup structure) and Phase 2 (move files)
- **Week 2**: Phase 3 (update references) and Phase 4 (verify & clean)

---

## Decision Points for Future Discussion

1. **Should `CONTRIBUTING.md` stay at root?** (Recommendation: Yes, GitHub convention)
2. **Should we version merge summaries by date?** (Recommendation: Yes, `/docs/implementation/merges/YYYY-MM-DD.md`)
3. **Should existing docs/ subfolders be reorganized?** (e.g., `/docs/epics`, `/docs/stories` stay or consolidate?)
4. **Should we create a `/docs/GLOSSARY.md`?** (For domain terminology)

---

**Next Steps**: Community review and feedback before Phase 1 execution.
