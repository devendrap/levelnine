import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const BUCKET = process.env.S3_BUCKET ?? 'ai-ui-uploads'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'aiui',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'aiui_dev_secret',
  },
  forcePathStyle: true,
})

export async function uploadFile(
  file: Buffer | Uint8Array,
  originalFilename: string,
  contentType: string,
  prefix = 'uploads',
): Promise<{ s3Key: string; originalFilename: string }> {
  const ext = originalFilename.split('.').pop() ?? ''
  const s3Key = `${prefix}/${randomUUID()}.${ext}`

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: file,
    ContentType: contentType,
  }))

  return { s3Key, originalFilename }
}

export async function getDownloadUrl(s3Key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  }), { expiresIn })
}

export async function deleteFile(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  }))
}
