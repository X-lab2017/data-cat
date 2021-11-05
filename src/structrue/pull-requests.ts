import { GitHubClient } from 'github-graphql-v4-client';
import { Comment, PullRequest, PageInfo } from './data-types';

const pullRequestsPerPage: number = 5;
const commentCount = 100;
const labelCount = 10;
const commitCount: number = 100;
const reviewCount: number = 100;
const reviewCommentCount: number = 100;

function parsePullRequest(pr: RawPullRequest): PullRequest {
  const reivewComments: Comment[] = [];
  pr.reviews.nodes.forEach(r => {
    r.comments.nodes.filter(c => c.author).forEach(c => {
      reivewComments.push({
        id: c.id,
        url: c.url,
        login: c.author.login,
        body: c.body,
        createdAt: c.createdAt
      });
    });
  });
  let additions: number = 0;
  let deletions: number = 0;
  pr.commits.nodes.forEach(ci => {
    additions += ci.commit.additions;
    deletions += ci.commit.deletions;
  });
  return {
    id: pr.id,
    author: pr.author.login,
    number: pr.number,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    closedAt: pr.closedAt,
    mergedAt: pr.mergedAt,
    title: pr.title,
    body: pr.body,
    labels: pr.labels.nodes.map(l => l.name),
    comments: pr.comments.nodes.filter(c => c.author).map(c => {
      return {
        id: c.id,
        login: c.author.login,
        body: c.body,
        url: c.url,
        createdAt: c.createdAt
      };
    }),
    reviewComments: reivewComments,
    additions,
    deletions
  };
}

export async function getPullRequests(client: GitHubClient, owner: string, name: string, updatedAfter?: Date): Promise<PullRequest[]> {
  let prsInfo: PullRequestInfo;
  let prs: PullRequest[] = [];
  let pageInfo: PageInfo;
  do {
    prsInfo = await client.query<PullRequestInfo, QueryVar>(getMoreIssueSql, {
      owner,
      name,
      prCount: pullRequestsPerPage,
      cursor: pageInfo ? pageInfo.endCursor : null,
      labelCount,
      commentCount,
      reviewCount,
      commitCount,
      reviewCommentCount
    });
    if (!prsInfo || !prsInfo.repository || !prsInfo.repository.pullRequests || prsInfo.repository.pullRequests.nodes.length === 0) break;
    if (updatedAfter && new Date(prsInfo.repository.pullRequests.nodes[prsInfo.repository.pullRequests.nodes.length - 1].updatedAt) <= updatedAfter) {
      prs = prs.concat(prsInfo.repository.pullRequests.nodes.filter(pr => pr.author && new Date(pr.updatedAt) >= updatedAfter).map(parsePullRequest));
      break;
    }
    prs = prs.concat(prsInfo.repository.pullRequests.nodes.filter(pr => pr.author).map(parsePullRequest));
    pageInfo = prsInfo.repository.pullRequests.pageInfo;
  } while (pageInfo.hasNextPage);
  return prs;
}

type RawPullRequest = {
  id: string;
  title: string;
  body: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  mergedAt: string;
  author: { login: string };
  labels: { nodes: { name: string }[] };
  comments: {
    nodes: {
      id: string;
      body: string;
      url: string;
      author: { login: string };
      createdAt: string;
    }[];
  };
  commits: {
    nodes: {
      commit: {
        additions: number;
        deletions: number;
      };
    }[];
  };
  reviews: {
    nodes: {
      comments: {
        nodes: {
          id: string;
          author: {
            login: string;
          };
          url: string;
          body: string;
          createdAt: string;
        }[];
      }
    }[];
  };
};

type PullRequestInfo = {
  repository: {
    pullRequests: {
      pageInfo: PageInfo;
      nodes: RawPullRequest[];
    };
  };
};

type QueryVar = {
  owner: string;
  name: string;
  prCount: number;
  cursor: string;
  labelCount: number;
  commentCount: number;
  commitCount: number;
  reviewCount: number;
  reviewCommentCount: number;
};

const getMoreIssueSql = `
query getMorePullRequests($owner: String!, $name: String!, $prCount: Int, $cursor: String, $labelCount: Int, $commentCount: Int, $commitCount: Int, $reviewCount: Int, $reviewCommentCount: Int) {
    rateLimit {
      resetAt
      remaining
      cost
    }
    repository(owner: $owner, name: $name) {
      pullRequests(first: $prCount, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          body
          number
          createdAt
          updatedAt
          closedAt
          mergedAt
          author {
            login
          }
          labels(first: $labelCount) {
            nodes {
              name
            }
          }
          comments(first: $commentCount) {
            nodes {
              id
              body
              url
              author {
                login
              }
              createdAt
            }
          }
          commits(first: $commitCount) {
            nodes {
              commit {
                additions
                deletions
              }
            }
          }
          reviews(first: $reviewCount) {
            nodes {
              comments(first: $reviewCommentCount) {
                nodes {
                  id
                  url
                  author {
                    login
                  }
                  body
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  }
`;
