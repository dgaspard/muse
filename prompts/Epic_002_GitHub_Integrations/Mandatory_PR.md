# Guardrails & Best Practices

## You MUST

- Use pull_request (not pull_request_target)
- Apply explicit permissions (no defaults)
- Avoid third-party actions unless unavoidable
- Treat CI as immutable infrastructure
- Prefer deterministic, reproducible steps

## You MUST NOT

- Auto-fix or mutate code
- Push commits
- Bypass failures
- Assume trusted contributors
