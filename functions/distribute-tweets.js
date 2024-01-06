const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const _ = require('lodash');
const Constants = require('../lib/constants');

const { RELATIONSHIPS_TABLE, TIMELINES_TABLE } = process.env;

module.exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const tweet = unmarshall(record.dynamodb.NewImage);
      const followers = await getFollowers(tweet.creator);
      await distribute(tweet, followers);
    } else if (record.eventName === 'REMOVE') {
      const tweet = unmarshall(record.dynamodb.OldImage);
      const followers = await getFollowers(tweet.creator);
      await undistribute(tweet, followers);
    }
  }
};

async function getFollowers(userId) {
  const loop = async (acc, exclusiveStartKey) => {
    const command = new QueryCommand({
      TableName: RELATIONSHIPS_TABLE,
      KeyConditionExpression:
        'otherUserId = :otherUserId and begins_with(sk, :follows)',
      ExpressionAttributeValues: {
        ':otherUserId': userId,
        ':follows': 'FOLLOWS_',
      },
      IndexName: 'byOtherUser',
      ExclusiveStartKey: exclusiveStartKey,
    });

    const resp = await docClient.send(command);
    const userIds = (resp.Items || []).map((item) => item.userId);

    if (resp.LastEvaluatedKey) {
      return await loop(acc.concat(userIds), resp.LastEvaluatedKey);
    } else {
      return acc.concat(userIds);
    }
  };

  return await loop([]);
}

async function distribute(tweet, followers) {
  const timelineEntries = followers.map((userId) => ({
    PutRequest: {
      Item: {
        userId,
        tweetId: tweet.id,
        timestamp: tweet.createdAt,
        retweetOf: tweet.retweetOf,
        inReplyToTweetId: tweet.inReplyToTweetId,
        inReplyToUserIds: tweet.inReplyToUserIds,
      },
    },
  }));

  const chunks = _.chunk(timelineEntries, Constants.DynamoDB.MAX_BATCH_SIZE);
  const promises = chunks.map(async (chunk) => {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TIMELINES_TABLE]: chunk,
        },
      })
    );
  });

  await Promise.all(promises);
}

async function undistribute(tweet, followers) {
  const timelineEntries = followers.map((userId) => ({
    DeleteRequest: {
      Key: {
        userId,
        tweetId: tweet.id,
      },
    },
  }));

  const chunks = _.chunk(timelineEntries, Constants.DynamoDB.MAX_BATCH_SIZE);
  const promises = chunks.map(async (chunk) => {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TIMELINES_TABLE]: chunk,
        },
      })
    );
  });

  await Promise.all(promises);
}
