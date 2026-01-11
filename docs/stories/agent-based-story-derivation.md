# Agent-Based User Story Derivation (MUSE-007)

## Overview

MUSE-007 completes the governance-to-delivery decomposition loop by translating Features into **clear, testable, INVEST-compliant user stories** that developers can implement.

This document explains:
- Why INVEST matters for AI-generated requirements
- How product owners should review stories
- How governance traceability flows into delivery
- How Muse prevents requirement hallucination

---

## Why INVEST Matters

INVEST is an acronym representing six qualities of well-formed user stories:

- **Independent**: Stories should be self-contained and deliverable without tight dependencies
- **Negotiable**: Stories describe what, not how — implementation details are left to developers
- **Valuable**: Every story delivers user or business value
- **Estimable**: Stories are clear enough for developers to size the work
- **Small**: Stories are small enough to complete in a single iteration
- **Testable**: Stories include acceptance criteria that define done

### Why AI-Generated Stories Need INVEST

Without INVEST constraints, AI-generated requirements can:
- Leak technical implementation details (violating "Negotiable")
- Create massive, unscoped epics (violating "Small")
- Generate vague aspirations with no measurable outcome (violating "Testable")
- Invent features not implied by governance (violating traceability)

MUSE enforces INVEST compliance through:
1. **Schema validation** — Stories must have role, capability, benefit, and acceptance criteria
2. **INVEST validation** — Stories are checked for implementation leakage, vague benefits, and missing testability
3. **Hard failure** — Invalid stories fail the workflow; no silent correction

---

## How Product Owners Should Review Stories

### Pre-Review Checklist

Before accepting AI-generated stories, verify:

1. **Traceability is preserved**
   - Each story references the Feature it derives from
   - Each story references the Epic
   - Each story references the Governance source section

2. **INVEST compliance is met**
   - Story title describes user value, not technical tasks
   - Benefit is clear and meaningful
   - Acceptance criteria are testable

3. **Scope is not invented**
   - Story does not introduce requirements not in the Feature
   - Story does not add technical architecture decisions
   - Story stays within governance boundaries

### Story Review Process

1. **Read the generated story Markdown** at `docs/stories/<epic-id>-stories.md`
2. **Check muse.yaml** to confirm story artifacts are registered
3. **Review governance references** to verify source alignment
4. **Validate acceptance criteria** are testable and complete
5. **Approve or reject** based on INVEST compliance and traceability

### Rejection Criteria

Reject a story if:
- Title contains implementation detail ("Implement X", "Code Y")
- Benefit is too vague to understand value
- Acceptance criteria are missing or untestable
- Story invents scope not in the Feature
- Governance reference is missing or incorrect

---

## How Governance Traceability Flows Into Delivery

Muse maintains an explicit traceability chain from governance intent to delivered code:

```
Governance Document (Immutable)
  ↓
Governance Markdown (MUSE-003)
  ↓
Epic (MUSE-005)
  ↓
Features (MUSE-006)
  ↓
User Stories (MUSE-007)
  ↓
Implementation (Developer)
```

### Traceability Artifacts

Every story includes:
- `derived_from_feature` — Feature ID
- `derived_from_epic` — Epic ID
- `governance_references` — List of governance sections

These references appear in:
1. **Story Markdown front matter** — Machine-readable YAML
2. **Story body** — Human-readable governance references section
3. **muse.yaml** — Centralized artifact registry

### Why This Matters

In regulated environments:
- Auditors need proof that delivered code satisfies governance requirements
- Traceability must survive refactoring and re-derivation
- Every artifact must reference its source of authority

Muse ensures traceability is:
- **Explicit** — No inferred or assumed references
- **Immutable** — Governance documents are never modified
- **Auditable** — muse.yaml provides a complete artifact lineage

---

## How Muse Prevents Requirement Hallucination

### What is Requirement Hallucination?

