import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'node:stream'

const BUCKET = process.env['S3_BUCKET']
const REGION = process.env['S3_REGION'] ?? 'us-east-1'
const ENDPOINT = process.env['S3_ENDPOINT'] // internal (e.g. http://minio:9000)
const PUBLIC_ENDPOINT = process.env['S3_PUBLIC_ENDPOINT'] // public (e.g. https://storage.example.com)

const PRESIGNED_URL_EXPIRES_SECONDS = 15 * 60 // 15 minutes

function getS3Client(publicFacing = false): S3Client {
  const endpoint = publicFacing ? (PUBLIC_ENDPOINT ?? ENDPOINT) : ENDPOINT
  return new S3Client({
    region: REGION,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
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
  const client = getS3Client(true)
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
  })
}

export async function downloadFromS3(fileUrl: string): Promise<Buffer> {
  // fileUrl format: s3://bucket/key
  const withoutScheme = fileUrl.replace(/^s3:\/\//, '')
  const slashIdx = withoutScheme.indexOf('/')
  const bucket = withoutScheme.slice(0, slashIdx)
  const key = withoutScheme.slice(slashIdx + 1)

  const client = getS3Client()
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await client.send(command)

  const stream = response.Body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  maxSizeBytes: number,
): Promise<string> {
  const client = getS3Client(true)
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
