import { GitHubClient } from 'github-graphql-v4-client';
import { User } from './data-types';

export async function getUser(login: string, client: GitHubClient): Promise<User> {
  const userInfo = await client.query<UserInfo, QueryVars>(getUserInfoSql, {
    login
  });
  if (!userInfo || !userInfo.user) return null;
  return userInfo.user;
}

type UserInfo = {
  user: User;
};

type QueryVars = {
  login: string;
};

const getUserInfoSql = `query getReposss($login: String!) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    user(login: $login) {
      createdAt
      databaseId
      location
      company
      bio
      isEmployee
      email
      name
    }
}
`;
