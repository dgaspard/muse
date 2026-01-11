# End-to-End Governance Workflow (MUSE-008)

## Purpose

The **Governance-to-Delivery Pipeline UI** provides a single-page workflow for product owners to upload a governance document and immediately see the derived Epic, Features, and User Stories. This review-first experience allows teams to validate AI-generated delivery artifacts before committing them to a repository or importing them into downstream tools.

## How It Works

### Pipeline Steps

1. **Upload Governance Document**
   - User uploads a PDF, DOCX, or TXT file containing governance policy
   - Document is persisted as immutable original (MUSE-002)

2. **Convert to Governance Markdown** (MUSE-003)
   - Original document is converted to canonical Markdown format
   - YAML front matter includes traceability metadata (document_id, source_checksum, generated_at)
   - Conversion preserves structure without hallucination or interpretation

3. **Derive Epic** (MUSE-005)
   - GovernanceIntentAgent reads governance Markdown
   - Generates Epic with objective, success criteria, and governance references
   - Epic is validated against schema (no implementation details, meaningful objectives)

4. **Derive Features from Epic** (MUSE-006)
   - FeatureDerivationAgent reads Epic and Governance Markdown
   - Extracts Features from Epic success criteria
   - Each Feature includes description, acceptance criteria, and governance references

5. **Derive User Stories from Features** (MUSE-007)
   - FeatureToStoryAgent reads Features and Governance Markdown
   - Generates INVEST-compliant User Stories (one per acceptance criterion, max 3 per feature)
   - Stories validated for:
     - No implementation leakage (title checks for "implement", "code", "build")
     - Meaningful benefit (>10 characters)
     - Testable acceptance criteria

6. **Render Results**
   - All artifacts displayed on-screen with full traceability
   - Copy-to-clipboard actions for Epic, Features, and Stories (individual and bulk)
   - No Git commits or PRs created (review-only mode)

### Data Flow

```text
Governance Document
        ↓
[Upload & Persist Original (MUSE-002)]
        ↓
[Convert to Markdown (MUSE-003)]
        ↓
[Derive Epic (MUSE-005)]
        ↓
[Derive Features (MUSE-006)]
        ↓
[Derive User Stories (MUSE-007)]
        ↓
[Render UI with Copy Actions]
```

## UI Design

### Progressive Disclosure

The UI reveals results as each pipeline stage completes:

- **Uploading Document** — File upload in progress
- **Converting to Markdown** — Document-to-Markdown conversion
- **Deriving Epic** — GovernanceIntentAgent generating Epic
- **Deriving Features** — FeatureDerivationAgent extracting Features
- **Deriving User Stories** — FeatureToStoryAgent creating Stories

### Artifact Presentation

#### Epic Display

- **Title** — Prominent heading
- **Objective** — What the epic achieves
- **Success Criteria** — Measurable outcomes (bullets)
- **Governance References** — Source sections from policy
- **Copy Action** — Copy Epic in canonical format

#### Features Display

- **List View** — All Features with feature_id and epic_id
- **Title & Description** — What the feature provides
- **Acceptance Criteria** — How to verify the feature (bullets)
- **Governance References** — Traceability to policy
- **Copy Actions** — Copy individual Feature or all Features

#### User Stories Display

- **INVEST Format** — Role, Capability, Benefit
- **Acceptance Criteria** — Testable conditions
- **Governance References** — Explicit traceability chain
- **Derived From** — Links to parent Epic and Feature
- **Copy Actions** — Copy individual Story or all Stories

### Copy-to-Clipboard Format

All artifacts are formatted for easy import into tools like Jira, Azure DevOps, or Linear:

```markdown
# Epic: Implement Multi-Factor Authentication

ID: epic-001

## Objective

Enable secure user authentication with multi-factor verification

## Success Criteria

- All users must authenticate with 2+ factors
- Session tokens expire after 30 minutes
- Failed login attempts are logged

## Governance References

- Section 2: Access Control
- Section 3: Audit Logging
```

## When to Use This Workflow

### Best For

- **Product Discovery** — Understanding what a governance document requires
- **Adoption & Onboarding** — Demonstrating Muse capabilities to stakeholders
- **Validation & Review** — Verifying AI-generated artifacts before automation
- **Policy Analysis** — Exploring implications of new regulations

### Not Intended For

- **Production Automation** — Use Git-backed flows (MUSE-004, PR creation) for CI/CD
- **Long-Term Artifact Management** — Artifacts are ephemeral; commit to Git for persistence
- **Free-Form AI Chat** — This is a deterministic pipeline, not conversational AI

## Differences from Git-Backed Automation

| Aspect | UI Workflow (MUSE-008) | Git Automation (MUSE-004+) |
| ------ | ---------------------- | -------------------------- |
| **Execution** | Manual, on-demand | Triggered by PR or schedule |
| **Output** | On-screen review | Committed to Git |
| **Persistence** | Temporary (session-only) | Permanent (version controlled) |
| **Approval** | Human review before use | Automated PR workflow |
| **Use Case** | Discovery, validation | Continuous delivery |

## How This Supports Product Ownership

### Discovery Phase

Product owners can upload draft governance documents to:

- See what Epics and Features emerge
- Validate that governance aligns with delivery expectations
- Identify gaps or ambiguities in policy

### Review & Validation

Before committing artifacts to a repository:

- Review AI-generated outputs for hallucination
- Verify INVEST compliance in User Stories
- Confirm governance traceability is explicit

### Stakeholder Communication

Copy artifacts into presentations, documents, or tickets:

