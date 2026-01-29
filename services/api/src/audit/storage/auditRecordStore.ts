// AuditRecordStore: persistent storage interface for audit records
import { AuditRecord } from '../auditRecord'

export interface AuditRecordStore {
  save(record: AuditRecord): Promise<void>
  getById(auditId: string): Promise<AuditRecord | null>
  findByArtifactId(artifactId: string): Promise<AuditRecord[]>
}

// Example: In-memory implementation for testing/demo
export class InMemoryAuditRecordStore implements AuditRecordStore {
  private records: AuditRecord[] = []

  async save(record: AuditRecord): Promise<void> {
    this.records.push(record)
  }

  async getById(auditId: string): Promise<AuditRecord | null> {
    return this.records.find(r => r.audit_id === auditId) || null
  }

  async findByArtifactId(artifactId: string): Promise<AuditRecord[]> {
    return this.records.filter(r => r.outputs.artifact_ids.includes(artifactId))
  }
}
