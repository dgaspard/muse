# Create a separate security workflow triggered on

pull_request
push to main

## Include

CodeQL Analysis
Use GitHub-maintained actions only
Language autodetection
Fail on high or critical findings
Dependency Review

## Block PRs introducing

Known critical vulnerabilities
Licenses outside an approved allowlist
Output a clear summary of violations

## Acceptance Criteria

Uses pull_request (not pull_request_target)
Explicit permissions block write access
Results are visible directly in the PR UI
