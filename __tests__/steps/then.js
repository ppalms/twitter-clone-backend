const DynamoDB = require('aws-sdk/clients/dynamodb'); // TODO update to v3 of sdk
// const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const http = require('axios');
const fs = require('fs');
const _ = require('lodash');

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

const tweet_exists_in_TweetsTable = async (id) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for tweet [${id}] in table [${process.env.TWEETS_TABLE}]`
  );
  const resp = await dynamodb
    .get({
      TableName: process.env.TWEETS_TABLE,
      Key: { id },
    })
    .promise();

  expect(resp.Item).toBeTruthy();

  return resp.Item;
};

const tweet_does_not_exist_in_TimelinesTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for tweet [${tweetId}] for user [${userId}] in table [${process.env.TIMELINES_TABLE}]`
  );
  const resp = await dynamodb
    .get({
      TableName: process.env.TIMELINES_TABLE,
      Key: {
        userId,
        tweetId,
      },
    })
    .promise();

  expect(resp.Item).not.toBeTruthy();

  return resp.Item;
};

const tweet_exists_in_TimelinesTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for tweet [${tweetId}] for user [${userId}] in table [${process.env.TIMELINES_TABLE}]`
  );
  const resp = await dynamodb
    .get({
      TableName: process.env.TIMELINES_TABLE,
      Key: {
        userId,
        tweetId,
      },
    })
    .promise();

  expect(resp.Item).toBeTruthy();

  return resp.Item;
};

const reply_exists_in_TweetsTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for reply by [${userId}] to [${tweetId}] in table [${process.env.TWEETS_TABLE}]`
  );
  const resp = await dynamodb
    .query({
      TableName: process.env.TWEETS_TABLE,
      IndexName: 'repliesForTweet',
      KeyConditionExpression: 'inReplyToTweetId = :tweetId',
      FilterExpression: 'creator = :userId',
      ExpressionAttributeValues: {
        ':tweetId': tweetId,
        ':userId': userId,
      },
    })
    .promise();

  const reply = _.get(resp, 'Items.0');

  expect(reply).toBeTruthy();

  return reply;
};

const retweet_exists_in_TweetsTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for retweet of [${tweetId}] in table [${process.env.TWEETS_TABLE}]`
  );
  const resp = await dynamodb
    .query({
      TableName: process.env.TWEETS_TABLE,
      IndexName: 'retweetsByCreator',
      KeyConditionExpression: 'creator = :userId AND retweetOf = :tweetId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tweetId': tweetId,
      },
      Limit: 1,
    })
    .promise();

  const retweet = _.get(resp, 'Items.0');

  expect(retweet).toBeTruthy();

  return retweet;
};

const retweet_does_not_exist_in_TweetsTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for retweet of [${tweetId}] in table [${process.env.TWEETS_TABLE}]`
  );

  const resp = await dynamodb
    .query({
      TableName: process.env.TWEETS_TABLE,
      IndexName: 'retweetsByCreator',
      KeyConditionExpression: 'creator = :userId AND retweetOf = :tweetId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tweetId': tweetId,
      },
      Limit: 1,
    })
    .promise();

  expect(resp.Items).toHaveLength(0);

  return null;
};

const retweet_does_not_exist_in_RetweetsTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for retweet of [${tweetId}] for user [${userId}] in table [${process.env.RETWEETS_TABLE}]`
  );
  const resp = await dynamodb
    .get({
      TableName: process.env.RETWEETS_TABLE,
      Key: {
        userId,
        tweetId,
      },
    })
    .promise();

  expect(resp.Item).not.toBeTruthy();

  return resp.Item;
};

const retweet_exists_in_RetweetsTable = async (userId, tweetId) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for retweet of [${tweetId}] for user [${userId}] in table [${process.env.RETWEETS_TABLE}]`
  );
  const resp = await dynamodb
    .get({
      TableName: process.env.RETWEETS_TABLE,
      Key: {
        userId,
        tweetId,
      },
    })
    .promise();

  expect(resp.Item).toBeTruthy();

  return resp.Item;
};

const tweetsCount_is_updated_in_UsersTable = async (id, newCount) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(`looking for user [${id}] in table [${process.env.USERS_TABLE}]`);
  const resp = await dynamodb
    .get({
      TableName: process.env.USERS_TABLE,
      Key: { id },
    })
    .promise();

  expect(resp.Item).toBeTruthy();
  expect(resp.Item.tweetsCount).toEqual(newCount);

  return resp.Item;
};

const there_are_N_tweets_in_TimelinesTable = async (userId, n) => {
  const dynamodb = new DynamoDB.DocumentClient();

  console.log(
    `looking for [${n}] tweets for user [${userId}] in table [${process.env.TIMELINES_TABLE}]`
  );
  const resp = await dynamodb
    .query({
      TableName: process.env.TIMELINES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
    })
    .promise();

  expect(resp.Items).toHaveLength(n);

  return resp.Items;
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
  tweet_exists_in_TweetsTable,
  tweet_does_not_exist_in_TimelinesTable,
  reply_exists_in_TweetsTable,
  retweet_exists_in_TweetsTable,
  retweet_does_not_exist_in_TweetsTable,
  retweet_does_not_exist_in_RetweetsTable,
  retweet_exists_in_RetweetsTable,
  tweet_exists_in_TimelinesTable,
  tweetsCount_is_updated_in_UsersTable,
  there_are_N_tweets_in_TimelinesTable,
  user_can_upload_image_to_url,
  // user_can_download_image_from,
};
