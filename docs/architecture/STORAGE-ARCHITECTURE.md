# Storage Architecture

## Overview

Muse uses a pluggable document storage system that supports multiple backends. As of the MinIO removal (Feb 2026), the default storage backend is **filesystem-based** for simplicity and reduced operational overhead.

## Storage Backends

The storage system supports three backends via `documentStoreFactory.ts`:

### 1. Filesystem Storage (Default)

**Usage**: Local development and simple deployments

**Configuration**:
```bash
DOCUMENT_STORE_DRIVER=filesystem  # default, can be omitted
DOCUMENT_STORE_DIR=./storage/documents  # default location
```

**Advantages**:
- Simple setup - no additional services required
- Easy to inspect and debug
- Perfect for prototypes and local development
- Persists across container restarts when volume-mounted

**Storage Structure**:
```
storage/documents/
├── original/{sha256}      # Original documents by checksum
└── metadata/{sha256}.json # Document metadata
```

### 2. S3/MinIO Storage

**Usage**: Production deployments with cloud object storage

**Configuration**:
```bash
DOCUMENT_STORE_DRIVER=s3  # or 'minio'
MINIO_ENDPOINT=https://s3.amazonaws.com  # or MinIO endpoint
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=muse-documents
```

**When to use**:
- Production deployments
- Multi-instance scaling
- Cloud-native architectures
- S3, MinIO, or S3-compatible storage

### 3. In-Memory Storage

**Usage**: Testing only

**Configuration**:
```bash
DOCUMENT_STORE_DRIVER=memory
```

**Characteristics**:
- Not persistent
- Fast for unit tests
- Used automatically in test suites

## Migration from MinIO (Feb 2026)

### Why MinIO Was Removed

1. **Prototype Simplicity**: MinIO added unnecessary complexity for a prototype phase
2. **Operational Overhead**: Required separate service, health checks, bucket creation
3. **No Cloud Benefit**: Without cloud deployment, S3 compatibility provided no value
4. **Filesystem Alternative**: Fully functional filesystem backend already existed

### What Changed

**Removed**:
- MinIO service from `docker-compose.yml`
- MinIO bucket creation service
- MinIO health checks from smoke tests
- MinIO dependency for API service

**Changed**:
- Default storage driver: `s3` → `filesystem`
- Removed MinIO environment variables from `.env.example`
- Updated documentation and copilot instructions

**Unchanged**:
- All storage backend implementations remain available
- API endpoints still work identically
- Document metadata format unchanged
- Ability to switch back to S3/MinIO in production

### Migration Path

To migrate existing MinIO data to filesystem:

```bash
# Export from MinIO
docker compose exec minio mc mirror local/muse-documents /tmp/export

# Copy to filesystem storage
mkdir -p storage/documents
cp -r /tmp/export/* storage/documents/

# Update environment
echo "DOCUMENT_STORE_DRIVER=filesystem" >> .env
```

## Future Considerations

### When to Use S3/Cloud Storage

Switch to S3-compatible storage when:
- Deploying to cloud environments
- Running multiple API instances
- Requiring durability guarantees beyond filesystem
- Need for geographic replication
- Storage size exceeds local disk capacity

### Performance Characteristics

| Backend    | Latency | Throughput | Scalability | Complexity |
|------------|---------|------------|-------------|------------|
| Filesystem | Low     | High       | Single node | Very Low   |
| S3/MinIO   | Medium  | High       | Multi-node  | Medium     |
| In-Memory  | Very Low| Very High  | Single proc | Very Low   |

## Implementation Details

### Document Metadata

All backends store consistent metadata:

```typescript
{
  documentId: string          // SHA256 checksum
  checksumSha256: string      // Content hash
  originalFilename: string    // Original upload name
  mimeType: string           // Content type
  sizeBytes: number          // File size
  uploadedAtUtc: string      // ISO 8601 timestamp
  storageUri: string         // Backend-specific URI
  originalObjectKey: string  // Storage key for original
  metadataObjectKey: string  // Storage key for metadata
  projectId?: string         // Optional project association
}
```

### Content-Addressable Storage

All backends use SHA256 checksums as document IDs, providing:
- Automatic deduplication
- Content verification
- Idempotent uploads
- Deterministic retrieval

## Related Documentation

- [documentStoreFactory.ts](../../services/api/src/storage/documentStoreFactory.ts) - Backend selection logic
- [documentStore.ts](../../services/api/src/storage/documentStore.ts) - Implementation of all backends
- [System Architecture](./system-architecture.md) - Overall system design
