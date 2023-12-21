const DynamoDB = require('aws-sdk/clients/dynamodb');

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

module.exports = {
  user_exists_in_UsersTable,
};
