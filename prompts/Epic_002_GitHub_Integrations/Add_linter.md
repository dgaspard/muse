# Implement a workflow that

Runs on PRs targeting main
Uses least-privilege permissions

## Executes in this order

### Linting

Language-appropriate linting (ESLint, markdownlint, etc.)
Fail the job on warnings treated as errors
Unit / Integration Tests
Deterministic test execution
Clear pass/fail output
No network access unless explicitly required

### Acceptance Criteria

Workflow fails on any lint or test failure
Logs are concise and actionable
No secrets are exposed to forked PRs
