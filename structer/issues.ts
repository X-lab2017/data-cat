import { GitHubClient } from "github-graphql-v4-client";
import { Issue, PageInfo } from "./data-types";

const issuesPerPage = 5;
const commentCount = 100;
const labelCount = 10;

function parseIssue(i: RawIssue): Issue {
    return {
        id: i.id,
        author: i.author.login,
        number: i.number,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        closedAt: i.closedAt,
        title: i.title,
        body: i.body,
        labels: i.labels.nodes.map(l => l.name),
        comments: i.comments.nodes.filter(c => c.author).map(c => {
            return {
                id: c.id,
                login: c.author.login,
                body: c.body,
                url: c.url,
                createdAt: c.createdAt
            };
        })
    };
}

export async function getIssues(client: GitHubClient, owner: string, name: string, updatedAfter?: Date): Promise<Issue[]> {
    let issuesInfo: IssuesInfo;
    let pageInfo: PageInfo;
    let issues: Issue[] = [];
    do {
        issuesInfo = await client.query<IssuesInfo, QueryVar>(getIssueSql, {
            owner,
            name,
            issueCount: issuesPerPage,
            cursor: pageInfo ? pageInfo.endCursor : null,
            labelCount,
            commentCount
        });
        if (!issuesInfo || !issuesInfo.repository || !issuesInfo.repository.issues || issuesInfo.repository.issues.nodes.length === 0) break;
        if (updatedAfter && new Date(issuesInfo.repository.issues.nodes[issuesInfo.repository.issues.nodes.length - 1].updatedAt) <= updatedAfter) {
            issues = issues.concat(issuesInfo.repository.issues.nodes.filter(i => i.author && new Date(i.updatedAt) >= updatedAfter).map(parseIssue));
            break;
        }
        issues = issues.concat(issuesInfo.repository.issues.nodes.filter(i => i.author).map(parseIssue));
        pageInfo = issuesInfo.repository.issues.pageInfo;
    } while (pageInfo.hasNextPage);
    return issues;
}

type RawIssue = {
    id: string;
    title: string;
    body: string;
    number: number;
    createdAt: string;
    updatedAt: string;
    closedAt: string;
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
}

type IssuesInfo = {
    repository: {
        issues: {
            pageInfo: PageInfo;
            nodes: RawIssue[];
        }
    }
};

type QueryVar = {
    owner: string;
    name: string;
    issueCount: number;
    cursor: string;
    labelCount: number;
    commentCount: number;
};

const getIssueSql = `
query getIssues($owner: String!, $name: String!, $issueCount: Int, $cursor: String, $labelCount: Int, $commentCount: Int) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    repository(owner: $owner, name: $name) {
        issues(first: $issueCount, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor) {
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
            }
        }
    }
}
`;
