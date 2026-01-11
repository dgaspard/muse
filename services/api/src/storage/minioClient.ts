import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import { Readable } from 'stream'

const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000'
const accessKey = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || 'minioadmin'
const secretKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || 'minioadmin'
const bucket = process.env.MINIO_BUCKET || 'muse-uploads'

// Configure S3-compatible client (works with MinIO in local dev)
const client = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
  forcePathStyle: true,
})

export async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (err: any) {
    // If bucket doesn't exist, create it (prototype behavior)
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
      await client.send(new CreateBucketCommand({ Bucket: bucket }))
    } else {
      // Re-throw unexpected errors
      throw err
    }
  }
}

export async function uploadObject(objectName: string, filePath: string, contentType?: string) {
  await ensureBucket()
  const stream = fs.createReadStream(filePath)
  const input = {
    Bucket: bucket,
    Key: objectName,
    Body: stream,
    ContentType: contentType || 'application/octet-stream',
  }
  return client.send(new PutObjectCommand(input))
}

export async function objectExists(objectName: string): Promise<boolean> {
  await ensureBucket()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectName }))
    return true
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
      return false
    }
    throw err
  }
}

export async function getObjectStream(objectName: string): Promise<Readable> {
  await ensureBucket()
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectName }))
  const body = result.Body
  if (!body) {
    throw new Error(`object not found: ${objectName}`)
  }
  return body as unknown as Readable
}

export function objectUrl(objectName: string) {
  // Not signed; local dev pointer only
  // If MINIO_ENDPOINT is http://localhost:9000, ensure no trailing slash
  const e = (process.env.MINIO_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '')
  return `${e}/${bucket}/${encodeURIComponent(objectName)}`
}
