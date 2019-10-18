import { GitHubClient } from "./client";
import { PageInfo, UserWithTimeStampAndEmail } from "./data-types";

const commitsPerPage = 20;

export async function getContributors(client: GitHubClient, owner: string, name: string, branchName: string, commitLimit?: number): Promise<UserWithTimeStampAndEmail[]> {
  let commitsInfo: CommitsInfo;
  let pageInfo: PageInfo;
  let commits: RawCommitInfo[] = [];
  do {
    commitsInfo = await client.query<CommitsInfo, QueryVar>(getCommitsSql, {
      owner,
      name,
      branchName,
      commitCount: commitsPerPage,
      cursor: pageInfo ? pageInfo.endCursor : null
    });
    if (!commitsInfo || !commitsInfo.repository || !commitsInfo.repository.ref ||
      !commitsInfo.repository.ref.target || commitsInfo.repository.ref.target.history.nodes.length === 0) break;
    commits = commits.concat(commitsInfo.repository.ref.target.history.nodes)
    pageInfo = commitsInfo.repository.ref.target.history.pageInfo;
    if (commitLimit && commits.length > commitLimit) break;
  } while (pageInfo.hasNextPage);
  let contributors: UserWithTimeStampAndEmail[] = [];
  commits.filter(c => c.author && c.author.user).forEach(c => {
    let date = c.pushedDate ? c.pushedDate : c.committedDate;
    let contributor = contributors.find(con => con.login === c.author.user.login);
    let email = c.author.user.email ? c.author.user.email : c.author.email;
    if (!contributor) {
      contributors.push({
        login: c.author.user.login,
        time: date,
        email
      });
    } else if (new Date(contributor.time) > new Date(date)) {
      contributor.time = date;
    } else {
      contributor.email = email;
    }
  });
  return contributors;
}

type RawCommitInfo = {
  author: {
    email: string;
    user: {
      login: string;
      email: string;
    };
  };
  pushedDate: string;
  committedDate: string;
}

type CommitsInfo = {
  repository: {
    ref: {
      target: {
        history: {
          pageInfo: PageInfo;
          nodes: RawCommitInfo[];
        }
      }
    }
  }
};

type QueryVar = {
  owner: string;
  name: string;
  commitCount: number;
  branchName: string;
  cursor: string;
};

const getCommitsSql = `
query getCommits($owner: String!, $name: String!, $branchName: String!, $commitCount: Int, $cursor: String) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    repository(owner: $owner, name: $name) {
        ref(qualifiedName: $branchName) {
            target {
                ... on Commit {
                    history(author: {}, first: $commitCount, after:$cursor) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            author {
                                email
                                user {
                                    login
                                    email
                                }
                            }
                            pushedDate
                            committedDate
                        }
                    }
                }
            }
        }
    }
}
`;
