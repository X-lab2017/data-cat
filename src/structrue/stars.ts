import { GitHubClient } from "github-graphql-v4-client";
import { UserWithTimeStamp, PageInfo } from "./data-types";

const starCountPerPage = 20;

function parseStar(starInfo: RawStarInfo): UserWithTimeStamp {
    return {
        login: starInfo.node.login,
        time: starInfo.starredAt
    }
}

export async function getStars(client: GitHubClient, owner: string, name: string, updatedAfter?: Date): Promise<UserWithTimeStamp[]> {
    let stars: UserWithTimeStamp[] = [];
    let starInfo: StarInfo;
    let pageInfo: PageInfo;
    do {
        starInfo = await client.query<StarInfo, QueryVar>(getStarSql, {
            owner,
            name,
            starCount: starCountPerPage,
            cursor: pageInfo ? pageInfo.endCursor : null
        });
        if (!starInfo || !starInfo.repository || !starInfo.repository.stargazers || starInfo.repository.stargazers.edges.length === 0) break;
        if (updatedAfter && new Date(starInfo.repository.stargazers.edges[starInfo.repository.stargazers.edges.length - 1].starredAt) <= updatedAfter) {
            stars = stars.concat(starInfo.repository.stargazers.edges.filter(e => e.node && e.node.login && new Date(e.starredAt) >= updatedAfter).map(parseStar));
            break;
        }
        stars = stars.concat(starInfo.repository.stargazers.edges.filter(e => e.node && e.node.login).map(parseStar));
        pageInfo = starInfo.repository.stargazers.pageInfo;
    } while (pageInfo.hasNextPage);
    return stars;
}

type RawStarInfo = {
    starredAt: string;
    node: {
        login: string;
    };
}

type StarInfo = {
    repository: {
        stargazers: {
            pageInfo: PageInfo;
            edges: RawStarInfo[];
        };
    };
};

type QueryVar = {
    owner: string;
    name: string;
    starCount: number;
    cursor: string;
};

const getStarSql = `
query getMoreStars($owner: String!, $name: String!, $starCount: Int, $cursor: String) {
    rateLimit {
        resetAt
        remaining
        cost
    }
    repository(owner: $owner, name: $name) {
        stargazers(first: $starCount, orderBy: {field: STARRED_AT, direction: DESC}, after: $cursor) {
            pageInfo {
                hasNextPage
                endCursor
            }
            edges {
                starredAt
                node {
                    login
                }
            }
        }
    }
}
`;
