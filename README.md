<img src="https://raw.githubusercontent.com/Badstu/pic_set/master/img/20191019163227.png" height="120" align="left"/>

---

# description

`data-cat` is a module for fetcher the graphql data from github, with the structural data as return.

# demo

```typescript
import { DataCat } from "data-cat"

async function test_data_cat() {
  let data_cat = new DataCat({
    tokens: ["xxx", "xxx"],
  });
  await data_cat.init();

  let repos = await data_cat.org.repos("Badstu");
  return repos;
}

console.log(test_data_cat());
```
# docs

```typescript
org{
  repos: (login: string, updatedAfter?: Date) => Promise<Repo[]>
};

RepoPoxy {
  info: (owner: string, name: string) => Promise<Repo>;
  stars: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
  forks: (owner: string, name: string, updatedAfter?: Date) => Promise<UserWithTimeStamp[]>;
  issues: (owner: string, name: string, updatedAfter?: Date) => Promise<Issue[]>;
  pulls: (owner: string, name: string, updatedAfter?: Date) => Promise<PullRequest[]>;
  contributors: (owner: string, name: string, branch: string, commitLimit?: number) => Promise<UserWithTimeStampAndEmail[]>;
  full: (owner: string, name: string, param?: RepoFullParam, updatedAfter?: Date) => Promise<Repo>;
}
```