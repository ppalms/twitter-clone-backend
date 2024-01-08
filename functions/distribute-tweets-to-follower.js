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

const { TWEETS_TABLE, TIMELINES_TABLE, MAX_TWEETS } = process.env;
const MaxTweets = parseInt(MAX_TWEETS);

module.exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const relationship = unmarshall(record.dynamodb.NewImage);
      const [relType] = relationship.sk.split('_');

      if (relType === 'FOLLOWS') {
        const tweets = await getTweets(relationship.otherUserId);
        await distribute(tweets, relationship.userId);
      }
    } else if (record.eventName === 'REMOVE') {
      const relationship = unmarshall(record.dynamodb.OldImage);
      const [relType] = relationship.sk.split('_');

      if (relType === 'FOLLOWS') {
        const tweets = await getTimelineEntriesBy(
          relationship.otherUserId,
          relationship.userId
        );
        await undistribute(tweets, relationship.userId);
      }
    }
  }

  async function getTweets(userId) {
    const loop = async (acc, exclusiveStartKey) => {
      const command = new QueryCommand({
        TableName: TWEETS_TABLE,
        KeyConditionExpression: 'creator = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        IndexName: 'byCreator',
        ExclusiveStartKey: exclusiveStartKey,
      });

      const resp = await docClient.send(command);
      const tweets = resp.Items || [];
      const newAcc = acc.concat(tweets);

      if (resp.LastEvaluatedKey && newAcc.length < MaxTweets) {
        return await loop(newAcc, resp.LastEvaluatedKey);
      } else {
        return newAcc;
      }
    };

    return await loop([]);
  }
};

async function getTimelineEntriesBy(distributedFrom, userId) {
  const loop = async (acc, exclusiveStartKey) => {
    const command = new QueryCommand({
      TableName: TIMELINES_TABLE,
      KeyConditionExpression:
        'userId = :userId AND distributedFrom = :distributedFrom',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':distributedFrom': distributedFrom,
      },
      IndexName: 'byDistributedFrom',
      ExclusiveStartKey: exclusiveStartKey,
    });

    const resp = await docClient.send(command);
    const tweets = resp.Items || [];
    const newAcc = acc.concat(tweets);

    if (resp.LastEvaluatedKey) {
      return await loop(newAcc, resp.LastEvaluatedKey);
    } else {
      return newAcc;
    }
  };

  return await loop([]);
}

async function distribute(tweets, userId) {
  const timelineEntries = tweets.map((tweet) => ({
    PutRequest: {
      Item: {
        userId,
        tweetId: tweet.id,
        timestamp: tweet.createdAt,
        distributedFrom: tweet.creator,
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

async function undistribute(tweets, userId) {
  const timelineEntries = tweets.map((tweet) => ({
    DeleteRequest: {
      Key: {
        userId,
        tweetId: tweet.tweetId,
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
