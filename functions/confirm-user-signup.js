/*
    Expected Input
    https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html#cognito-user-pools-lambda-trigger-event-parameter-shared

    {
      version: '1',
      triggerSource: 'PostConfirmation_ConfirmSignUp',
      region: 'us-east-1',
      userPoolId: 'us-east-1_XgzZmqL3b',
      userName: '3da239a6-1f47-53aa-8fb0-e1b70ec1d439',
      request: {
        userAttributes: {
          sub: '3da239a6-1f47-53aa-8fb0-e1b70ec1d439',
          'cognito:email_alias': 'John-Boone-mrqi@test.com',
          'cognito:user_status': 'CONFIRMED',
          email_verified: 'false',
          name: 'John Boone mrqi',
          email: 'John-Boone-mrqi@test.com'
        }
      },
      response: {}
    }
*/

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const Chance = require('chance');
const chance = new Chance();

const { USERS_TABLE } = process.env;

module.exports.handler = async (event) => {
  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    const name = event.request.userAttributes['name'];
    const suffix = chance.string({
      length: 8,
      casing: 'upper',
      alpha: true,
      numeric: true,
    });
    const screenName = `${name.replace(/[^a-zA-Z0-9]/g, '')}${suffix}`;
    const user = {
      id: event.userName,
      name,
      screenName,
      createdAt: new Date().toJSON(),
      followersCount: 0,
      followingCount: 0,
      tweetsCount: 0,
      likesCount: 0,
    };

    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: user,
        ConditionExpression: 'attribute_not_exists(id)',
      })
    );

    return event;
  } else {
    return event;
  }
};
