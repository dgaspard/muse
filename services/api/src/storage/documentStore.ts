import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

export type DocumentMetadata = {
  documentId: string
  checksumSha256: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedAtUtc: string
  storageUri: string
  originalObjectKey: string
  metadataObjectKey: string
  projectId?: string
}

export type SaveOriginalInput = {
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedAtUtc?: string
  projectId?: string
}

export class DocumentAlreadyExistsError extends Error {
  readonly documentId: string

  constructor(documentId: string) {
    super(`document already exists: ${documentId}`)
    this.name = 'DocumentAlreadyExistsError'
    this.documentId = documentId
  }
}

export interface DocumentStore {
  saveOriginalFromPath(filePath: string, input: SaveOriginalInput): Promise<DocumentMetadata>
  getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }>
  getMetadata(documentId: string): Promise<DocumentMetadata>
}

function nowUtcIso() {
  return new Date().toISOString()
}

export async function sha256FileHex(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function sha256BufferHex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex')
}

export class InMemoryDocumentStore implements DocumentStore {
  private readonly bytesById = new Map<string, Buffer>()
  private readonly metadataById = new Map<string, DocumentMetadata>()

  async saveOriginalFromPath(filePath: string, input: SaveOriginalInput): Promise<DocumentMetadata> {
    // For in-memory store (typically used in tests), don't validate path restrictions
    const bytes = await fs.promises.readFile(filePath)
    const checksumSha256 = sha256BufferHex(bytes)
    const documentId = checksumSha256

    // If document already exists, return existing metadata (idempotent)
    if (this.metadataById.has(documentId)) {
      return this.metadataById.get(documentId)!
    }

    const originalObjectKey = `original/${documentId}`
    const metadataObjectKey = `metadata/${documentId}.json`

    const metadata: DocumentMetadata = {
      documentId,
      checksumSha256,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedAtUtc: input.uploadedAtUtc ?? nowUtcIso(),
      storageUri: `memory://${originalObjectKey}`,
      originalObjectKey,
      metadataObjectKey,
      projectId: input.projectId,
    }

    this.bytesById.set(documentId, bytes)
    this.metadataById.set(documentId, metadata)

    return metadata
  }

  async getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }> {
    const metadata = this.metadataById.get(documentId)
    const bytes = this.bytesById.get(documentId)

    if (!metadata || !bytes) {
      throw new Error(`document not found: ${documentId}`)
    }

    return { stream: Readable.from(bytes), metadata }
  }

  async getMetadata(documentId: string): Promise<DocumentMetadata> {
    const metadata = this.metadataById.get(documentId)
    if (!metadata) {
      throw new Error(`document not found: ${documentId}`)
    }
    return metadata
  }
}

export type FileSystemDocumentStoreConfig = {
  rootDir: string
}

export class FileSystemDocumentStore implements DocumentStore {
  private readonly rootDir: string

  constructor(config: FileSystemDocumentStoreConfig) {
    this.rootDir = config.rootDir
  }

  private originalPath(documentId: string) {
    return `${this.rootDir}/original/${documentId}`
  }

  private metadataPath(documentId: string) {
    return `${this.rootDir}/metadata/${documentId}.json`
  }

  async saveOriginalFromPath(filePath: string, input: SaveOriginalInput): Promise<DocumentMetadata> {
    const safePath = assertSafeLocalPath(filePath)
    const checksumSha256 = await sha256FileHex(safePath)
    const documentId = checksumSha256

    const originalPath = this.originalPath(documentId)
    const metadataPath = this.metadataPath(documentId)

    // If document already exists, return existing metadata (idempotent)
    if (await fs.promises.access(metadataPath).then(() => true).catch(() => false)) {
      try {
        return await this.getMetadata(documentId)
      } catch {
        // If metadata file is corrupted, re-create it below
      }
    }

    await fs.promises.mkdir(`${this.rootDir}/original`, { recursive: true })
    await fs.promises.mkdir(`${this.rootDir}/metadata`, { recursive: true })

    try {
      await fs.promises.copyFile(safePath, originalPath, fs.constants.COPYFILE_EXCL)
    } catch (err: unknown) {
      const error = err as Record<string, unknown>
      if ((error as Record<string, unknown>)?.code === 'EEXIST') {
        // File already exists, continue to metadata creation
      } else {
        throw err
      }
    }

    const originalObjectKey = `original/${documentId}`
    const metadataObjectKey = `metadata/${documentId}.json`

    const metadata: DocumentMetadata = {
      documentId,
      checksumSha256,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedAtUtc: input.uploadedAtUtc ?? nowUtcIso(),
      storageUri: `file://${originalPath}`,
      originalObjectKey,
      metadataObjectKey,
      projectId: input.projectId,
    }

    try {
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { flag: 'wx' })
    } catch (err: unknown) {
      const error = err as Record<string, unknown>
      if ((error as Record<string, unknown>)?.code !== 'EEXIST') {
        throw err
      }
    }

    if (input.projectId) {
      const projectIdSafe = sanitizeKeySegment(input.projectId)
      const projectDir = `${this.rootDir}/projects/${projectIdSafe}/documents`
      const projectPath = `${projectDir}/${documentId}.json`
      await fs.promises.mkdir(projectDir, { recursive: true })
      try {
        await fs.promises.writeFile(
          projectPath,
          JSON.stringify(
            {
              projectId: projectIdSafe,
              documentId,
              metadataObjectKey,
              originalObjectKey,
              checksumSha256,
              uploadedAtUtc: metadata.uploadedAtUtc,
            },
            null,
            2,
          ),
          { flag: 'wx' },
        )
      } catch (err: unknown) {
        const error = err as Record<string, unknown>
        if ((error as Record<string, unknown>)?.code !== 'EEXIST') {
          throw err
        }
      }
    }

