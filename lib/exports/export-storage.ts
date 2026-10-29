import fs from 'fs'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * Finished export files kept in the media bucket (DO Spaces) as PRIVATE objects,
 * not on the instance disk. Two reasons: production runs two instances, so a
 * file written to one instance's disk is missing when the download lands on the
 * other; and a redeploy wipes the disk. Downloads still go through the admin
 * route, which checks the role on every request, so no public link exists.
 *
 * Spaces only. R2 has no per-object ACL and a bucket with a public domain would
 * serve the file to anyone holding its key, so with R2 (or no bucket at all, in
 * local dev) exports stay on local disk as before.
 */
const bucket = process.env.R2_BUCKET
const endpoint = process.env.R2_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

export const isExportStorageEnabled = Boolean(
  bucket && endpoint && accessKeyId && secretAccessKey && !endpoint.includes('r2.cloudflarestorage.com'),
)

let client: S3Client | null = null
function s3() {
  client ??= new S3Client({
    endpoint,
    region: process.env.R2_REGION || 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  })
  return client
}

export async function uploadExport(key: string, filePath: string, size: number, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
      ACL: 'private',
    }),
  )
}

/** Null when the object is gone (deleted after 7 days, or never written). */
export async function getExport(key: string): Promise<{ body: ReadableStream; size?: number } | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!res.Body) return null
    return { body: res.Body.transformToWebStream(), size: res.ContentLength }
  } catch (e: any) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
    throw e
  }
}

export async function deleteExport(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
