import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import { DocumentAlreadyExistsError, FileSystemDocumentStore, InMemoryDocumentStore } from './documentStore'

async function readStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks as Uint8Array[])))
  })
}

describe('InMemoryDocumentStore', () => {
  it('round-trips bytes byte-for-byte', async () => {
    const store = new InMemoryDocumentStore()

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'sample.bin')

    const inputBytes = crypto.randomBytes(1024)
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const metadata = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'sample.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: inputBytes.length,
      projectId: 'demo-project',
    })

    const { stream } = await store.getOriginal(metadata.documentId)
    const outputBytes = await readStreamToBuffer(stream)

    expect(outputBytes.equals(new Uint8Array(inputBytes))).toBe(true)
  })

  it('calculates and stores SHA-256 checksum deterministically', async () => {
    const store = new InMemoryDocumentStore()

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'fixture.txt')

    const inputBytes = Buffer.from('hello-world\n', 'utf8')
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const expected = crypto.createHash('sha256').update(new Uint8Array(inputBytes)).digest('hex')

    const metadata = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'fixture.txt',
      mimeType: 'text/plain',
      sizeBytes: inputBytes.length,
    })

    expect(metadata.checksumSha256).toBe(expected)
    expect(metadata.documentId).toBe(expected)
  })

  it('is idempotent when uploading same document twice', async () => {
    const store = new InMemoryDocumentStore()

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'same.bin')

    const inputBytes = Buffer.from('same-bytes', 'utf8')
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const first = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'same.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: inputBytes.length,
    })

    const second = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'same.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: inputBytes.length,
    })

    expect(second.documentId).toBe(first.documentId)
    expect(second.checksumSha256).toBe(first.checksumSha256)
  })

  it('persists and retrieves metadata', async () => {
    const store = new InMemoryDocumentStore()

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'meta.bin')

    const inputBytes = Buffer.from('metadata-check', 'utf8')
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const saved = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'meta.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: inputBytes.length,
      projectId: 'proj-123',
    })

    const loaded = await store.getMetadata(saved.documentId)
    expect(loaded).toEqual(saved)
  })
})

describe('FileSystemDocumentStore', () => {
  it('behaves like the in-memory adapter for save/get/metadata', async () => {
    const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-fs-'))
    const store = new FileSystemDocumentStore({ rootDir: tmpRoot })

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'fixture.bin')

    const inputBytes = crypto.randomBytes(2048)
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const saved = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'fixture.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: inputBytes.length,
      projectId: 'proj-fs',
    })

    const loaded = await store.getMetadata(saved.documentId)
    expect(loaded).toEqual(saved)

    const { stream } = await store.getOriginal(saved.documentId)
    const outputBytes = await readStreamToBuffer(stream)
    expect(outputBytes.equals(new Uint8Array(inputBytes))).toBe(true)
  })

  it('is idempotent when uploading same document twice', async () => {
    const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-fs-'))
    const store = new FileSystemDocumentStore({ rootDir: tmpRoot })

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'muse-api-docstore-'))
    const filePath = path.join(tmpDir, 'same.txt')

    const inputBytes = Buffer.from('same-content', 'utf8')
    await fs.promises.writeFile(filePath, new Uint8Array(inputBytes))

    const first = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'same.txt',
      mimeType: 'text/plain',
      sizeBytes: inputBytes.length,
    })

    const second = await store.saveOriginalFromPath(filePath, {
      originalFilename: 'same.txt',
      mimeType: 'text/plain',
      sizeBytes: inputBytes.length,
    })

    expect(second.documentId).toBe(first.documentId)
    expect(second.checksumSha256).toBe(first.checksumSha256)
  })
})
