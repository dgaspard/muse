# Muse Demo Workflow – INVEST User Stories

This document defines a **progressive set of user stories** that, taken
together, create the end‑to‑end Muse demo workflow:

> Policy user uploads a document → Muse derives Epic → Features →
> User Stories → AI prompts → submits a GitHub Pull Request for
> developer review.

Stories are written to conform to the **INVEST model**:

* **Independent**
* **Negotiable**
* **Valuable**
* **Estimable**
* **Small**
* **Testable**

The list is intentionally **iterative**: each stage delivers visible value and can
be demoed independently, while building toward the final experience.

---

## EPIC-001: Governance-to-Code Translation (Muse Core Demo)

**Objective:** Demonstrate how Muse turns governance documents into
developer-ready GitHub artifacts.

Source audience: GitHub Senior Technical Engineering Sales
interview demo.

---

## Phase 1: Document Ingestion (Visible Starting Point)

### MUSE-001 — Upload governance document via web UI

**As a policy owner**,
I want to upload a governance or compliance document through a web interface,
So that it can be analyzed and translated into engineering artifacts.

#### Acceptance Criteria (MUSE-001)

* Web UI allows file upload (DOCX, PDF, or TXT)
* Upload is associated with a project
* Upload completion is confirmed to the user

#### INVEST Notes

* Independent: No downstream processing required
* Valuable: Establishes user entry point

---

### MUSE-002 — Persist original document as system of record

**As a platform**,
I want to store the original uploaded document unchanged,
So that governance intent is preserved for audit and traceability.

#### Acceptance Criteria (MUSE-002)

* Original file is stored immutably
* Storage location is traceable from future artifacts

---

## Phase 2: Governance → Markdown (Explainability Layer)

### MUSE-003 — Convert uploaded document to Markdown

**As a platform**,
I want to convert uploaded governance documents into Markdown,
So that they are diffable, reviewable, and version-controlled in GitHub.

#### Acceptance Criteria (MUSE-003)

* Markdown is generated from the uploaded document
* Markdown preserves headings and key sections

---

### MUSE-004 — Commit governance Markdown to GitHub

**As a developer**,
I want governance documentation committed to the repository as Markdown,
So that policy changes are visible and reviewable like code.

#### Acceptance Criteria (MUSE-004)

* Markdown is committed to `/docs/governance/`
* Commit references the originating upload

---

## Phase 3: Governance → Backlog (Product Translation)

### MUSE-005 — Derive an Epic from governance intent

**As a product owner**,
I want Muse to derive an Epic from the uploaded governance document,
So that high‑level outcomes are clear before implementation begins.

#### Acceptance Criteria (MUSE-005)

* Epic includes objective and success criteria
* Epic references source governance Markdown

---

### MUSE-006 — Derive Features from the Epic

**As a product owner**,
I want Muse to derive Features from the Epic,
So that large outcomes are broken into implementable capabilities.

#### Acceptance Criteria (MUSE-006)

* Each Feature maps back to the Epic
* Feature scope is implementation‑oriented

---

### MUSE-007 — Derive INVEST‑compliant user stories

**As a product owner**,
I want Muse to generate INVEST‑compliant user stories,
So that developers receive clear, testable requirements.

#### Acceptance Criteria (MUSE-007)

* Stories follow the canonical Muse story format
* Each story references governance source sections

---

## Phase 4: Developer Entry Point (What Engineers Actually See)

### MUSE-008 — Generate a consolidated TODO.md

**As a developer**,
I want a single TODO.md listing all stories for the Epic or Feature,
So that I know exactly what work is required without reading policy documents.

#### Acceptance Criteria (MUSE-008)

* TODO.md lists stories grouped by Epic/Feature
* Story IDs link back to detailed story files

---

## Phase 5: AI Enablement (Copilot‑Ready)

### MUSE-009 — Generate AI implementation prompts per user story

**As a developer**,
I want AI prompts generated for each user story,
So that Copilot can assist with implementation safely and consistently.

#### Acceptance Criteria (MUSE-009)

* Each prompt references a single user story
* Prompts include constraints and guardrails

---

### MUSE-010 — Store AI prompts as version‑controlled Markdown

**As a reviewer**,
I want AI prompts stored as Markdown files in the repository,
So that prompt intent and changes are reviewable.

#### Acceptance Criteria (MUSE-010)

* Prompts live under `/prompts/`
* Prompt files reference story IDs

---

## Phase 6: GitHub‑Native Delivery (The Demo Moment)

### MUSE-011 — Create a GitHub branch for derived artifacts

**As a platform**,
I want all derived artifacts committed to a dedicated branch,
So that developers can review changes safely.

---

### MUSE-012 — Open a pull request with governance, backlog, and prompts

**As a developer**,
I want Muse to open a GitHub pull request containing all derived artifacts,
So that I can review policy, stories, and AI prompts in one place.

#### Acceptance Criteria (MUSE-012)

* PR includes governance Markdown, TODO.md, and prompt files
* PR description explains origin and purpose

---

## Phase 7: Demo Completion (Outcome Validation)

### MUSE-013 — Enable developer review without external tools

**As a developer**,
I want to understand the *why*, *what*, and *how* directly from the PR,
So that I can proceed without meetings or external documentation.

#### Acceptance Criteria (MUSE-013)

* PR is self‑explanatory
* All artifacts are traceable and reviewable

---

## Final Demo Definition of Done

The Muse demo workflow is complete when:

* A policy document upload results in a GitHub pull request
* The PR contains:

  * Governance Markdown
  * An Epic, Features, and user stories
  * A consolidated TODO.md
  * AI prompts per story
* A developer can review and understand everything **inside GitHub alone**

---

*This document is intended to be iterated as the demo is refined, but the
workflow and story boundaries should remain stable.*
