// Audit record type definition for MUSE
// This structure enables deterministic replay and traceability for all governance-derived artifacts.

export type AuditActor = {
  type: 'user' | 'copilot' | 'system';
  id: string;
};

export type AuditInputs = {
  governance_document_id: string;
  governance_checksum: string;
  normalization_version: string;
  schema_version: string;
  error_model_version: string;
  model: {
    provider: string;
    model: string;
  };
};

export type AuditOutputs = {
  artifact_ids: string[];
  output_checksum: string;
};

export type AuditResult = {
  status: 'success' | 'failed';
  error_codes: string[];
};

export type AuditRecord = {
  audit_id: string;
  timestamp: string; // ISO-8601
  actor: AuditActor;
  inputs: AuditInputs;
  outputs: AuditOutputs;
  result: AuditResult;
};
