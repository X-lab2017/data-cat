import { getContributors } from "../structer/contributors"

const graphql = require("@octokit/graphql");
const waitFor = require("p-wait-for");
import Logger = require('bunyan')
import { GitHubClient } from "github-graphql-v4-client";
import { getRepo } from "../structer/repos"

let client = new GitHubClient({
  tokens: ["screat123"],
  maxConcurrentReqNumber: 20,
  maxRetryTimes: 5,
  filterStatusCode: [400, 403],
  logger: Logger.createLogger({
    name: "My-Own-Client",
    level: Logger.ERROR
  })
});
async function data_cat() {
  await client.init();

  let owner: string = "Badstu";
  let name: string = "UDA_CV";

  let Repo = await getRepo(owner, name, client);
  console.log(Repo);
}

data_cat();

