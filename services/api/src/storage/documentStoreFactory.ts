import { DocumentStore, S3DocumentStore, FileSystemDocumentStore, InMemoryDocumentStore } from './documentStore'
import path from 'path'

/**
 * Factory function to get the appropriate DocumentStore implementation based on environment configuration.
 * 
 * Configuration via environment variables:
 * - DOCUMENT_STORE_DRIVER: 's3', 'minio', 'filesystem', 'fs', or 'memory'
 * - For S3/MinIO:
 *   - MINIO_ENDPOINT or defaults to http://localhost:9000
 *   - MINIO_ACCESS_KEY or MINIO_ROOT_USER or defaults to minioadmin
 *   - MINIO_SECRET_KEY or MINIO_ROOT_PASSWORD or defaults to minioadmin
 *   - MINIO_BUCKET or defaults to muse-documents
 * - For filesystem:
 *   - DOCUMENT_STORE_DIR or defaults to ./storage/documents
 */
export function getDocumentStore(): DocumentStore {
  const storeType = (process.env.DOCUMENT_STORE_DRIVER || 'filesystem').toLowerCase()

  switch (storeType) {
    case 's3':
    case 'minio':
      return new S3DocumentStore({
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'muse-uploads',
      })
    
    case 'filesystem':
    case 'fs':
      return new FileSystemDocumentStore({
        rootDir: process.env.DOCUMENT_STORE_DIR || path.join(process.cwd(), 'storage', 'documents'),
      })
    
    case 'memory':
      return new InMemoryDocumentStore()
    
    default:
      throw new Error(`Unknown document store type: ${storeType}`)
  }
}
