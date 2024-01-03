const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const { TWEETS_TABLE } = process.env;

const getTweetById = async (tweetId) => {
  const resp = await docClient.send(
    new GetCommand({
      TableName: TWEETS_TABLE,
      Key: { id: tweetId },
    })
  );
  return resp.Item;
};

module.exports = { getTweetById };
