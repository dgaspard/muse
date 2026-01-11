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
