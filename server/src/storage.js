const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const useS3 = Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

let s3Client = null;
if (useS3) {
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
} else {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

async function putObject(key, buffer, contentType) {
  if (useS3) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `${process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${key}`;
}

async function deleteObject(key) {
  if (useS3) {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
    );
    return;
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  fs.rm(filePath, { force: true }, () => {});
}

module.exports = { putObject, deleteObject, useS3, LOCAL_UPLOAD_DIR };
