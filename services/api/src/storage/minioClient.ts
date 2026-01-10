import { Client } from 'minio'

const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
const port = Number(process.env.MINIO_PORT || 9000)
const accessKey = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || 'minioadmin'
const secretKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || 'minioadmin'
const bucket = process.env.MINIO_BUCKET || 'muse-uploads'

// Note: keep this helper intentionally small and explicit. In a real
// project this would live in a service/adapter layer with retries,
// monitoring, and proper error handling.
const client = new Client({
  endPoint: endpoint,
  port,
  useSSL: false,
  accessKey,
  secretKey,
})

export async function ensureBucket() {
  const exists = await client.bucketExists(bucket)
  if (!exists) {
    await client.makeBucket(bucket)
  }
}

export async function uploadObject(objectName: string, filePath: string, contentType?: string) {
  // Uses the local file path to stream the object into MinIO to avoid
  // in-memory buffering. Caller is responsible for removing temp file.
  await ensureBucket()
  return client.fPutObject(bucket, objectName, filePath, {
    'Content-Type': contentType || 'application/octet-stream',
  })
}

export function objectUrl(objectName: string) {
  // Not signed; just a useful pointer for local dev and smoke tests.
  return `http://${endpoint}:${port}/${bucket}/${encodeURIComponent(objectName)}`
}
