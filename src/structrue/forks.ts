import { GitHubClient } from 'github-graphql-v4-client';
import { UserWithTimeStamp, PageInfo } from './data-types';

const forkCountPerPage = 20;

function parseFork(forkInfo: RawForkInfo): UserWithTimeStamp {
  return {
    login: forkInfo.owner.login,
    time: forkInfo.createdAt
  };
}

export async function getForks(client: GitHubClient, owner: string, name: string, updatedAfter?: Date): Promise<UserWithTimeStamp[]> {
  let forks: UserWithTimeStamp[] = [];
  let forksInfo: ForkInfo;
  let pageInfo: PageInfo;
  do {
    forksInfo = await client.query<ForkInfo, QueryVar>(getMoreIssueSql, {
      owner,
      name,
      forkCount: forkCountPerPage,
      cursor: pageInfo ? pageInfo.endCursor : null
    });
    if (!forksInfo || !forksInfo.repository || !forksInfo.repository.forks || forksInfo.repository.forks.nodes.length === 0) break;
    if (updatedAfter && new Date(forksInfo.repository.forks.nodes[forksInfo.repository.forks.nodes.length - 1].createdAt) <= updatedAfter) {
      forks = forks.concat(forksInfo.repository.forks.nodes.filter(f => f.owner && f.owner.login && new Date(f.createdAt) >= updatedAfter).map(parseFork));
      break;
    }
    forks = forks.concat(forksInfo.repository.forks.nodes.filter(f => f.owner).map(parseFork));
    pageInfo = forksInfo.repository.forks.pageInfo;
  } while (pageInfo.hasNextPage);
  return forks;
}

type RawForkInfo = {
  owner: {
    login: string;
  };
  createdAt: string;
};

type ForkInfo = {
  repository: {
    forks: {
      pageInfo: PageInfo;
      nodes: RawForkInfo[];
    }
  }
};

type QueryVar = {
  owner: string;
  name: string;
  forkCount: number;
  cursor: string;
};

const getMoreIssueSql = `
query getMoreForks($owner: String!, $name: String!, $forkCount: Int, $cursor: String) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    repository(owner: $owner, name: $name) {
        forks(first: $forkCount, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                owner {
                    login
                }
                createdAt
            }
        }
    }
}
`;
