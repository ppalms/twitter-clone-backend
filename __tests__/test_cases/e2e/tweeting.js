require('dotenv').config();
const given = require('../../steps/given');
const when = require('../../steps/when');
const then = require('../../steps/then');
const chance = require('chance').Chance();
const path = require('path');

describe('Given an authenticated user', () => {
  let userA;
  beforeAll(async () => {
    userA = await given.an_authenticated_user();
  });

  describe('When user sends a tweet', () => {
    let tweet;
    const text = chance.string({ length: 16 });
    beforeAll(async () => {
      tweet = await when.a_user_calls_tweet(userA, text);
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
          userA,
          userA.username,
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
          when.a_user_calls_getTweets(userA, userA.username, 26)
        ).rejects.toMatchObject({
          message: expect.stringContaining('Max limit is 25'),
        });
      });
    });

    describe('When user calls getMyTimeline', () => {
      let tweets, nextToken;
      beforeAll(async () => {
        const result = await when.a_user_calls_getMyTimeline(userA, 25);
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
          when.a_user_calls_getMyTimeline(userA, 26)
        ).rejects.toMatchObject({
          message: expect.stringContaining('Max limit is 25'),
        });
      });
    });

    describe('When user likes the tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_like(userA, tweet.id);
      });

      it('Should see Tweet.liked as true', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].id).toEqual(tweet.id);
        expect(tweets[0].liked).toEqual(true);
      });

      it('Should not be able to like the same tweet a second time', async () => {
        await expect(() =>
          when.a_user_calls_like(userA, tweet.id)
        ).rejects.toMatchObject({
          message: expect.stringContaining('DynamoDB transaction error'),
        });
      });

      it('Should see the tweet when user calls getLikes', async () => {
        const { tweets, nextToken } = await when.a_user_calls_getLikes(
          userA,
          userA.username,
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
        await when.a_user_calls_unlike(userA, tweet.id);
      });

      it('Should see Tweet.liked as false', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].id).toEqual(tweet.id);
        expect(tweets[0].liked).toEqual(false);
      });

      it('Should not be able to unlike the same tweet a second time', async () => {
        await expect(() =>
          when.a_user_calls_unlike(userA, tweet.id)
        ).rejects.toMatchObject({
          message: expect.stringContaining('DynamoDB transaction error'),
        });
      });

      it('Should not see the tweet when user calls getLikes', async () => {
        const { tweets, nextToken } = await when.a_user_calls_getLikes(
          userA,
          userA.username,
          25
        );
        expect(nextToken).toBeNull();
        expect(tweets).toHaveLength(0);
      });
    });

    describe('When user retweets own tweet', () => {
      beforeAll(async () => {
        await when.a_user_calls_retweet(userA, tweet.id);
      });

      it('Should see the retweet when user calls getTweets', async () => {
        const { tweets } = await when.a_user_calls_getTweets(
          userA,
          userA.username,
          25
        );

        expect(tweets).toHaveLength(2);
        expect(tweets[0]).toMatchObject({
          profile: {
            id: userA.username,
            tweetsCount: 2,
          },
          retweetOf: {
            ...tweet,
            retweets: 1,
            retweeted: true,
            profile: {
              id: userA.username,
              tweetsCount: 2,
            },
          },
        });
        expect(tweets[1]).toMatchObject({
          ...tweet,
          retweets: 1,
          retweeted: true,
          profile: {
            id: userA.username,
            tweetsCount: 2,
          },
        });
      });

      it('Should not see the retweet when user calls getMyTimeline', async () => {
        const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25);

        expect(tweets).toHaveLength(1);
        expect(tweets[0]).toMatchObject({
          ...tweet,
          retweets: 1,
          retweeted: true,
          profile: {
            id: userA.username,
            tweetsCount: 2,
          },
        });
      });

      describe('When user unretweets own tweet', () => {
        beforeAll(async () => {
          await when.a_user_calls_unretweet(userA, tweet.id);
        });

        it('Should not see tweet when user calls getTweets', async () => {
          const { tweets } = await when.a_user_calls_getTweets(
            userA,
            userA.username,
            25
          );

          expect(tweets).toHaveLength(1);
          expect(tweets[0]).toMatchObject({
            ...tweet,
            retweets: 0,
            retweeted: false,
            profile: {
              id: userA.username,
              tweetsCount: 1,
            },
          });
        });
      });
    });

    describe('Given user B sends sends a tweet', () => {
      let userB, anotherTweet;
      beforeAll(async () => {
        userB = await given.an_authenticated_user();
        const text = chance.string({ length: 16 });
        anotherTweet = await when.a_user_calls_tweet(userB, text);
      });

      describe("When user A retweets user B's tweet", () => {
        beforeAll(async () => {
          await when.a_user_calls_retweet(userA, anotherTweet.id);
        });

        it('Should see the retweet when user A calls getTweets', async () => {
          const { tweets } = await when.a_user_calls_getTweets(
            userA,
            userA.username,
            25
          );

          expect(tweets).toHaveLength(2);
          expect(tweets[0]).toMatchObject({
            profile: {
              id: userA.username,
              tweetsCount: 2,
            },
            retweetOf: {
              ...anotherTweet,
              retweets: 1,
              retweeted: true,
            },
          });
        });

        it('Should see the retweet when user A calls getMyTimeline', async () => {
          const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25);

          expect(tweets).toHaveLength(2);
          expect(tweets[0]).toMatchObject({
            profile: {
              id: userA.username,
              tweetsCount: 2,
            },
            retweetOf: {
              ...anotherTweet,
              retweets: 1,
              retweeted: true,
            },
          });
        });
      });

      describe("When user A unretweets user B's tweet", () => {
        beforeAll(async () => {
          await when.a_user_calls_unretweet(userA, anotherTweet.id);
        });

        it('Should not see the retweet when user A calls getTweets', async () => {
          const { tweets } = await when.a_user_calls_getTweets(
            userA,
            userA.username,
            25
          );

          expect(tweets).toHaveLength(1);
          expect(tweets[0]).toMatchObject({
            ...tweet,
            retweets: 0,
            retweeted: false,
            profile: {
              id: userA.username,
              tweetsCount: 1,
            },
          });
        });

        it('Should not see the retweet when user A calls getMyTimeline', async () => {
          const { tweets } = await when.a_user_calls_getMyTimeline(userA, 25);

          expect(tweets).toHaveLength(1);
          expect(tweets[0]).toMatchObject({
            ...tweet,
            profile: {
              id: userA.username,
              tweetsCount: 1,
            },
          });
        });
      });
    });
  });
});
