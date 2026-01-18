# Implement a Governance Check workflow that validates delivery traceability

Trigger: pull_request

The workflow must:
Parse governance artifacts (YAML or Markdown)

## Validate that

### Every Feature references

- A valid Epic ID
- One or more User Story IDs

### Every User Story references

- Its parent Feature ID
- The originating Epic ID
- Ensure all references resolve to real files/IDs

### Fail the build if

- Any reference is missing
- Any ID is duplicated
- Any orphaned Epic, Feature, or Story exists

### Acceptance Criteria

- Failure message explains exactly what broke
- Output is machine-readable (JSON) and human-readable
- Governance validation runs in under 30 seconds

### 🔒 Guardrails & Best Practices

#### You MUST

- Use pull_request (not pull_request_target)
- Avoid third-party actions unless unavoidable
- Treat CI as immutable infrastructure
- Prefer deterministic, reproducible steps

#### You MUST NOT

- Auto-fix or mutate code
- Push commits
- Bypass failures
- Assume trusted contributors
