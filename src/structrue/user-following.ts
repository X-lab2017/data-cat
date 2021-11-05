import { GitHubClient } from 'github-graphql-v4-client';
import { PageInfo, UserFollower } from './data-types';

const followCountPerPage = 50;

export async function getUserFollowing(login: string, client: GitHubClient): Promise<UserFollower[]> {
  let result: UserFollower[] = [];
  let pageInfo: PageInfo;
  do {
    const userFollowingInfo = await client.query<UserFollowingInfo, QueryVars>(getUserInfoSql, {
      login,
      perPage: followCountPerPage,
      cursor: pageInfo ? pageInfo.endCursor : null
    });

    if (!userFollowingInfo || !userFollowingInfo.user || !userFollowingInfo.user.following) break;
    pageInfo = userFollowingInfo.user.following.pageInfo;
    result = result.concat(userFollowingInfo.user.following.nodes);
  } while (pageInfo.hasNextPage);
  return result;
}

type UserFollowingInfo = {
  user: {
    following: {
      pageInfo: PageInfo;
      nodes: UserFollower[];
    };
  };
};

type QueryVars = {
  login: string;
  perPage: number;
  cursor: string;
};

const getUserInfoSql = `query getUserFollowing($login: String!, $perPage: Int, $cursor: String) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    user(login: $login) {
      following(first: $perPage, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          login
          databaseId
        }
      }
    }
}
`;
