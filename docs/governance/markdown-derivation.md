# Markdown Derivation — Why, What, and How

**Date:** January 10, 2026  
**Status:** MUSE-003 Implementation Specification  
**Artifact Type:** Governance Documentation

---

## Overview

This document explains why Muse converts uploaded governance documents to Markdown, what is preserved in that conversion, and how reviewers should treat Markdown artifacts in relation to the immutable original.

**Core Principle:** Markdown is a *derived artifact*, not the authoritative record. The **original uploaded document** (as persisted in MUSE-002) remains the system of record.

---

## Why Markdown?

### 1. Version Control Compatibility
Governance documents must be reviewable and diffable in GitHub. Markdown is:
- **Plain text**: Git diffs show exact changes at the line level.
- **Human-readable**: No binary rendering required.
- **Minimal formatting**: Focus on content, not presentation.

### 2. Auditability and Traceability
Markdown artifacts include YAML front matter linking them to the immutable original:
```yaml
---
document_id: <sha256-hash-of-original>
source_checksum: sha256:<original-hash>
generated_at: <ISO-8601-timestamp>
derived_artifact: governance_markdown
original_filename: <original.pdf>
---
```

Every Markdown file can be traced back to the exact document from which it was derived.

### 3. Structural Preservation Without Loss
Markdown preserves:
- **Headings and hierarchy** (mapped to `#`, `##`, `###`, etc.)
- **Paragraph structure** (blank lines between sections)
- **List formatting** (bullets, numbering preserved where evident)
- **Emphasis** (`*bold*`, `_italic_`)
- **Links** where extractable

Markdown does **not** attempt to preserve:
- Visual styling (fonts, colors, page breaks)
- Complex layouts or multi-column text
- Embedded images or diagrams
- Precise spacing or indentation

---

## What Is Preserved vs. What Is Not

### ✅ Preserved
| Aspect | Example | Format |
|--------|---------|--------|
| **Section headings** | "Access Control Policy" | `# Access Control Policy` |
| **Subheadings** | "3.1 User Authentication" | `## 3.1 User Authentication` |
| **Paragraph flow** | Multiple lines grouped together | Multiple lines with blank separator |
| **Lists** | Numbered or bulleted items | `- Item` or `1. Item` |
| **Emphasis** | Bold, italic, underline | `**bold**`, `_italic_` |
| **Basic tables** | Structured data | Markdown table syntax |
| **Hyperlinks** | URLs or cross-references | `[text](url)` |

### ❌ Not Preserved
| Aspect | Why | Mitigation |
|--------|-----|-----------|
| **Visual styling** | Markdown is semantic, not presentational | Refer to original for visual intent |
| **Page breaks** | Not meaningful in web/diff context | Use headings to mark logical sections |
| **Embedded images** | Cannot extract reliably from all formats | Link to or reference in comments |
| **Complex tables** | Some layout preserved; some lost | Verify complex data in original |
| **Precise spacing** | Not semantically meaningful | Markdown normalizes whitespace |
| **Watermarks, drafts** | Document metadata preserved in front matter | Check source document for context |

---

## How Reviewers Should Treat Markdown

### 🎯 For Compliance Review
1. **Check the original document first** if you need to verify exact formatting or legal language.
2. **Use Markdown for structure and flow** — headings, lists, and organization are preserved.
3. **Reference the Markdown in GitHub reviews** — it's diff-friendly and version-controlled.
4. **Escalate formatting concerns to the original** — if exact visual presentation matters.

### 🔄 For Version Control and Diff Review
1. **Markdown diffs are authoritative for content changes** — you can see exactly what text was added or removed.
2. **DO NOT edit the Markdown directly** in the repo. The original document is the source of truth.
3. **If you need to change governance**, update the **original document** and re-generate the Markdown.
4. **The YAML front matter is immutable** — it links the Markdown to the source. Do not modify it.

### 🚨 For Discrepancies
If you notice a discrepancy between Markdown and the original:
1. **The original document is authoritative.** The Markdown is the derived artifact.
2. **Report extraction issues** to the development team.
3. **Do not assume the Markdown is "correct"** — use it for convenience, but verify in the original.

---

## Generation Process

