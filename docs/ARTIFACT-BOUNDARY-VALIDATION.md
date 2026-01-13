# Muse — User Stories vs AI Prompts: Validation Boundary

**Version:** 1.0
**Last Updated:** 2026-01-13
**Enforcement:** TypeScript interfaces + UI validation logic

---

## Executive Summary

This document enforces the **hard boundary** between:
1. **User Stories** — Pure product artifacts (what users want)
2. **AI Prompts** — Executable instructions for AI agents (how to build it)

### Core Principle
```
User Story ≠ AI Prompt

A User Story describes intent.
An AI Prompt describes execution.
They must never be conflated.
```

---

## User Story Specification

### Definition
A User Story is a **product artifact** that captures:
- Who wants something (role)
- What they want (capability/feature)
- Why they want it (benefit)
- When it's done (acceptance criteria)

### Valid User Story Example
```
**ID:** story-epic-001-feature-001-01
**Title:** View Account Balance in Dashboard

As a customer, I want to see my account balance 
in the main dashboard, so that I can quickly check my funds.

**Acceptance Criteria:**
1. Balance displays in USD
2. Displays in top-right corner
3. Updates within 5 seconds of account changes
4. Shows "Loading..." while fetching
```

### User Story Validation Rules (MUST ENFORCE)

A User Story is **VALID** if it:
- ✅ Contains **no imperative instructions** ("Do not implement...", "You must...")
- ✅ Contains **no AI role language** ("You are a senior engineer...")
- ✅ Contains **no implementation steps** ("First, connect to the database...")
- ✅ Contains **no code examples** (unless from governance source)
- ✅ Uses **storytelling format** ("As a..., I want..., so that...")
- ✅ Lists **functional criteria** not technical steps
- ✅ References external artifacts by **ID only** (e.g., `governance-ref: SECTION-3.2`)

A User Story is **INVALID** if it:
- ❌ Declares an AI role ("You are an expert...")
- ❌ Lists implementation tasks ("Create a new component...")
- ❌ Contains execution syntax ("Call the API, then validate...")
- ❌ Includes pseudo-code or code snippets
- ❌ Contains Epic/Feature references as "undefined"
- ❌ Mixes acceptance criteria with technical requirements

### Implementation Example (Governance.tsx)

```typescript
// ✅ CORRECT: Pure product artifact
interface StoryData {
  story_id: string
  title: string
  role: string // "customer"
  capability: string // "view balance in dashboard"
  benefit: string // "quickly check funds"
  acceptance_criteria: string[] // Functional outcomes
  governance_references: string[] // Refs to governance sections
  derived_from_feature: string
  derived_from_epic: string
}

// Rendering always shows the story verbatim
// No transformation, no instruction wrapping
```

---

## AI Prompt Specification

### Definition
An AI Prompt is an **executable instruction set** for AI agents. It:
- Declares a role ("You are...")
- Declares a task ("Your task is...")
- Declares output expectations
- Provides context by **reference** (not duplication)
- Is **generated on-demand**, not embedded in stories

### Valid AI Prompt Example
```markdown
# Muse — User Story to Pull Request Implementation Agent

## System Prompt (Role & Authority)

You are an expert senior software engineer.
You work inside an existing GitHub repository...

## Context Inputs

**User Story:**
- ID: story-epic-001-feature-001-01
- Title: View Account Balance in Dashboard
- Role: customer
- Capability: view balance in dashboard
- Benefit: quickly check funds

**Acceptance Criteria:**
1. Balance displays in USD
2. Displays in top-right corner
3. Updates within 5 seconds of account changes
4. Shows "Loading..." while fetching

**Related Artifacts:**
- Feature ID: feature-001
- Feature Title: Dashboard Components
- Epic ID: epic-001
- Epic Title: Customer Portal

**Task:**
Implement the above user story as a pull request.
Your output must:
1. Pass all acceptance criteria tests
2. Follow project conventions...
```

### AI Prompt Validation Rules (MUST ENFORCE)

An AI Prompt is **VALID** if it:
- ✅ Declares an **explicit AI role** ("You are...")
- ✅ Declares a **specific task** ("Your task is...")
- ✅ Declares **output expectations** (PR format, code style, test coverage)
- ✅ **References User Story by ID** instead of duplicating content
- ✅ Provides **context by reference** (links, IDs) not full text
- ✅ Is **generated only on explicit request** ("Generate Prompt" button)
- ✅ Includes **artifact references** with resolved IDs (not "undefined")
- ✅ **Separates concerns** (story intent ≠ implementation details)

An AI Prompt is **INVALID** if it:
- ❌ **Duplicates** User Story text verbatim
- ❌ **Lacks role declaration** (no "You are...")
- ❌ **Lacks task declaration** (no clear objective)
- ❌ **Contains unresolved references** (epic: "undefined")
- ❌ **Is auto-wrapped** around stories (should be explicit action)
- ❌ **Treats story as directive** ("Do this, implement that")
- ❌ **Combines multiple stories** without clear separation

### Implementation Example (Governance.tsx)

