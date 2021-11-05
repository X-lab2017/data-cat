import { GitHubClient } from 'github-graphql-v4-client';
import { PageInfo, UserFollower } from './data-types';

const followCountPerPage = 50;

export async function getUserFollower(login: string, client: GitHubClient): Promise<UserFollower[]> {
  let result: UserFollower[] = [];
  let pageInfo: PageInfo;
  do {
    const userFollowerInfo = await client.query<UserFollowerInfo, QueryVars>(getUserInfoSql, {
      login,
      perPage: followCountPerPage,
      cursor: pageInfo ? pageInfo.endCursor : null
    });

    if (!userFollowerInfo || !userFollowerInfo.user || !userFollowerInfo.user.followers) break;
    pageInfo = userFollowerInfo.user.followers.pageInfo;
    result = result.concat(userFollowerInfo.user.followers.nodes);
  } while (pageInfo.hasNextPage);
  return result;
}

type UserFollowerInfo = {
  user: {
    followers: {
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

const getUserInfoSql = `query getUserFollower($login: String!, $perPage: Int, $cursor: String) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    user(login: $login) {
      followers(first: $perPage, after: $cursor) {
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
