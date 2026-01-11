import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'

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

export function objectUrl(objectName: string) {
  // Not signed; local dev pointer only
  // If MINIO_ENDPOINT is http://localhost:9000, ensure no trailing slash
  const e = (process.env.MINIO_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '')
  return `${e}/${bucket}/${encodeURIComponent(objectName)}`
}
