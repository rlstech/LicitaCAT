import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env['S3_BUCKET']
const REGION = process.env['S3_REGION'] ?? 'us-east-1'
const ENDPOINT = process.env['S3_ENDPOINT'] // for MinIO

const PRESIGNED_URL_EXPIRES_SECONDS = 15 * 60 // 15 minutes

function getS3Client(): S3Client {
  return new S3Client({
    region: REGION,
    ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: true } : {}),
  })
}

function getBucket(): string {
  if (!BUCKET) {
    throw new Error('S3_BUCKET environment variable is required')
  }
  return BUCKET
}

export function buildS3Key(
  tenantId: string,
  entityType: 'edital' | 'cat',
  entityId: string,
  fileName: string,
): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${tenantId}/${entityType}/${entityId}/${sanitized}`
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )

  return `s3://${bucket}/${key}`
}

export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
  })
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  maxSizeBytes: number,
): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
  })

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
  })
}
