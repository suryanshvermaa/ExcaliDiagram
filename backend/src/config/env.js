'use strict'
require('dotenv').config()

module.exports = {
  port:    parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/icons-db',
  },

  storage: {
    useS3:          process.env.USE_S3 === 'true',
    bucket:         process.env.S3_BUCKET || 'icons',
    region:         process.env.S3_REGION || 'us-east-1',
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10),

    // MinIO (local dev)
    minioEndpoint:  process.env.MINIO_ENDPOINT  || 'http://localhost:9000',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    minioSecretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    minioPublicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',

    // AWS S3 (prod) — credentials from env / IAM role
    awsAccessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion:          process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  },
}