```typescript
// ✅ CORRECT: Distinct artifact type with explicit structure
interface AIPrompt {
  prompt_id: string // Unique identifier for this prompt
  story_id: string // References story by ID (not duplication)
  feature_id?: string // Optional: resolved reference
  epic_id?: string // Optional: resolved reference
  content: string // Full interpolated prompt text
  role: string // "Software Engineer"
  task: string // "Implement feature from user story"
  generated_at: string // ISO timestamp (provenance)
  template: string // Which template was used
}

// Prompts are stored SEPARATELY from stories
interface StoryWithPrompts extends StoryData {
  prompts?: AIPrompt[] // Array of generated prompts
  activePromptId?: string // Currently viewed prompt
  promptsLoading?: boolean
  promptsError?: string
  promptsExpanded?: boolean
}

// Rendering separates concerns:
// 1. Story section: pure product artifact
// 2. AI Prompts section: executable instructions (if generated)
```

---

## Validation Logic (Code Level)

### At Generation Time

**In `generatePromptForStory()` (governance.tsx lines 296-392):**

```typescript
// VALIDATION: Ensure references are resolved
if (!epic || !epic.epic_id) {
  alert('Error: Epic reference is missing. Cannot generate prompt without proper context.')
  return
}

if (!feature || !feature.feature_id) {
  alert('Error: Feature reference is missing. Cannot generate prompt without proper context.')
  return
}

// After fetch, create AIPrompt object (not string on story)
const newPrompt: AIPrompt = {
  prompt_id: `prompt-${story.story_id}-${Date.now()}`,
  story_id: story.story_id,
  feature_id: feature.feature_id, // Resolved
  epic_id: epic.epic_id, // Resolved
  content: data.prompt,
  role: 'Software Engineer',
  task: 'Implement feature from user story',
  generated_at: new Date().toISOString(),
  template: 'Prompt-muse-User-Story-Implementation-PR',
}

// Store in array, not on story
stories: (s.stories || []).map(s =>
  s.story_id === story.story_id
    ? {
        ...s,
        prompts: [...(s.prompts || []), newPrompt], // Array append
        activePromptId: newPrompt.prompt_id,
      }
    : s
)
```

### At Render Time

**In governance.tsx lines 823-875:**

```typescript
{/* Story artifact: Pure product description */}
<p><strong>As a</strong> {story.role}, <strong>I want</strong> {story.capability}, 
   <strong>so that</strong> {story.benefit}.</p>

{/* AI Prompts section: SEPARATE visual container */}
{((story as StoryWithPrompts).prompts && (story as StoryWithPrompts).prompts!.length > 0) && (
  <div style={{ marginTop: 12, padding: 8, backgroundColor: '#F9F9F9', border: '1px solid #2196F3' }}>
    <div style={{ fontSize: 11, fontWeight: 'bold' }}>
      🤖 AI Prompts ({prompts.length})
    </div>
    {/* Each prompt is rendered with full metadata and references */}
    {prompts.map((prompt, pIdx) => (
      <div>
        <strong>Role:</strong> {prompt.role} | <strong>Task:</strong> {prompt.task}
        <strong>References:</strong> Story: {prompt.story_id}, 
                                      Feature: {prompt.feature_id}, 
                                      Epic: {prompt.epic_id}
        {/* Prompt content in separate expandable section */}
      </div>
    ))}
  </div>
)}
```

---

## Validation Checklist

### Before Merging Code

- [ ] **Story Types** — All `StoryData` interfaces contain NO execution language
- [ ] **Prompt Types** — All `AIPrompt` interfaces have required fields (role, task, references)
- [ ] **No Conflation** — `StoryWithPrompt` replaced with separate `StoryWithPrompts` + `AIPrompt`
- [ ] **References Resolved** — Epic/Feature IDs validated before prompt generation
- [ ] **Separate Rendering** — Story display and AI Prompt display use distinct visual sections
- [ ] **On-Demand** — Prompts generated only via explicit button, not auto-wrapped
- [ ] **Backward Compat** — Old `StoryWithPrompt` type removed from codebase

### Before User Testing

- [ ] **Story Display** — Shows exactly as product artifact, no modifications
- [ ] **Prompt Generation** — Button works, creates AIPrompt objects
- [ ] **Error Handling** — Undefined Epic/Feature references trigger alert (not "undefined" display)
- [ ] **Multiple Prompts** — Story can have multiple prompts (future use)
- [ ] **Metadata Visible** — Prompt role, task, references shown to user

### Documentation

- [ ] **This document** — Kept up-to-date with code changes
- [ ] **Code comments** — TypeScript interfaces documented with validation rules
- [ ] **Example outputs** — Real examples in docs, not hypothetical

---

## Examples

### ✅ Correct User Story

```
**Title:** Customer Can Export Statement as PDF

As a customer, I want to export my account statement as a PDF, 
so that I can save it for my records.

**Acceptance Criteria:**
1. Export button visible on Statements page
2. Generates PDF with current statement data
3. Includes account number, period, transactions
4. File downloads with timestamp (statement_2026-01-13.pdf)
5. Works for statements up to 2 years old
```

