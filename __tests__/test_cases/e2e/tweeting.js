require('dotenv').config();
const given = require('../../steps/given');
const when = require('../../steps/when');
const then = require('../../steps/then');
const chance = require('chance').Chance();
const path = require('path');

describe('Given an authenticated user', () => {
  let user;
  beforeAll(async () => {
    user = await given.an_authenticated_user();
  });

  describe('When user sends a tweet', () => {
    let tweet;
    const text = chance.string({ length: 16 });
    beforeAll(async () => {
      tweet = await when.a_user_calls_tweet(user, text);
    });

    it('Should return the new tweet', () => {
      expect(tweet).toMatchObject({
        text,
        replies: 0,
        likes: 0,
        retweets: 0,
        liked: false,
      });
    });

    describe('When user calls getTweets', () => {
      let tweets, nextToken;
      beforeAll(async () => {
        const result = await when.a_user_calls_getTweets(
          user,
          user.username,
          25
        );
        tweets = result.tweets;
        nextToken = result.nextToken;
      });

      it('User will see the new tweet in the tweets array', async () => {
        expect(nextToken).toBeNull();
        expect(tweets).toHaveLength(1);
        expect(tweets[0]).toEqual(tweet);
      });

      it('User cannot ask for more than 25 tweets in a page', async () => {
        await expect(
          when.a_user_calls_getTweets(user, user.username, 26)
        ).rejects.toMatchObject({
          message: expect.stringContaining('Max limit is 25'),
        });
      });
    });

    describe('When user calls getMyTimeline', () => {
      let tweets, nextToken;
      beforeAll(async () => {
        const result = await when.a_user_calls_getMyTimeline(user, 25);
        tweets = result.tweets;
        nextToken = result.nextToken;
      });

      it('User will see the new tweet in the tweets array', async () => {
        expect(nextToken).toBeNull();
        expect(tweets).toHaveLength(1);
        expect(tweets[0]).toEqual(tweet);
      });

      it('User cannot ask for more than 25 tweets in a page', async () => {
        await expect(
          when.a_user_calls_getMyTimeline(user, 26)
        ).rejects.toMatchObject({
          message: expect.stringContaining('Max limit is 25'),
        });
      });
    });

    describe('When user likes the tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_like(user, tweet.id);
      });

      it('Should see Tweet.liked as true', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(user, 25);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].id).toEqual(tweet.id);
        expect(tweets[0].liked).toEqual(true);
      });

      it('Should not be able to like the same tweet a second time', async () => {
        await expect(() =>
          when.a_user_calls_like(user, tweet.id)
        ).rejects.toMatchObject({
          message: expect.stringContaining('DynamoDB transaction error'),
        });
      });

      it('Should see the tweet when user calls getLikes', async () => {
        const { tweets, nextToken } = await when.a_user_calls_getLikes(
          user,
          user.username,
          25
        );
        expect(nextToken).toBeNull();
        expect(tweets).toHaveLength(1);
        expect(tweets[0]).toMatchObject({
          ...tweet,
          liked: true,
          likes: 1,
          profile: { ...tweet.profile, likesCount: 1 },
        });
      });
    });

    describe('When user unlikes the tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_unlike(user, tweet.id);
      });

      it('Should see Tweet.liked as false', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(user, 25);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].id).toEqual(tweet.id);
        expect(tweets[0].liked).toEqual(false);
      });

      it('Should not be able to unlike the same tweet a second time', async () => {
        await expect(() =>
          when.a_user_calls_unlike(user, tweet.id)
        ).rejects.toMatchObject({
          message: expect.stringContaining('DynamoDB transaction error'),
        });
      });

      it('Should not see the tweet when user calls getLikes', async () => {
        const { tweets, nextToken } = await when.a_user_calls_getLikes(
          user,
          user.username,
          25
        );
        expect(nextToken).toBeNull();
        expect(tweets).toHaveLength(0);
      });
    });
  });
});