### Input
- Immutable original document (PDF, DOCX, etc.)
- Document ID (SHA-256 hash of original bytes)
- Original checksum (for linking)

### Processing
1. Extract text structure and headings from the document.
2. Map hierarchy to Markdown heading levels.
3. Preserve paragraph boundaries and lists.
4. **Do not infer, summarize, or interpret** policy meaning.
5. **Do not add missing sections** or reorganize the structure.

### Output
- **Markdown file** with YAML front matter
- Stored at `/docs/governance/{document_id}.md`
- Registered in project manifest (`muse.yaml`)

### Determinism
The same document will always produce the **identical Markdown** (same line breaks, same structure, same metadata timestamp down to the second).

This ensures that:
- No "silent" changes occur during regeneration
- Diffs between versions are meaningful and trustworthy
- Reviewers can rely on Markdown as a proxy for the original

---

## Example

### Original Document
```
Access Control Policy (v2.1)

1. Overview
Access control is the primary mechanism for enforcing...

2. User Authentication
2.1 Password Requirements
Passwords must be at least 12 characters...

2.2 Multi-Factor Authentication
All administrative accounts must use...
```

### Generated Markdown
```yaml
---
document_id: a3f7c9e2b1d4...
source_checksum: sha256:a3f7c9e2b1d4...
generated_at: 2026-01-10T19:05:00Z
derived_artifact: governance_markdown
original_filename: Access-Control-Policy-v2.1.pdf
---
```

```markdown
# Access Control Policy (v2.1)

## 1. Overview

Access control is the primary mechanism for enforcing...

## 2. User Authentication

### 2.1 Password Requirements

Passwords must be at least 12 characters...

### 2.2 Multi-Factor Authentication

All administrative accounts must use...
```

---

## Non-Compliance Risk

### When Markdown Differs from the Original
This indicates one of:
1. **Conversion error** — The converter failed to extract content correctly.
2. **Formatting ambiguity** — The original uses styling (e.g., colored headers) that isn't captured in text.
3. **Complex layout** — Multi-column, overlaid text, or conditional content.

### Mitigation
- Always reference the **original document** for legal or compliance-critical decisions.
- Use Markdown for **organizational review** and **tracking changes**.
- Escalate discrepancies to the team if the original cannot be reliably represented in Markdown.

---

## Future Enhancements

- **Pluggable converters** for DOCX, Google Docs, etc.
- **Enhanced PDF extraction** using OCR for scanned documents.
- **Asset references** for embedded images and diagrams.
- **Annotation support** for review and comment tracking.

---

## Summary

| Question | Answer |
|----------|--------|
| **Is Markdown the source of truth?** | **No.** The original document is. Markdown is derived. |
| **Can I edit the Markdown directly?** | **No.** Update the original and re-generate. |
| **How do I verify a policy change?** | Check the **original document** and Markdown **diff together**. |
| **What if Markdown doesn't match the original?** | Report it as a conversion issue. Use the original as reference. |
| **Can I version-control the Markdown in GitHub?** | **Yes.** It's meant for that. But don't edit it manually. |
| **What if I need visual formatting preserved?** | Store the original file as well (in binary storage). Markdown captures structure. |

---

**This specification ensures that Muse's governance artifacts remain traceable, auditable, and trustworthy.**

---

epic:
  epic_id: epic-markdown-derivation
  title: Ensure traceable, auditable governance markdown derivation
  objective: Establish deterministic, auditable Markdown derivation so reviewers can trust lineage to the immutable original while using Git-based workflows.
  success_criteria:
    - Markdown artifacts always include front matter linking to the exact original document (ID and checksum).
    - Reviewers can diff governance content in Git without touching the original or front matter.
    - Conversion preserves structure (headings, lists, paragraphs) with predictable, deterministic output.
    - Discrepancies between Markdown and original are detectable and escalated with clear remediation steps.
    - Markdown locations and provenance (paths, filenames) remain stable and discoverable for audits.
    - Operational reviewers rely on Markdown for flow, while compliance reviewers can trace to originals for legal certainty.
  governance_references:
    - document_id: markdown-derivation
      filename: markdown-derivation.md
      sections:
        - Overview
        - Why Markdown?
        - What Is Preserved vs. What Is Not
        - How Reviewers Should Treat Markdown
        - Generation Process
        - Non-Compliance Risk
        - Summary

