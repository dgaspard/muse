# Git Governance Workflow

## Purpose

This document explains why governance artifacts are committed to Git, how reviewers should treat governance pull requests, and how Git history supports audit and compliance in Muse.

---

## Why Governance Artifacts Are Committed Like Code

### Immutability + Auditability

In Muse, governance documents follow a strict audit trail:

1. **Original Document** (MUSE-002): Immutable, content-addressed, stored in secure object storage (S3/MinIO)
2. **Markdown Derivation** (MUSE-003): Deterministic conversion to diffable text
3. **Git Commit** (MUSE-004): Permanent record with cryptographic chain of custody

This ensures that:

- **No policy can be secretly modified** — changes require explicit commits and reviews
- **Every change is attributed** — Git author/committer metadata shows who approved the change
- **Rollback is always possible** — Git history preserves all prior versions
- **Compliance is demonstrable** — auditors can trace a policy change from original document → Markdown → Git commit → approval

### Collaboration Without Central Authority

By using GitHub (or any Git provider), governance changes go through the same code review process as software:

- **Pull requests** create a conversation about policy changes
- **Required reviewers** (via CODEOWNERS) ensure stakeholders approve
- **Branch protection** prevents unreviewed changes from reaching production
- **CI/CD integration** can enforce policy validation before merge

This removes the need for centralized governance committees and makes changes transparent.

### Regulatory Compliance

Many regulated environments (finance, healthcare, government) require:

- **Change documentation**: "What changed, when, and why?"
- **Approval trails**: "Who authorized this change?"
- **Audit history**: "Can we prove the current state matches what was approved?"

Git provides all of this natively:

```bash
# View all governance changes in the past month
git log --since="1 month ago" -- docs/governance/

# See who approved a governance change
git log --oneline --decorate --all -- docs/governance/

# Compare old vs new policy
git show <commit-hash>:docs/governance/policy.md

# Verify the current policy matches an approved commit
git log -1 --oneline docs/governance/policy.md
```

---

## How Governance Markdown Gets Committed

### The Workflow

1. **Upload Original Document** (User)
   - User uploads a PDF, DOCX, or other governance document
   - Muse computes a SHA-256 hash and stores immutably in S3
   - Document ID = SHA-256 hash (deterministic, reproducible)

2. **Convert to Markdown** (MUSE-003 Service)
   - Pipeline extracts text and structure from the original
   - Generates Markdown with YAML front matter for traceability
   - Includes document_id, source checksum, generation timestamp

3. **Commit to Git** (MUSE-004 Service)
   - Service stages the Markdown file to `docs/governance/`
   - Creates a deterministic commit with format:
  
     ```text
     docs(governance): add markdown derived from <document_id>

     Source: <original_filename>
     ```text

   - Captures commit hash for permanent record

   - Updates `muse.yaml` with artifact lineage

4. **Create Pull Request** (MUSE-005, future)
   - PR automatically references the governance document upload
   - Reviewers see the policy change in diff view
   - CI/CD validates policy format and metadata
   - Approval merges to main branch

### Example Commit

```bash
$ git log --oneline -1 docs/governance/
abc1234 docs(governance): add markdown derived from 7f3a5d2b

$ git show abc1234
commit abc1234567890123456789012345678901234567890
Author: Governance Bot <governance@muse.local>
Date:   Fri Jan 10 19:30:00 2026 +0000

    docs(governance): add markdown derived from 7f3a5d2b

    Source: annual-compliance-policy-2026.pdf

diff --git a/docs/governance/7f3a5d2b.md b/docs/governance/7f3a5d2b.md
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/docs/governance/7f3a5d2b.md
@@ -0,0 +1,50 @@
+---
+document_id: 7f3a5d2b
+source_checksum: sha256:a1b2c3d4e5f6...
+generated_at: 2026-01-10T19:30:00Z
+derived_artifact: governance_markdown
+original_filename: annual-compliance-policy-2026.pdf
+---
+
+# Annual Compliance Policy 2026
+
+This document outlines the organization's compliance requirements...
```

---

## How Reviewers Should Review Governance PRs

### Do's

✅ **Review the Markdown diff** — The diff shows exactly what policy changed

- Focus on the changed lines, not the YAML front matter
- Use GitHub's suggestion feature to propose wording changes
- Request clarification if policy language is ambiguous

✅ **Verify the source document** — Check that the Markdown matches the original

- Ask for a link to the original PDF/document
- Spot-check critical sections
- Ensure no text was dropped or hallucinated

✅ **Check the metadata** — Ensure traceability is intact

- YAML front matter should include:
  - `document_id`: matches the Git commit history
  - `source_checksum`: proves which version of the original is reflected
  - `original_filename`: confirms source document name
  - `generated_at`: timestamp matches the commit date (approximately)

✅ **Use branch protection + CODEOWNERS** — Require governance reviewers

- Add a `CODEOWNERS` file:

  ```text
  docs/governance/  @governance-team @compliance-lead
  ```text
- This ensures the right people approve policy changes

✅ **Automate validation** — Use CI/CD to check policy format

- Validate YAML front matter structure
- Check for required metadata fields
- Ensure no untracked files are committed alongside governance artifacts

### Don'ts

❌ **Do NOT approve without understanding the policy change**

- Governance PRs are not code PRs; they require policy expertise
- Don't approve based on "looks right" — read it carefully

❌ **Do NOT modify the YAML front matter**

