const DynamoDB = require('aws-sdk/clients/dynamodb');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const http = require('axios');
const fs = require('fs');

const user_exists_in_UsersTable = async (id) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(`looking for user [${id}] in table [${process.env.USERS_TABLE}]`);
  const resp = await dynamodb
    .get({
      TableName: process.env.USERS_TABLE,
      Key: { id },
    })
    .promise();

  expect(resp.Item).toBeTruthy();

  return resp.Item;
};

const user_can_upload_image_to_url = async (url, filePath, contentType) => {
  const data = fs.readFileSync(filePath);

  try {
    await http({
      method: 'put',
      url,
      headers: {
        'Content-Type': contentType,
      },
      data,
    });

    console.log('uploaded image to', url);
  } catch (err) {
    console.log(err);
    throw err;
  }
};

// const user_can_download_image_from = async (key, contentType) => {
//   try {
//     const s3Client = new S3Client({ useAccelerateEndpoint: true });
//     const command = new GetObjectCommand({
//       Bucket: BUCKET_NAME,
//       Key: key,
//       ContentType: contentType,
//     });
//     const signedUrl = await getSignedUrl(s3Client, command, {
//       expiresIn: 3600,
//     });

//     const resp = await http(signedUrl);
//     console.log('downloaded image from', signedUrl);
//     return resp.data;
//   } catch (err) {
//     console.log(err);
//     throw err;
//   }
// };

module.exports = {
  user_exists_in_UsersTable,
  user_can_upload_image_to_url,
  // user_can_download_image_from,
};
