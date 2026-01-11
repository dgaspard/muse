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
    const bytes = await fs.promises.readFile(filePath)
    const checksumSha256 = sha256BufferHex(bytes)
    const documentId = checksumSha256

    if (this.bytesById.has(documentId)) {
      throw new DocumentAlreadyExistsError(documentId)
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
    const checksumSha256 = await sha256FileHex(filePath)
    const documentId = checksumSha256

    const originalPath = this.originalPath(documentId)
    const metadataPath = this.metadataPath(documentId)

    await fs.promises.mkdir(`${this.rootDir}/original`, { recursive: true })
    await fs.promises.mkdir(`${this.rootDir}/metadata`, { recursive: true })

    try {
      await fs.promises.copyFile(filePath, originalPath, fs.constants.COPYFILE_EXCL)
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        throw new DocumentAlreadyExistsError(documentId)
      }
      throw err
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
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        throw new DocumentAlreadyExistsError(documentId)
      }
      throw err
    }

    if (input.projectId) {
      const projectDir = `${this.rootDir}/projects/${input.projectId}/documents`
      const projectPath = `${projectDir}/${documentId}.json`
      await fs.promises.mkdir(projectDir, { recursive: true })
      try {
        await fs.promises.writeFile(
          projectPath,
          JSON.stringify(
            {
              projectId: input.projectId,
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
      } catch (err: any) {
        if (err?.code !== 'EEXIST') {
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
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
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
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode
      if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
        return false
      }
      throw err
    }
  }

  async saveOriginalFromPath(filePath: string, input: SaveOriginalInput): Promise<DocumentMetadata> {
    await this.ensureBucket()
    const checksumSha256 = await sha256FileHex(filePath)
    const documentId = checksumSha256

    const originalObjectKey = `original/${documentId}`
    const metadataObjectKey = `metadata/${documentId}.json`

    if (await this.objectExists(originalObjectKey)) {
      throw new DocumentAlreadyExistsError(documentId)
    }
    if (await this.objectExists(metadataObjectKey)) {
      throw new DocumentAlreadyExistsError(documentId)
    }

    const uploadedAtUtc = input.uploadedAtUtc ?? nowUtcIso()

    // Upload original bytes as-is.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: originalObjectKey,
        Body: fs.createReadStream(filePath),
        ContentType: input.mimeType || 'application/octet-stream',
        Metadata: {
          document_id: documentId,
          checksum_sha256: checksumSha256,
          original_filename: input.originalFilename,
          uploaded_at_utc: uploadedAtUtc,
          ...(input.projectId ? { project_id: input.projectId } : {}),
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
      const projectManifestKey = `projects/${input.projectId}/documents/${documentId}.json`
      if (!(await this.objectExists(projectManifestKey))) {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: projectManifestKey,
            Body: JSON.stringify(
              {
                projectId: input.projectId,
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

    const json = await streamToString(body as any)
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

async function streamToString(body: Readable | Blob | any): Promise<string> {
  if (typeof body?.transformToString === 'function') {
    return body.transformToString()
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const readable = body as Readable

    readable.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    readable.on('error', reject)
    readable.on('end', () => resolve(Buffer.concat(chunks as Uint8Array[]).toString('utf8')))
  })
}