Requirement hallucination occurs when AI:
- Invents features not present in governance
- Infers unstated user needs
- Adds technical implementation detail
- Creates scope beyond governance authority

### Prevention Mechanisms

1. **Bounded Agents**
   - `FeatureToStoryAgent` is a single-purpose agent
   - Reads Features and Governance (read-only)
   - Does not design solutions or write code
   - Outputs strictly validated schema

2. **Schema Validation**
   - Stories must conform to exact schema
   - Extra fields are rejected
   - Missing fields trigger hard failure
   - No silent correction or inference

3. **INVEST Validation**
   - Stories are checked for implementation leakage
   - Vague benefits are rejected
   - Missing acceptance criteria fail validation
   - Technical detail in titles is flagged

4. **Retry Logic**
   - Failed validations trigger one retry
   - Second failure halts the workflow
   - No silent fallback or invented scope

5. **Read-Only Governance**
   - Governance Markdown is never modified
   - Features are never modified
   - Traceability is append-only

### Example: Hallucination Blocked

**Feature:**
> Users need a secure way to authenticate.

**Hallucinated Story (REJECTED):**
> As a developer, I want to implement OAuth2 with JWT tokens, so that we have secure authentication.

**Why Rejected:**
- Role is "developer" (not user-facing)
- Title contains implementation detail ("implement OAuth2")
- Governance does not specify OAuth2 or JWT
- Story leaks technical design

**Correct Story (ACCEPTED):**
> As a user, I want to log in with my credentials, so that I can access my account securely.

---

## Story Markdown Format

MUSE-007 generates stories in a canonical format:

```markdown
---
derived_from_epic: epic-001
derived_from_features:
  - feature-001
source_features: docs/features/doc-7f3a-features.md
generated_at: 2026-01-11T12:00:00Z
---

## User Story: Log in with credentials

**Story ID:** story-001  
**Derived From Feature:** feature-001  
**Derived From Epic:** epic-001  

**As a** user,  
**I want** to log in with my credentials,  
**So that** I can access my account securely.

### Governance References
- Section: Authentication Policy  
  Source: docs/governance/policy.md

### Acceptance Criteria
- User can enter username and password
- System validates credentials
- User receives appropriate feedback
```

---

## Integration with CI/CD

### Automated Validation

Story derivation can be automated in CI:

```bash
# services/api/src/stories/StoryDerivationWorkflow.ts
npm run muse:derive-stories
```

CI should:
1. Run story derivation from Features
2. Validate schema and INVEST compliance
3. Run unit tests
4. Run integration tests
5. Fail the build if validation fails

### Pull Request Requirements

PRs that include stories should:
- Include story Markdown files
- Update muse.yaml
- Pass all tests
- Reference Feature and Epic IDs in PR description

---

## FAQ

**Q: Can I manually edit generated stories?**  
A: Yes, but edits should be made in the story Markdown file and committed to Git. Do not modify governance or features to "fix" stories.

**Q: What if a story fails INVEST validation?**  
A: The workflow will retry once. If it fails again, the workflow stops. Review the Feature to ensure it provides enough context for story derivation.

**Q: How do I know if a story invents scope?**  
A: Compare the story to the Feature. If the story includes requirements, technical decisions, or capabilities not mentioned in the Feature, it likely invents scope.

**Q: Can I skip INVEST validation?**  
A: No. INVEST validation is mandatory to prevent hallucination and ensure delivery-ready stories.

**Q: How many stories should a Feature produce?**  
A: Typically 1-3 stories per Feature. Features with many acceptance criteria may produce more stories, but each should be independently valuable.

---

## Summary

MUSE-007 translates Features into INVEST-compliant user stories with:
- Strict schema validation
- INVEST compliance checks
- Governance traceability
- Hallucination prevention
- Auditable artifact lineage

Product owners should review stories for traceability, INVEST compliance, and scope accuracy before accepting them for implementation.
