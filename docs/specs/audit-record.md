# Audit Record Structure for MUSE

## Purpose
Defines the required structure and storage policy for audit records, enabling deterministic replay and traceability for all governance-derived artifacts.

---

## Audit Record Schema
```yaml
audit:
  audit_id: <uuid>
  timestamp: <iso-8601>
  actor:
    type: user | copilot | system
    id: <string>
  inputs:
    governance_document_id: <string>
    governance_checksum: <sha256>
    normalization_version: v1.0
    schema_version: v1.1
    error_model_version: v1.0
    model:
      provider: anthropic
      model: <model-name>
  outputs:
    artifact_ids:
      - EPIC-xxxx
      - FEAT-yyyy
      - STORY-zzzz
    output_checksum: <sha256>
  result:
    status: success | failed
    error_codes: []
```

---

## Storage Policy
- Audit records must be written atomically and persistently (database or object storage)
- Must be logged for operational visibility
- PRs may reference audit summaries, but GitHub history alone is insufficient

---

## Replayability
- All fields are required for deterministic replay
- At least one automated test must validate replay from audit record
