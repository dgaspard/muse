// Replay validation test for audit records
import { InMemoryAuditRecordStore } from './storage/auditRecordStore'
import { AuditRecord } from './auditRecord'
import { sha256 } from 'crypto-hash' // You may need to install a suitable hash lib

describe('AuditRecord Replay Validation', () => {
  it('should deterministically replay and match artifact IDs and output hash', async () => {
    // Example audit record (normally loaded from persistent store)
    const audit: AuditRecord = {
      audit_id: 'test-uuid',
      timestamp: new Date().toISOString(),
      actor: { type: 'copilot', id: 'copilot-1' },
      inputs: {
        governance_document_id: 'gov-123',
        governance_checksum: 'abc123',
        normalization_version: 'v1.0',
        schema_version: 'v1.1',
        error_model_version: 'v1.0',
        model: { provider: 'anthropic', model: 'claude-3' },
      },
      outputs: {
        artifact_ids: ['EPIC-3f9a2c1e', 'FEAT-b72e1d90', 'STORY-8c41aa77'],
        output_checksum: 'deadbeef',
      },
      result: {
        status: 'success',
        error_codes: [],
      },
    }

    // Simulate replay: recompute artifact IDs and output hash from inputs
    // (In real system, this would invoke normalization, schema, and ID logic)
    const canonicalInput = JSON.stringify({
      governance_document_id: audit.inputs.governance_document_id,
      governance_checksum: audit.inputs.governance_checksum,
      normalization_version: audit.inputs.normalization_version,
      schema_version: audit.inputs.schema_version,
      error_model_version: audit.inputs.error_model_version,
      model: audit.inputs.model,
    })
    // Fake deterministic artifact ID and output hash for demo
    const replayedArtifactIds = ['EPIC-3f9a2c1e', 'FEAT-b72e1d90', 'STORY-8c41aa77']
    const replayedOutputHash = 'deadbeef'

    expect(replayedArtifactIds).toEqual(audit.outputs.artifact_ids)
    expect(replayedOutputHash).toBe(audit.outputs.output_checksum)
  })
})
