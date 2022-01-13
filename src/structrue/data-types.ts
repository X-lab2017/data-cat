export type Repo = {
  // basic
  id: string;
  databaseId: number;
  owner: string;
  ownerInfo: {
    login: string;
    __typename: string;
    name: string;
    bio: string;
    description: string;
    createdAt: Date;
    company: string;
    location: string;
    websiteUrl: URL;
    repositories: {
      totalCount: number;
    }
    membersWithRole: {
      totalCount: number;
    }
  };
  name: string;
  license: string;
  codeOfConduct: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
  isFork: boolean;
  description: string;
  language: string;
  // star
  starCount: number;
  stars: UserWithTimeStamp[];
  // watch
  watchCount: number;
  // fork
  forkCount: number;
  directForkCount: number;
  forks: UserWithTimeStamp[];
  // branch
  branchCount: number;
  defaultBranchName: string;
  defaultBranchCommitCount: number;
  // release
  releaseCount: number;
  // topic
  topics: string[];
  // issue
  issues: Issue[];
  // pull request
  pulls: PullRequest[];
  // contributors
  contributors: UserWithTimeStampAndEmail[];
};

export type Issue = {
  id: string;
  author: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  title: string;
  body: string;
  labels: string[];
  comments: Comment[];
};

export type PullRequest = {
  id: string;
  author: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  mergedAt: string;
  title: string;
  body: string;
  labels: string[];
  comments: Comment[];
  reviewComments: Comment[];
  additions: number;
  deletions: number;
};

export type Comment = {
  id: string;
  login: string;
  body: string;
  url: string;
  createdAt: string;
};

export type UserWithTimeStamp = {
  login: string;
  time: string;
};

export type UserWithTimeStampAndEmail = {
  login: string;
  email: string;
  time: string;
};

export type User = {
  databaseId: number;
  createdAt: string;
  location: string;
  company: string;
  bio: string;
  isEmployee: boolean;
  email: string;
  name: string;
};

export type UserFollower = {
  login: string;
  databaseId: number;
};

export type PageInfo = {
  hasNextPage: boolean;
  endCursor: string;
};