features:
  - feature_id: demo-project-epic-markdown-derivation-feature-01
    title: Immutable provenance in derived markdown
    business_value: Ensures auditability by binding every Markdown artifact to its exact original via immutable metadata.
    description: Enforce front matter with document_id, checksum, timestamps, and original filename so provenance is never lost.
    acceptance_criteria:
      - Each generated Markdown includes document_id, source_checksum, generated_at, original_filename, and derived_artifact fields.
      - Markdown files are written to stable paths and are discoverable via manifest entries.
      - Front matter is treated as immutable and cannot be edited during review workflows.
    risk_of_not_delivering:
      - Audit trails become unverifiable, leading to failed compliance checks.
      - Reviewers cannot prove which original a Markdown file was derived from, weakening legal defensibility.
    governance_references:
      - document_id: markdown-derivation
        filename: markdown-derivation.md
        sections:
          - Generation Process
          - Why Markdown?
    derived_from_epic: epic-markdown-derivation
    implements_user_stories:
      - demo-project-demo-project-epic-markdown-derivation-feature-01-story-01-provenance-front-matter
      - demo-project-demo-project-epic-markdown-derivation-feature-01-story-02-immutable-front-matter

  - feature_id: demo-project-epic-markdown-derivation-feature-02
    title: Deterministic, structure-preserving conversion
    business_value: Provides consistent diffs and reviewer trust by preserving headings, lists, and paragraph flow deterministically.
    description: Conversion must yield repeatable Markdown that preserves structure without inferring or summarizing policy meaning.
    acceptance_criteria:
      - Regenerating from the same original yields byte-identical Markdown (including line breaks and headings).
      - Headings, lists, and paragraph boundaries are preserved; no summarization or inferred sections are added.
      - Non-preserved elements (styling, images) are explicitly excluded or noted as limitations.
    risk_of_not_delivering:
      - Diffs become noisy or misleading, eroding reviewer confidence.
      - Policy meaning could be altered by inconsistent extraction, creating compliance risk.
    governance_references:
      - document_id: markdown-derivation
        filename: markdown-derivation.md
        sections:
          - Why Markdown?
          - What Is Preserved vs. What Is Not
          - Generation Process
    derived_from_epic: epic-markdown-derivation
    implements_user_stories:
      - demo-project-demo-project-epic-markdown-derivation-feature-02-story-01-deterministic-regeneration
      - demo-project-demo-project-epic-markdown-derivation-feature-02-story-02-structure-preservation

  - feature_id: demo-project-epic-markdown-derivation-feature-03
    title: Reviewer guidance and discrepancy handling
    business_value: Reduces compliance risk by guiding reviewers to use Markdown for diffs while escalating discrepancies to the original.
    description: Provide clear reviewer workflows for using Markdown, tracing to originals, and reporting extraction issues.
    acceptance_criteria:
      - Reviewer guidance defines when to rely on Markdown vs. original, with escalation steps for discrepancies.
      - Discrepancy reports capture source path and section to enable remediation.
      - Governance references are present in Markdown to support quick traceability during review.
    risk_of_not_delivering:
      - Reviewers may misinterpret derived content and miss policy issues.
      - Undetected extraction errors could propagate into downstream delivery work.
    governance_references:
      - document_id: markdown-derivation
        filename: markdown-derivation.md
        sections:
          - How Reviewers Should Treat Markdown
          - Non-Compliance Risk
          - Summary
    derived_from_epic: epic-markdown-derivation
    implements_user_stories:
      - demo-project-demo-project-epic-markdown-derivation-feature-03-story-01-reviewer-traceability
      - demo-project-demo-project-epic-markdown-derivation-feature-03-story-02-discrepancy-escalation

  - feature_id: demo-project-epic-markdown-derivation-feature-04
    title: Manifested discoverability of governance artifacts
    business_value: Ensures governance markdown is locatable and auditable via manifests and stable paths.
    description: Register derived markdown in manifests with document_id and paths, enabling discovery and audit queries.
    acceptance_criteria:
      - Derived markdown entries include document_id, filename, and markdown_path in the manifest.
      - Manifest lookups can return the governance markdown path for any stored document_id.
    risk_of_not_delivering:
      - Governance artifacts become orphaned, increasing audit gaps.
      - Teams cannot reliably locate the correct derived markdown for review or delivery.
    governance_references:
      - document_id: markdown-derivation
        filename: markdown-derivation.md
        sections:
          - Generation Process
          - Summary
    derived_from_epic: epic-markdown-derivation
    implements_user_stories:
      - demo-project-demo-project-epic-markdown-derivation-feature-04-story-01-manifest-registration
      - demo-project-demo-project-epic-markdown-derivation-feature-04-story-02-manifest-lookup

