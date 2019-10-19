import { GitHubClient } from "github-graphql-v4-client";
import { Repo, PageInfo } from './data-types';

const perPageNum = 5;

function parseRepo(r: RawRepoInfo): Repo {
    let repo: Repo = {
        // basic
        id: r.id,
        owner: r.owner ? r.owner.login : null,
        ownerInfo: r.owner,
        name: r.name,
        createdAt: r.createdAt ? new Date(r.createdAt) : null,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
        pushedAt: r.pushedAt ? new Date(r.pushedAt) : null,
        license: r.licenseInfo ? r.licenseInfo.name : null,
        codeOfConduct: r.codeOfConduct ? r.codeOfConduct.url : null,
        isFork: r.isFork,
        description: r.description,
        language: r.primaryLanguage ? r.primaryLanguage.name : null,
        // star
        starCount: r.stargazers ? r.stargazers.totalCount : 0,
        stars: [],
        // watch
        watchCount: r.watchers ? r.watchers.totalCount : 0,
        // fork
        forkCount: r.forkCount,
        directForkCount: r.forks ? r.forks.totalCount : 0,
        forks: [],
        // branch
        branchCount: r.refs ? r.refs.totalCount : 0,
        defaultBranchName: r.defaultBranchRef ? r.defaultBranchRef.name : "",
        defaultBranchCommitCount: (r.defaultBranchRef && r.defaultBranchRef.target) ? r.defaultBranchRef.target.history.totalCount : 0,
        // release
        releaseCount: r.releases ? r.releases.totalCount : 0,
        // issue
        issues: [],
        // pull request
        pulls: [],
        // contributor
        contributors: []
    };
    return repo;
}

export async function getRepos(login: string, client: GitHubClient, updatedAfter?: Date): Promise<Repo[]> {
    let repos: Repo[] = [];
    let pageInfo: PageInfo;
    let reposInfo: ReposInfo;
    do {
        reposInfo = await client.query<ReposInfo, QueryVars>(listReposSql,
            {
                login,
                num: perPageNum,
                cursor: pageInfo ? pageInfo.endCursor : null
            });
        if (!reposInfo || !reposInfo.repositoryOwner || !reposInfo.repositoryOwner.repositories
            || reposInfo.repositoryOwner.repositories.nodes.length === 0) break;
        let lastUpdatedAt = new Date(reposInfo.repositoryOwner.repositories
            .nodes[reposInfo.repositoryOwner.repositories.nodes.length - 1].updatedAt);
        if (updatedAfter && lastUpdatedAt < updatedAfter) {
            repos = repos.concat(reposInfo.repositoryOwner.repositories.nodes.filter(r => new Date(r.updatedAt) >= updatedAfter).map(parseRepo));
            break;
        }
        repos = repos.concat(reposInfo.repositoryOwner.repositories.nodes.map(parseRepo));

        pageInfo = reposInfo.repositoryOwner.repositories.pageInfo;
    } while (pageInfo.hasNextPage);
    return repos;
}

type RawRepoInfo = {
    owner: {
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
    id: string;
    updatedAt: string;
    pushedAt: string;
    createdAt: string;
    isFork: boolean;
    description: string;
    primaryLanguage: {
        name: string;
    };
    refs: {
        totalCount: number;
    };
    defaultBranchRef: {
        name: string;
        target: {
            history: {
                totalCount: number;
            };
        };
    };
    releases: {
        totalCount: number;
    };
    stargazers: {
        totalCount: number;
    };
    watchers: {
        totalCount: number;
    };
    forkCount: number;
    forks: {
        totalCount: number;
    };
    licenseInfo: {
        name: string;
    };
    codeOfConduct: {
        url: string;
    };
}

type ReposInfo = {
    repositoryOwner: {
        repositories: {
            pageInfo: {
                hasNextPage: boolean;
                endCursor: string;
            };
            nodes: RawRepoInfo[];
        };
    };
};

type QueryVars = {
    login: string;
    num: number;
    cursor: string;
}

const listReposSql = `query listReopsFirst($login: String!, $num: Int, $cursor: String) {
    rateLimit {
        remaining
        resetAt
        cost
    }
    repositoryOwner(login: $login) {
        repositories(first: $num, orderBy: {field: UPDATED_AT, direction: DESC}, after:$cursor) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                owner {
                    login
                    __typename
                    ... on User {
                        name
                        email
                        bio
                        location
                        company
                        createdAt
                        websiteUrl
                        repositories {
                            totalCount
                        }
                    }
                    ... on Organization {
                        name
                        email
                        description
                        location
                        websiteUrl
                        repositories {
                            totalCount
                        }
                        membersWithRole {
                            totalCount
                        }
                    }
                }
                name
                id
                updatedAt
                createdAt
                pushedAt
                isFork
                description
                primaryLanguage {
                    name
                }
                refs(refPrefix: "refs/heads/") {
                    totalCount
                }
                defaultBranchRef {
                    name
                    target {
                        ... on Commit {
                            history(author: {}) {
                                totalCount
                            }
                        }
                    }
                }
                releases {
                    totalCount
                }
                stargazers {
                    totalCount
                }
                watchers {
                    totalCount
                }
                forkCount
                forks {
                    totalCount
                }
                licenseInfo {
                    name
                }
                codeOfConduct {
                    url
                }
            }
        }
    }
}`
