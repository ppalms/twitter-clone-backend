const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const _ = require('lodash');

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE, RETWEETS_TABLE } =
  process.env;

module.exports.handler = async (event) => {
  const { tweetId } = event.arguments;
  const { username } = event.identity;

  const getTweetResp = await docClient.send(
    new GetCommand({
      TableName: TWEETS_TABLE,
      Key: { id: tweetId },
    })
  );

  const tweet = getTweetResp.Item;
  if (!tweet) {
    throw new Error('Tweet not found');
  }

  console.log(`getting tweet [${tweetId}] for user [${username}]`);

  const queryCommand = new QueryCommand({
    TableName: process.env.TWEETS_TABLE,
    IndexName: 'retweetsByCreator',
    KeyConditionExpression: 'creator = :creator AND retweetOf = :tweetId',
    ExpressionAttributeValues: {
      ':creator': username,
      ':tweetId': tweetId,
    },
    Limit: 1,
  });

  const queryResp = await docClient.send(queryCommand);

  const retweet = _.get(queryResp, 'Items.0');
  if (!retweet) {
    throw new Error('Retweet not found');
  }

  const transactItems = [
    {
      Delete: {
        TableName: TWEETS_TABLE,
        Key: { id: retweet.id },
        ConditionExpression: 'attribute_exists(id)',
      },
    },
    {
      Delete: {
        TableName: RETWEETS_TABLE,
        Key: {
          userId: username,
          tweetId,
        },
        ConditionExpression: 'attribute_exists(tweetId)',
      },
    },
    {
      Update: {
        TableName: TWEETS_TABLE,
        Key: { id: tweetId },
        UpdateExpression: 'ADD retweets :minus_one',
        ExpressionAttributeValues: {
          ':minus_one': -1,
        },
        ConditionExpression: 'attribute_exists(id)',
      },
    },
    {
      Update: {
        TableName: USERS_TABLE,
        Key: { id: username },
        UpdateExpression: 'ADD tweetsCount :minus_one',
        ExpressionAttributeValues: {
          ':minus_one': -1,
        },
        ConditionExpression: 'attribute_exists(id)',
      },
    },
  ];

  console.log(`creator: [${tweet.creator}]; username: [${username}]`);
  if (tweet.creator !== username) {
    transactItems.push({
      Delete: {
        TableName: TIMELINES_TABLE,
        Key: {
          userId: username,
          tweetId: retweet.id,
        },
      },
    });
  }

  await docClient.send(
    new TransactWriteCommand({ TransactItems: transactItems })
  );

  return true;
};