- The metadata is immutable (represents the source document)
- If metadata is wrong, the upload was wrong — request re-upload

❌ **Do NOT squash or rebase governance commits**

- Each governance change is an audit event
- Squashing rewrites history and breaks traceability
- Use "Merge commit" (not squash) in GitHub

❌ **Do NOT commit governance artifacts directly**

- Changes must go through the standard workflow:
  - Upload original document
  - Convert to Markdown
  - Commit via service
  - Review in PR
- Direct commits bypass the audit trail

---

## Using Git History for Audit and Compliance

### Common Audit Tasks

#### "Show me all governance changes in the past quarter"

```bash
git log --since="3 months ago" --oneline -- docs/governance/
```

Output:

```text
abc1234 docs(governance): add markdown derived from 7f3a5d2b
def5678 docs(governance): add markdown derived from a1b2c3d4
```

#### "Who approved this policy change?"

```bash
git log --pretty=format:"%h %an %ai %s" -- docs/governance/policy.md

# With branch + tag info:
git log --pretty=format:"%h %an %ai %d %s" -- docs/governance/policy.md
```

#### "What did the policy say before the latest change?"

```bash
# View the previous version
git show HEAD~1:docs/governance/policy.md

# See full diff
git diff HEAD~1 docs/governance/policy.md
```

#### "Compare two policy versions"

```bash
# Between commits
git diff abc1234 def5678 -- docs/governance/policy.md

# Between branches
git diff main staging -- docs/governance/policy.md
```

#### "Create an audit report of all governance changes"

```bash
git log --pretty=format:"%h|%an|%ai|%s" -- docs/governance/ > audit_report.csv
```

This produces:

```text
abc1234|John Doe|2026-01-10 19:30:00 +0000|docs(governance): add markdown derived from 7f3a5d2b
def5678|Jane Smith|2026-01-09 14:20:00 +0000|docs(governance): add markdown derived from a1b2c3d4
```

### Compliance Demonstrations

#### For Auditors: "Prove the current policy is approved"

```bash
# Get the current policy
cat docs/governance/data-handling-policy.md

# Show the approval chain
git log --oneline docs/governance/data-handling-policy.md

# Verify it matches an approved commit
git rev-parse HEAD
# → abc1234 (matches approved release tag)
```

#### For Regulators: "Show the entire chain of custody"

```bash
# List all policy versions with dates
git log --reverse --pretty=format:"%h %ai %s" docs/governance/

# For each version, show the original document reference
git show abc1234:docs/governance/policy.md | grep -A5 "^---"
```

#### For Legal: "Prove a policy change was not retroactively modified"

```bash
# Show the exact commit that modified the policy
git blame docs/governance/policy.md | head -20

# Verify the commit hash matches Git history
git rev-list --all | grep abc1234
# → abc1234 (commit exists in history)

# Verify it has not been rewritten
git fsck --lost-found
# → no dangling commits
```

---

## Branch Protection and Governance

### Recommended GitHub Settings

#### 1. Require Pull Request Reviews

```yaml
# .github/workflows/governance-required-review.yml (future)
name: Governance Review Required
on:
  pull_request:
    paths:
      - 'docs/governance/**'
jobs:
  check-review:
    runs-on: ubuntu-latest
    steps:
      - name: Require approval from governance team
        run: |
          # Check if at least one reviewer from CODEOWNERS approved
          # (GitHub handles this via branch protection + CODEOWNERS)
          echo "Governance PR - approval from @governance-team required"
```

#### 2. Add CODEOWNERS

Create `.github/CODEOWNERS`:

```md
# Governance policies require review from compliance team
docs/governance/  @governance-team @compliance-lead

# muse.yaml artifact registry requires both governance and engineering
muse.yaml  @governance-team @engineering-lead
```

#### 3. Enforce No Squash Merges

```yaml
# .github/settings.yml (or GitHub web UI)
squash_merge_commit: false
allow_merge_commit: true
allow_rebase_merge: false
delete_branch_on_merge: true
```

This preserves the governance commit history.

---

## Future Enhancements

### MUSE-005: Automatic PR Creation

- Service automatically creates PR when governance Markdown is committed
- Title: "Policy Change: [document_id]"
- Description includes source document reference and generated Markdown preview
- Links to the original document in storage

### MUSE-006: Policy Validation in CI

- Validate Markdown structure (headings, links, code blocks)
- Check YAML front matter for required fields
- Lint policy language (no undefined terms)
- Scan for deprecated policy sections

### MUSE-007: Policy Supersession

- Track which policies supersede others
- Automatically deprecate old versions
- Maintain "Current Policy" and "Archived Policy" sections
- Generate diff reports for policy evolution

### MUSE-008: Approval Workflows

- Define multi-level approval (e.g., legal → compliance → engineering)
- Automatic escalation if policy affects regulated functions
- Integration with Slack/Teams for policy review notifications
- Audit log of all approval actions

---

## Summary

Git governance is not about forcing policies into a code repository. It's about:

1. **Reproducibility**: Same input always produces the same policy artifact
2. **Traceability**: Every version is linked to its source document
3. **Auditability**: Complete history is immutable and cryptographically verified
4. **Collaboration**: Policy changes go through the same review process as code
5. **Compliance**: Regulators can verify the entire chain of custody

By committing governance to Git, Muse ensures that policies are treated with the same rigor as source code: reviewable, versionable, and permanently traceable.
