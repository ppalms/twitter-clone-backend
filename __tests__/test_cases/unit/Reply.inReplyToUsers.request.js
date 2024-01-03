const given = require('../../steps/given');
const when = require('../../steps/when');
const chance = require('chance').Chance();
const path = require('path');

describe('Reply.inReplyToUsers.request template', () => {
  it("Should not short-circuit if selectionSetList has more than just 'id'", () => {
    const templatePath = path.resolve(
      __dirname,
      '../../../mapping-templates/Reply.inReplyToUsers.request.vtl'
    );

    const username = chance.guid();
    const info = {
      selectionSetList: ['id', 'bio'],
    };
    const inReplyToUserIds = [username];
    const context = given.an_appsync_context(
      { username },
      {},
      {},
      { inReplyToUserIds },
      info
    );
    const result = when.we_invoke_an_appsync_template(templatePath, context);

    expect(result).toEqual({
      version: '2018-05-29',
      operation: 'BatchGetItem',
      tables: {
        '${UsersTable}': {
          keys: [
            {
              id: {
                S: username,
              },
            },
          ],
          consistentRead: false,
        },
      },
    });
  });

  it("Should short-circuit if selectionSetList has only 'id'", () => {
    const templatePath = path.resolve(
      __dirname,
      '../../../mapping-templates/Reply.inReplyToUsers.request.vtl'
    );

    const usernameA = chance.guid();
    const usernameB = chance.guid();
    const info = {
      selectionSetList: ['id'],
    };
    const inReplyToUserIds = [usernameA, usernameB];

    const context = given.an_appsync_context(
      { username: usernameA },
      {},
      {},
      { inReplyToUserIds },
      info
    );
    const result = when.we_invoke_an_appsync_template(templatePath, context);

    expect(result).toEqual([
      {
        id: usernameA,
        __typename: 'MyProfile',
      },
      {
        id: usernameB,
        __typename: 'OtherProfile',
      },
    ]);
  });

  it("Should short-circuit if inReplyToUsers array is empty", () => {
    const templatePath = path.resolve(
      __dirname,
      '../../../mapping-templates/Reply.inReplyToUsers.request.vtl'
    );

    const username = chance.guid();
    const info = {
      selectionSetList: ['id'],
    };
    const inReplyToUserIds = [];

    const context = given.an_appsync_context(
      { username },
      {},
      {},
      { inReplyToUserIds },
      info
    );
    const result = when.we_invoke_an_appsync_template(templatePath, context);

    expect(result).toEqual([]);
  });
});