    return metadata
  }

  async getMetadata(documentId: string): Promise<DocumentMetadata> {
    const metadataPath = this.metadataPath(documentId)
    const json = await fs.promises.readFile(metadataPath, 'utf8')
    return JSON.parse(json) as DocumentMetadata
  }

  async getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }> {
    const metadata = await this.getMetadata(documentId)
    const originalPath = this.originalPath(documentId)
    return { stream: fs.createReadStream(originalPath), metadata }
  }
}

export type S3DocumentStoreConfig = {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
}

export class S3DocumentStore implements DocumentStore {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly endpoint: string

  constructor(config: S3DocumentStoreConfig) {
    this.bucket = config.bucket
    this.endpoint = config.endpoint.replace(/\/$/, '')
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    })
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch (err: unknown) {
      type HttpError = { $metadata?: { httpStatusCode?: number }; name?: string }
      const error = err as HttpError
      const httpStatus = error?.$metadata?.httpStatusCode
      if (httpStatus === 404 || error?.name === 'NotFound') {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
        return
      }
      throw err
    }
  }

  private async objectExists(key: string): Promise<boolean> {
    await this.ensureBucket()
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch (err: unknown) {
      type HttpError = { $metadata?: { httpStatusCode?: number }; name?: string }
      const error = err as HttpError
      const status = error?.$metadata?.httpStatusCode
      if (status === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
        return false
      }
      throw err
    }
  }

  async saveOriginalFromPath(filePath: string, input: SaveOriginalInput): Promise<DocumentMetadata> {
    await this.ensureBucket()
    const safePath = assertSafeLocalPath(filePath)
    const checksumSha256 = await sha256FileHex(safePath)
    const documentId = checksumSha256

    const originalObjectKey = `original/${documentId}`
    const metadataObjectKey = `metadata/${documentId}.json`

    // If document already exists, return existing metadata (idempotent)
    if (await this.objectExists(metadataObjectKey)) {
      try {
        return await this.getMetadata(documentId)
      } catch {
        // If metadata file is corrupted, re-create it below
      }
    }

    const uploadedAtUtc = input.uploadedAtUtc ?? nowUtcIso()

    // Upload original bytes as-is.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: originalObjectKey,
        Body: fs.createReadStream(safePath),
        ContentType: input.mimeType || 'application/octet-stream',
        Metadata: {
          document_id: documentId,
          checksum_sha256: checksumSha256,
          original_filename: input.originalFilename,
          uploaded_at_utc: uploadedAtUtc,
          ...(input.projectId ? { project_id: sanitizeKeySegment(input.projectId) } : {}),
        },
      }),
    )

    const storageUri = `${this.endpoint}/${this.bucket}/${encodeURIComponent(originalObjectKey)}`

    const metadata: DocumentMetadata = {
      documentId,
      checksumSha256,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedAtUtc,
      storageUri,
      originalObjectKey,
      metadataObjectKey,
      projectId: input.projectId,
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: metadataObjectKey,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
      }),
    )

    if (input.projectId) {
      const projectIdSafe = sanitizeKeySegment(input.projectId)
      const projectManifestKey = `projects/${projectIdSafe}/documents/${documentId}.json`
      if (!(await this.objectExists(projectManifestKey))) {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: projectManifestKey,
            Body: JSON.stringify(
              {
                projectId: projectIdSafe,
                documentId,
                metadataObjectKey,
                originalObjectKey,
                checksumSha256,
                uploadedAtUtc,
              },
              null,
              2,
            ),
            ContentType: 'application/json',
          }),
        )
      }
    }

    return metadata
  }

  async getMetadata(documentId: string): Promise<DocumentMetadata> {
    await this.ensureBucket()
    const metadataObjectKey = `metadata/${documentId}.json`
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: metadataObjectKey,
      }),
    )

    const body = result.Body
    if (!body) {
      throw new Error(`metadata not found: ${documentId}`)
    }

    const json = await streamToString(body as unknown)
    return JSON.parse(json) as DocumentMetadata
  }

  async getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }> {
    const metadata = await this.getMetadata(documentId)

    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: metadata.originalObjectKey,
      }),
    )

    const body = result.Body
    if (!body) {
      throw new Error(`document not found: ${documentId}`)
    }

    return { stream: body as unknown as Readable, metadata }
  }
}

async function streamToString(body: Readable | Blob | unknown): Promise<string> {
  const bodyObj = body as { transformToString?: () => string }
  if (typeof bodyObj?.transformToString === 'function') {
    return bodyObj.transformToString()
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const readable = body as Readable

    readable.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    readable.on('error', reject)
    readable.on('end', () => resolve(Buffer.concat(chunks as Uint8Array[]).toString('utf8')))
  })
}

/**
 * Ensure a provided local filesystem path resolves within the working directory.
 * Prevents uncontrolled path usage flagged by code scanning.
 */
function assertSafeLocalPath(p: string): string {
  if (typeof p !== 'string' || p.trim().length === 0) {
    throw new Error('invalid path')
  }
  const resolved = path.resolve(p)
  const cwd = process.cwd()
  const base = cwd.endsWith(path.sep) ? cwd : cwd + path.sep
  if (!resolved.startsWith(base)) {
    throw new Error('unsafe path outside working directory')
  }
  return resolved
}

/**
 * Sanitize user-provided key segments used in object storage keys.
 * Allows alphanumerics, dash, underscore, dot. Replaces others with dash.
 */
function sanitizeKeySegment(s: string): string {
  return String(s).replace(/[^A-Za-z0-9._-]/g, '-')
}
