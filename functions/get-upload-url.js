const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const ulid = require('ulid');

const { BUCKET_NAME } = process.env;

module.exports.handler = async (event) => {
  const id = ulid.ulid();
  let key = `${event.identity.username}/${id}`;

  const extension = event.arguments.extension;
  if (extension) {
    if (extension.startsWith('.')) {
      key += extension;
    } else {
      key += `.${extension}`;
    }
  }

  const contentType = event.arguments.contentType || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('Content type must be an image');
  }

  const s3Client = new S3Client({ useAccelerateEndpoint: true });
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });

  return signedUrl;
};
