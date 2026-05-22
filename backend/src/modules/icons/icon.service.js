'use strict'
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
}                              = require('@aws-sdk/client-s3')
const { getSignedUrl }         = require('@aws-sdk/s3-request-presigner')
const { getS3Client }          = require('../../config/s3')
const cfg                      = require('../../config/env')
const { storage }              = cfg

async function ensureBucket() {
  const client = getS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: storage.bucket }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: storage.bucket }))
    console.log(`✅  Created bucket: ${storage.bucket}`)
  }
}

async function uploadSvg(key, svgContent) {
  const client = getS3Client()
  const body   = Buffer.isBuffer(svgContent) ? svgContent : Buffer.from(svgContent, 'utf8')
  await client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: body, ContentType: 'image/svg+xml' }))
  return key
}

async function getPresignedUrl(key) {
  const client  = getS3Client()
  const command = new GetObjectCommand({ Bucket: storage.bucket, Key: key })
  const url     = await getSignedUrl(client, command, { expiresIn: storage.signedUrlExpiry })
  if (!storage.useS3 && storage.minioPublicUrl) {
    return url.replace(storage.minioEndpoint, storage.minioPublicUrl)
  }
  return url
}

async function getSvgContent(key) {
  const client = getS3Client()
  const resp   = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }))
  const chunks = []
  for await (const chunk of resp.Body) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function deleteObject(key) {
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }))
}

async function objectExists(key) {
  const client = getS3Client()
  try { await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key })); return true }
  catch { return false }
}

function iconKey(id) { return `icons/${id}.svg` }

module.exports = { ensureBucket, uploadSvg, getPresignedUrl, getSvgContent, deleteObject, objectExists, iconKey }
