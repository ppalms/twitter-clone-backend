const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require('@aws-sdk/client-dynamodb');

const { marshall } = require('@aws-sdk/util-dynamodb');
const client = new DynamoDBClient({});
const ulid = require('ulid');
const { TweetTypes } = require('../lib/constants');

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE } = process.env;

module.exports.handler = async (event) => {
  const { text } = event.arguments;
  const { username } = event.identity;
  const id = ulid.ulid();
  const timestamp = new Date().toJSON();

  const newTweet = {
    __typename: TweetTypes.TWEET,
    id,
    text,
    creator: username,
    createdAt: timestamp,
    replies: 0,
    likes: 0,
    retweets: 0,
  };

  const command = new TransactWriteItemsCommand({
    TransactItems: [
      {
        Put: {
          TableName: TWEETS_TABLE,
          Item: marshall(newTweet),
        },
      },
      {
        Put: {
          TableName: TIMELINES_TABLE,
          Item: marshall({
            userId: username,
            tweetId: id,
            timestamp,
          }),
        },
      },
      {
        Update: {
          TableName: USERS_TABLE,
          Key: marshall({
            id: username,
          }),
          UpdateExpression: 'ADD #tweetsCount :one',
          ExpressionAttributeNames: {
            '#tweetsCount': 'tweetsCount',
          },
          ExpressionAttributeValues: {
            ':one': marshall(1),
          },
          ConditionExpression: 'attribute_exists(id)',
        },
      },
    ],
  });

  await client.send(command);

  return newTweet;
};
