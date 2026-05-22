'use strict'
const { S3Client } = require('@aws-sdk/client-s3')
const cfg = require('./env')
const { storage } = cfg

let _client = null

function getS3Client() {
  if (_client) return _client

  if (storage.useS3) {
    // Real AWS S3
    const opts = { region: storage.awsRegion }
    if (storage.awsAccessKeyId) {
      opts.credentials = {
        accessKeyId:     storage.awsAccessKeyId,
        secretAccessKey: storage.awsSecretAccessKey,
      }
    }
    _client = new S3Client(opts)
    console.log(`☁️   S3 client  →  AWS (${storage.awsRegion})`)
  } else {
    // MinIO (S3-compatible)
    _client = new S3Client({
      region:   storage.region,
      endpoint: storage.minioEndpoint,
      forcePathStyle: true,   // required for MinIO
      credentials: {
        accessKeyId:     storage.minioAccessKey,
        secretAccessKey: storage.minioSecretKey,
      },
    })
    console.log(`🪣  S3 client  →  MinIO (${storage.minioEndpoint})`)
  }

  return _client
}

module.exports = { getS3Client }