user_stories:
  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-01-story-01-provenance-front-matter
    title: Provenance front matter is present
    role: compliance analyst
    capability: verify that derived markdown includes immutable provenance fields
    benefit: ensure every markdown artifact is traceable to its original for audits
    acceptance_criteria:
      - Markdown contains document_id, source_checksum, generated_at, original_filename, derived_artifact in front matter.
      - Front matter is unchanged during review (immutable check).
    derived_from_feature: demo-project-epic-markdown-derivation-feature-01
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: Generation Process
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-01-story-02-immutable-front-matter
    title: Prevent edits to provenance
    role: repository maintainer
    capability: block mutations to front matter fields in governance markdown
    benefit: preserve audit integrity and chain of custody
    acceptance_criteria:
      - Commits modifying provenance fields are rejected or flagged.
      - Provenance validation runs in CI for governance markdown changes.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-01
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: How Reviewers Should Treat Markdown
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-02-story-01-deterministic-regeneration
    title: Deterministic markdown regeneration
    role: build engineer
    capability: regenerate markdown and obtain byte-identical output for the same source
    benefit: provide trustworthy diffs for reviewers
    acceptance_criteria:
      - Regeneration from the same source produces identical markdown (including line breaks).
      - Tests validate heading and list preservation; no added or omitted sections.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-02
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: Generation Process
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-02-story-02-structure-preservation
    title: Preserve headings and lists
    role: governance reviewer
    capability: see original structural hierarchy (headings, lists, paragraphs) in markdown
    benefit: review content accurately without needing original for structure
    acceptance_criteria:
      - Headings and list items from the source appear with correct levels in markdown.
      - No inferred or summarized content is introduced.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-02
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: What Is Preserved vs. What Is Not
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-03-story-01-reviewer-traceability
    title: Reviewer traceability workflow
    role: compliance reviewer
    capability: trace any markdown section to the original document and know when to escalate
    benefit: reduce compliance risk from extraction discrepancies
    acceptance_criteria:
      - Guidance links markdown sections to original and defines when to defer to original.
      - Discrepancy handling playbook is documented and referenced in reviews.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-03
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: How Reviewers Should Treat Markdown
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-03-story-02-discrepancy-escalation
    title: Discrepancy escalation
    role: governance steward
    capability: record and escalate markdown/original mismatches with source paths
    benefit: ensure extraction issues are addressed before delivery
    acceptance_criteria:
      - Discrepancy reports capture markdown path, section, and issue type.
      - Escalation path is defined; unresolved discrepancies block downstream use.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-03
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: Non-Compliance Risk
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-04-story-01-manifest-registration
    title: Register governance markdown in manifest
    role: platform engineer
    capability: record derived governance markdown in a manifest keyed by document_id
    benefit: make governance artifacts discoverable and auditable
    acceptance_criteria:
      - Manifest entries include document_id, filename, and markdown_path.
      - Manifest queries by document_id return the registered markdown path.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-04
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: Generation Process
        path: docs/governance/markdown-derivation.md

  - story_id: demo-project-demo-project-epic-markdown-derivation-feature-04-story-02-manifest-lookup
    title: Lookup governance markdown by ID
    role: auditor
    capability: retrieve governance markdown path given a document_id during audits
    benefit: accelerate audits and reduce risk of orphaned artifacts
    acceptance_criteria:
      - Given a document_id, the system returns the markdown path and filename.
      - Missing manifest entries are flagged as errors for remediation.
    derived_from_feature: demo-project-epic-markdown-derivation-feature-04
    derived_from_epic: epic-markdown-derivation
    governance_references:
      - section: Summary
        path: docs/governance/markdown-derivation.md
