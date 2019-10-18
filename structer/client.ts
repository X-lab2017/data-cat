const graphql = require("@octokit/graphql");
const waitFor = require("p-wait-for");
import { getRepos } from "./organizations"
import { Repo, UserWithTimeStamp, Issue, PullRequest, UserWithTimeStampAndEmail } from './data-types';
import { getRepo } from './repos';
import { getStars } from './stars';
import { getForks } from './forks';
import { getIssues } from './issues';
import { getPullRequests } from './pull-requests';
import { getContributors } from './contributors';
import Logger = require("bunyan");

type Token = {
    // token for this connection
    token: string;
    // connection rate limit remaining
    ratelimitRemaining: number;
    // connection rate limit reset time
    ratelimitReset: number;
}

type OrgProxy = {
    repos: (login: string, updatedAfter?: Date) => Promise<Repo[]>;
}

type RepoFullParam = {
    stars?: boolean;
    forks?: boolean;
    issues?: boolean;
    pulls?: boolean;
    contributors?: boolean;
}

type RepoPoxy = {
    info: (owner: string, name: string) => Promise<Repo>;
    stars: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
    forks: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
    issues: (owner: string, name: string, updatedAfter?: Date) => Promise<Issue[]>;
    pulls: (owner: string, name: string, updatedAfter?: Date) => Promise<PullRequest[]>;
    contributors: (owner: string, name: string, branch: string, commitLimit?: number) => Promise<UserWithTimeStampAndEmail[]>;
    full: (owner: string, name: string, param?: RepoFullParam, updatedAfter?: Date) => Promise<Repo>;
}

type ClientOption = {
    tokens: string[];
    logger?: Logger;
    maxConcurrentReqNumber?: number;
}

export class GitHubClient {

    private tokens: Token[] = [];
    private maxConcurrentReqNumber: number = 10;
    private concurrentReqNumber: number = 0;
    private logger: Logger = Logger.createLogger({
        name: "GitHub-GraphQL-Fetcher",
        level: Logger.ERROR
    });
    private getConnectionRetryInterval = 10000;
    private filterStatusCode: number[] = [400, 401, 403, 404];
    private requestCostPrediction = 15;

    private inited: boolean;

    constructor(options: ClientOption) {
        if (options.tokens.length === 0) {
            throw new Error("At least one token needed.");
        }
        if (options.logger) {
            this.logger = options.logger;
        }
        if (options.maxConcurrentReqNumber) this.maxConcurrentReqNumber = options.maxConcurrentReqNumber;
        this.tokens = options.tokens.map(t => { return { token: t, ratelimitRemaining: -1, ratelimitReset: -1 } });
        this.inited = false;
    }

    public async init() {
        await Promise.all(this.tokens.map(token => this.initToken(token)));
        this.logger.info(`Token inited done, tokens = ${JSON.stringify(this.tokens)}`);
        this.inited = true;
    }

    // get a valid token
    private async getToken(): Promise<Token> {
        let token: Token;
        await waitFor(() => {
            if (this.concurrentReqNumber >= this.maxConcurrentReqNumber) {
                return false;
            }
            let availableTokens = this.tokens.filter(c => c.ratelimitRemaining > this.requestCostPrediction * this.maxConcurrentReqNumber);
            if (availableTokens.length === 0) {
                this.logger.error(`No avialable token found for now, will try later`);
                return false;
            }
            this.concurrentReqNumber += 1;
            token = availableTokens[Math.floor(Math.random() * availableTokens.length)];
            return true;
        }, {
                interval: this.getConnectionRetryInterval
            });
        // this.logger(`Now req number is ${this.concurrentReqNumber}, max req number is ${this.maxConcurrentReqNumber}`);
        return token;
    }

    // query function
    public async query<TR, T>(q: string, p: T): Promise<TR> {
        if (!this.inited) {
            throw "Client not inited yet! Call `await client.init()` to init.";
        }
        let token = await this.getToken();
        try {
            // set auth token
            Object.assign(p, { headers: { authorization: `token ${token.token}` } });
            let res = (await graphql(q, p));
            let rateLimitRes = res as RateLimitResponse;
            this.concurrentReqNumber--;
            if (!rateLimitRes.rateLimit) {
                this.logger.error(`No rate limit returned for query = ${q}, param = ${JSON.stringify(p)}`);
                process.exit(1);
            }
            token.ratelimitRemaining = rateLimitRes.rateLimit.remaining;
            token.ratelimitReset = rateLimitRes.rateLimit.resetAt;
            this.resetToken(token);
            return res;
        } catch (e) {
            this.logger.error(`Error happened, e = ${JSON.stringify(e)}`);

            this.concurrentReqNumber--;
            let apiRateLimitExceeded = false;
            let response = e as ResponseException;
            if (response.errors) {
                // log error if exists
                if (response.errors.find(e => e.message.includes("API rate limit exceeded"))) {
                    // rate limit exceeded
                    this.logger.warn(`Token API rate limit exceeded, token = ${JSON.stringify(token)}`);
                    apiRateLimitExceeded = true;
                    this.resetToken(token);
                } else if (response.errors.find(e => e.type && e.type === "NOT_FOUND")) {
                    // not found, maybe deleted
                    return null;
                } else {
                    this.logger.error(JSON.stringify(response.errors));
                }
            }
            if (apiRateLimitExceeded || !response.status || (response.status >= 400 && !this.filterStatusCode.includes(response.status))) {
                // api rate limit exceeded
                // no status field
                // status >= 400
                return this.query<TR, T>(q, p);
            } else if (response.data) {
                // other status code, return data if exists
                return response.data;
            }
        }
        return null;
    }

    private resetToken(token: Token) {
        if (token.ratelimitRemaining > this.requestCostPrediction * this.maxConcurrentReqNumber) return;
        let resetTime = new Date(token.ratelimitReset).getTime() - new Date().getTime() + 1000 // add 1s to ensure reset on server side
        if (resetTime < 0) {
            this.logger.error(`Something wrong with rate limit maintain.`);
            resetTime = 10 * 60 * 1000;
        }
        setTimeout(() => {
            this.initToken(token);
        }, resetTime);
    }

    private async initToken(token: Token) {
        let response: RateLimitResponse = await graphql(rateLimitQuerySql, { headers: { authorization: `token ${token.token}` } });
        token.ratelimitRemaining = response.rateLimit.remaining;
        token.ratelimitReset = response.rateLimit.resetAt;
        this.resetToken(token);
    }

    public org: OrgProxy = {
        repos: (login, updatedAfter) => getRepos(login, this, updatedAfter)
    }

    public repo: RepoPoxy = {
        info: (owner, name) => getRepo(owner, name, this),
        stars: (owner, name, updatedAfter) => getStars(this, owner, name, updatedAfter),
        forks: (owner, name, updatedAfter) => getForks(this, owner, name, updatedAfter),
        issues: (owner, name, updatedAfter) => getIssues(this, owner, name, updatedAfter),
        pulls: (owner, name, updatedAfter) => getPullRequests(this, owner, name, updatedAfter),
        contributors: (owner, name, branch, commitLimit) => getContributors(this, owner, name, branch, commitLimit),
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

type RateLimitResponse = {
    rateLimit: {
        remaining: number;
        resetAt: number;
        cost: number;
    };
}

type ResponseException = {
    name: string;
    status: number;
    errors: { type: string, message: string }[];
    data: any
}

const rateLimitQuerySql = `
query {
    rateLimit {
        resetAt
        remaining
    }
}
`
