import Logger = require('bunyan')
import { GitHubClient } from "github-graphql-v4-client";

import { getRepos } from "../structer/organizations"
import { Repo, UserWithTimeStamp, Issue, PullRequest, UserWithTimeStampAndEmail } from '../structer/data-types';
import { getRepo } from "../structer/repos"
import { getStars } from '../structer/stars';
import { getForks } from '../structer/forks';
import { getIssues } from '../structer/issues';
import { getPullRequests } from '../structer/pull-requests';
import { getContributors } from "../structer/contributors"


interface OrgProxy {
  repos: (login: string, updatedAfter?: Date) => Promise<Repo[]>;
}

interface RepoFullParam {
  stars?: boolean;
  forks?: boolean;
  issues?: boolean;
  pulls?: boolean;
  contributors?: boolean;
}

interface RepoPoxy {
  info: (owner: string, name: string) => Promise<Repo>;
  stars: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
  forks: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
  issues: (owner: string, name: string, updatedAfter?: Date) => Promise<Issue[]>;
  pulls: (owner: string, name: string, updatedAfter?: Date) => Promise<PullRequest[]>;
  contributors: (owner: string, name: string, branch: string, commitLimit?: number) => Promise<UserWithTimeStampAndEmail[]>;
  full: (owner: string, name: string, param?: RepoFullParam, updatedAfter?: Date) => Promise<Repo>;
}

interface DataCatOption {
  tokens: string[];
  logger?: Logger;
  maxConcurrentReqNumber?: number;
  filterStatusCode?: number[];
  maxRetryTimes?: number;
}


export class DataCat {
  private logger: Logger = Logger.createLogger({
    name: "GitHub-GraphQL-Fetcher",
    level: Logger.ERROR
  });
  private client: GitHubClient;
  private tokens: string[];
  private maxConcurrentReqNumber: number = 10;
  private filterStatusCode: number[] = [400, 401, 403, 404];
  private maxRetryTimes = 10;

  constructor(options: DataCatOption) {
    if (options.tokens.length === 0) {
      throw new Error('At least one token needed.');
    }
    this.tokens = options.tokens;
    if (options.logger) {
      this.logger = options.logger;
    }
    if (options.filterStatusCode) {
      this.filterStatusCode = options.filterStatusCode;
    }
    if (options.maxRetryTimes) {
      this.maxRetryTimes = options.maxRetryTimes;
    }
    if (options.maxConcurrentReqNumber) {
      this.maxConcurrentReqNumber = options.maxConcurrentReqNumber;
    }

  }

  public async init() {
    this.client = new GitHubClient({
      tokens: this.tokens,
      logger: this.logger,
      maxConcurrentReqNumber: this.maxConcurrentReqNumber,
      filterStatusCode: this.filterStatusCode,
      maxRetryTimes: this.maxRetryTimes
    });
    await this.client.init();
  }

  public org: OrgProxy = {
    repos: (login, updatedAfter) => getRepos(login, this.client, updatedAfter)
  }

  public repo: RepoPoxy = {
    info: (owner, name) => getRepo(owner, name, this.client),
    stars: (owner, name, updatedAfter) => getStars(this.client, owner, name, updatedAfter),
    forks: (owner, name, updatedAfter) => getForks(this.client, owner, name, updatedAfter),
    issues: (owner, name, updatedAfter) => getIssues(this.client, owner, name, updatedAfter),
    pulls: (owner, name, updatedAfter) => getPullRequests(this.client, owner, name, updatedAfter),
    contributors: (owner, name, branch, commitLimit) => getContributors(this.client, owner, name, branch, commitLimit),
    full: async (owner, name, params, updatedAfter) => {
      let repo = await this.repo.info(owner, name);

      let [stars, forks, issues, pulls, contributors] = await Promise.all([
        (params && params.stars && repo.starCount > 0) ? this.repo.stars(owner, name, updatedAfter) : [],
        (params && params.forks && repo.forkCount > 0) ? this.repo.forks(owner, name, updatedAfter) : [],
        (params && params.issues) ? this.repo.issues(owner, name, updatedAfter) : [],
        (params && params.pulls) ? this.repo.pulls(owner, name, updatedAfter) : [],
        (params && params.contributors) ?
          // if get contributors, then only get these after repo created
          this.repo.contributors(owner, name, repo.defaultBranchName) : []
      ]);
      repo.stars = stars;
      repo.forks = forks;
      repo.issues = issues;
      repo.pulls = pulls;
      repo.contributors = contributors;
      return repo;
    }
  }
}