- Show executives what compliance requires
- Share Features with engineering teams
- Provide Stories to scrum teams for estimation

### Adoption & Trust

Demonstrate Muse's value without requiring Git integration:

- Teams can experiment risk-free
- No repository pollution with draft artifacts
- Builds confidence in agent-based derivation

## Technical Implementation

### Backend - MusePipelineOrchestrator

The orchestrator coordinates all steps sequentially:

- **DocumentStore** — Persists original document
- **DocumentToMarkdownConverter** — Converts to canonical Markdown
- **EpicDerivationWorkflow** — Invokes GovernanceIntentAgent
- **FeatureDerivationWorkflow** — Invokes FeatureDerivationAgent
- **StoryDerivationWorkflow** — Invokes FeatureToStoryAgent

### API Endpoint - POST /pipeline/execute

Accepts multipart/form-data:

```text
projectId: string
file: File (PDF, DOCX, TXT)
```

Returns JSON:

```json
{
  "ok": true,
  "document": { "document_id": "...", "original_filename": "..." },
  "markdown": { "content": "...", "path": "..." },
  "epic": { "epic_id": "...", "title": "...", ... },
  "features": [ { "feature_id": "...", "title": "...", ... } ],
  "stories": [ { "story_id": "...", "title": "...", ... } ]
}
```

### Frontend - governance.tsx

Single-page React component:

- **Form** — Project ID + File upload
- **Progress Indicator** — Stage-by-stage execution display
- **Artifact Sections** — Epic, Features, Stories with copy actions
- **No State Persistence** — Results lost on page reload (by design)

## Constraints & Validation

### No Inline Editing

Artifacts are read-only. If changes are needed:

- Modify the governance source document
- Re-run the pipeline

### No Free-Form AI Chat

This is not a conversational interface. The pipeline is:

- Deterministic
- Schema-enforced
- Agent-based (not chat-based)

### System Outputs Only

UI reflects exactly what agents generate:

- No user customization
- No manual artifact creation
- Clear messaging: "Derived, not authoritative"

## Error Handling

### Fail Fast

If any step fails, the pipeline halts:

- **Upload failure** → "Storage error"
- **Conversion failure** → "Unsupported file format"
- **Epic derivation failure** → "Agent validation error"
- **Feature/Story derivation failure** → "INVEST compliance violation"

### Error Display

Errors are surfaced with:

- Stage context (which step failed)
- Error message (why it failed)
- User action (how to resolve)

Example:

```text
Error at Stage: Deriving User Stories
Message: Story title contains implementation detail: "Implement login API"
Action: Review governance document for policy clarity
```

## Testing

### Pipeline Unit Tests

- **MusePipelineOrchestrator** — Verifies execution order, fail-fast behavior
- **Mock Services** — DocumentStore and Converter are mocked for deterministic tests

### Integration Tests

- **End-to-End Pipeline** — Uploads test document, verifies all artifacts generated
- **Traceability Validation** — Confirms governance references appear in Epic, Features, Stories
- **INVEST Compliance** — Validates Stories have meaningful benefits, no implementation leakage
- **No Git Commits** — Asserts `.git` directory does not exist (review-first mode)

### E2E Tests

- **UI Workflow** — Uploads file via frontend, verifies artifacts render correctly
- **Copy Actions** — Validates clipboard contains properly formatted text
- **Error Scenarios** — Uploads invalid file, verifies error display

## Future Enhancements

### Session Persistence (Optional)

- Save pipeline results to session storage
- Allow users to refresh page without re-running pipeline

### Export Options (Optional)

- Download artifacts as ZIP file
- Export to Jira/Azure DevOps via API

### Batch Processing (Optional)

- Upload multiple governance documents
- Compare derived artifacts across documents

### Real-Time Collaboration (Optional)

- Share pipeline results via URL
- Allow teams to review artifacts together

## FAQ

### Q: Why don't artifacts persist after page reload

**A:** This is intentional. The UI is for review, not storage. Commit artifacts to Git for persistence.

### Q: Can I edit derived artifacts

**A:** No. Artifacts reflect governance source exactly. To change artifacts, modify the governance document and re-run.

### Q: Why is this better than manual decomposition

**A:**

- **Speed** — Seconds vs. hours
- **Traceability** — Explicit governance references at every level
- **Consistency** — Schema-enforced, INVEST-validated
- **Auditability** — All outputs traceable to immutable source

### Q: What if I don't like the derived artifacts

**A:** Review your governance document for clarity. Vague policy produces vague artifacts. The agent is a mirror, not a magic wand.

### Q: Can I use this in production

**A:** This UI is for review. For production, use Git-backed automation (MUSE-004, PR workflows, CI/CD integration).

### Q: Do I need to configure agents

**A:** No. Agents are pre-configured for deterministic, low-temperature operation. This is not a chatbot.

### Q: What file formats are supported

**A:** PDF, DOCX, TXT. Other formats require custom converters.

### Q: How long does the pipeline take

**A:** Typically 10-30 seconds depending on document size and complexity. Progress is shown in real-time.

### Q: Is this secure

**A:** Documents are stored locally (MinIO or filesystem). No external API calls during derivation. Suitable for regulated environments.

## Summary

The **Governance-to-Delivery Pipeline UI** bridges policy and delivery by making AI-generated artifacts visible, reviewable, and actionable. It supports product ownership by enabling discovery, validation, and stakeholder communication without requiring Git integration or CI/CD automation.

This workflow is **review-first, not automation-first**—designed for human oversight before artifacts become authoritative.