**Why Valid:**
- Pure intent (what, not how)
- No tech details ("database query", "API call")
- No role language ("you must implement")
- Clear acceptance (observable outcomes)

### ✅ Correct AI Prompt

```markdown
# Implementation Agent: Customer PDF Export Feature

## System Prompt

You are a full-stack engineer implementing a feature 
in an existing codebase.

## Story Context

**User Story ID:** story-portal-statements-001
**Title:** Customer Can Export Statement as PDF

As a customer, I want to export my account statement as a PDF, 
so that I can save it for my records.

**Acceptance Criteria:**
1. Export button visible on Statements page
2. Generates PDF with current statement data
3. Includes account number, period, transactions
4. File downloads with timestamp (statement_2026-01-13.pdf)
5. Works for statements up to 2 years old

## Task

Implement the above user story.
Create a pull request that:
- Adds export button UI
- Implements PDF generation (use jsPDF or similar)
- Passes all acceptance criteria tests
- Follows existing code style
- Includes unit tests for PDF content

## Output

Your output must be a GitHub pull request with:
- Branch: feature/pdf-export
- Commits: clean, descriptive messages
- Tests: 100% coverage of new code paths
```

**Why Valid:**
- Explicit role ("You are a full-stack engineer")
- Explicit task ("Implement the above user story")
- References by ID (not duplication)
- Execution details ("create pull request", "branch name")
- Output expectations (test coverage, PR format)

### ❌ Invalid: Story with Execution Language

```
As a customer, I want to:
1. Click an export button
2. Select PDF format
3. Wait for processing (shows spinner)
4. Receive download

THEN the system should:
- Call the /api/statements/{id}/export endpoint
- Use jsPDF library to generate PDF
- Save to MinIO bucket
- Return download link
```

**Why Invalid:**
- Mixes intent ("export") with implementation ("Call /api", "use jsPDF")
- Contains technical directives
- Is not pure product artifact

### ❌ Invalid: Prompt Without References

```
You are a senior engineer. Your task is to implement 
the statement export feature. Here's what to do:

As a customer, I want to export statements...

[FULL STORY TEXT DUPLICATED]
```

**Why Invalid:**
- Duplicates story instead of referencing by ID
- No explicit output expectations
- No artifact reference IDs

---

## Enforcement (CI/CD)

### Pre-Commit
- [ ] TypeScript compilation (catches interface misuse)
- [ ] Lint rule: No `prompt:` field on `StoryData` types

### Pre-Merge
- [ ] Code review: Story text contains no "must", "implement", "code"
- [ ] Code review: All `AIPrompt` objects have `story_id`, `role`, `task`
- [ ] Code review: No auto-wrapped prompts (all generated on-demand)

### Post-Deployment
- [ ] Monitor: Count of `AIPrompt` objects generated
- [ ] Monitor: Validate references resolved (no "undefined" in prompts)

---

## Migration Guide (For Existing Code)

If you have code using old `StoryWithPrompt` type:

**Before:**
```typescript
interface StoryWithPrompt extends StoryData {
  prompt?: string // ❌ Conflates artifact with instruction
  promptLoading?: boolean
  promptError?: string
}
```

**After:**
```typescript
interface StoryWithPrompts extends StoryData {
  prompts?: AIPrompt[] // ✅ Separate artifact
  activePromptId?: string
  promptsLoading?: boolean
  promptsError?: string
}

interface AIPrompt {
  prompt_id: string
  story_id: string
  feature_id?: string
  epic_id?: string
  content: string
  role: string
  task: string
  generated_at: string
  template: string
}
```

### Update Steps
1. Replace type definitions
2. Update `generatePromptForStory()` to create `AIPrompt` objects
3. Update rendering to loop over `prompts` array
4. Update storage to use `prompts` field
5. Remove old `prompt`, `promptLoading`, `promptExpanded` fields

---

## FAQ

**Q: Can a User Story mention Epic/Feature IDs?**  
A: Yes, as references only (e.g., "Derived from: epic-001, feature-001"). But NEVER render them as "undefined". Validate them before any use.

**Q: Should User Stories have AI-readable hints?**  
A: No. AI hints belong in the **Prompt Template** (Prompt-muse-*.md files), not in the story artifact.

**Q: What if the governance source contains execution language?**  
A: The governance document is the **source of truth**. Extract product intent (User Stories) and keep governance references. Never treat governance directives as story acceptance criteria.

**Q: Can one story have multiple prompts?**  
A: Yes. A story might have "Implementation Prompt", "Analysis Prompt", "Migration Prompt", etc. Store all in the `prompts[]` array. That's why it's an array.

**Q: What happens if Epic/Feature IDs are missing?**  
A: Validation prevents prompt generation (alert user). This is intentional—good context is required for good AI execution.

---

## Related Documents
- [Prompt Template: User Story Implementation](../prompts/Prompt-muse-User-Story-Implementation-PR.md)
- [API Documentation: Story Endpoints](../docs/api/)
- [UI Architecture: Governance Page](../apps/web/pages/governance.tsx)

---

**Last Review:** 2026-01-13  
**Reviewed By:** Senior Product Engineer  
**Status:** Active Enforcement
