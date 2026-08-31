#!/usr/bin/env node
import { Command, Option } from "commander";
import { searchReddit, searchSubreddit, type SearchSort, type TimeWindow } from "./core/search.js";
import { findSubreddits, subredditInfo, subredditPosts, type FeedSort } from "./core/subreddits.js";
import { getThread, type CommentSort } from "./core/threads.js";
import { toYaml } from "./format.js";
import { RedditError } from "./types.js";

const SEARCH_SORTS = ["relevance", "hot", "top", "new", "comments"] as const;
const FEED_SORTS = ["hot", "new", "top", "rising", "controversial"] as const;
const COMMENT_SORTS = ["best", "top", "new", "controversial", "old", "qa"] as const;
const TIMES = ["hour", "day", "week", "month", "year", "all"] as const;

function bounded(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new Error("limit must be an integer from 1 to 100");
  return number;
}

function addDebug(command: Command): Command {
  return command.option("--debug", "print the untouched failed HTTP response body to stdout");
}

function addPaging(command: Command): Command {
  return command
    .option("--limit <number>", "maximum results", bounded, 25)
    .option("--after <cursor>", "pagination cursor from a previous response");
}

function addSearchSelection(command: Command): Command {
  return command
    .addOption(new Option("--sort <order>", "result order").choices([...SEARCH_SORTS]).default("relevance"))
    .addOption(new Option("--time <window>", "time window").choices([...TIMES]).default("all"));
}

async function output(command: Command, work: () => Promise<unknown>): Promise<void> {
  try {
    process.stdout.write(toYaml(await work()));
  } catch (error) {
    if (command.optsWithGlobals().debug && error instanceof RedditError && error.debugResponse) {
      process.stdout.write(error.debugResponse.body);
    }
    throw error;
  }
}

export function buildProgram(): Command {
  const program = addDebug(new Command()
    .name("reddit-cli")
    .description("Search and read Reddit discussions.")
    .version("1.0.0")
    .showHelpAfterError());

  const globalSearch = addDebug(addPaging(addSearchSelection(program.command("search")
    .description("Search posts across Reddit.")
    .argument("<query>", "search query"))));
  globalSearch.action((query: string, options, command: Command) => output(command, () => searchReddit({
    query,
    sort: options.sort as SearchSort,
    time: options.time as TimeWindow,
    limit: options.limit,
    after: options.after,
  })));

  const subreddit = addDebug(program.command("subreddit").description("Find and inspect Reddit communities."));
  subreddit.action(() => subreddit.help());

  const find = addDebug(addPaging(subreddit.command("find")
    .description("Find subreddits by name or topic.")
    .argument("<query>", "community search query")));
  find.action((query: string, options, command: Command) => output(command, () => findSubreddits(query, options)));

  const info = addDebug(subreddit.command("info")
    .description("Show subreddit metadata and save its sidebar and rules.")
    .argument("<subreddit>", "subreddit name, with or without r/"));
  info.action((name: string, _options, command: Command) => output(command, () => subredditInfo(name)));

  const posts = addDebug(addPaging(subreddit.command("posts")
    .description("Browse a subreddit feed.")
    .argument("<subreddit>", "subreddit name, with or without r/")
    .addOption(new Option("--sort <order>", "feed order").choices([...FEED_SORTS]).default("hot"))
    .addOption(new Option("--time <window>", "time window for top or controversial").choices([...TIMES]).default("day"))));
  posts.action((name: string, options, command: Command) => output(command, () => subredditPosts(name, {
    sort: options.sort as FeedSort,
    time: options.time as TimeWindow,
    limit: options.limit,
    after: options.after,
  })));

  const subredditSearch = addDebug(addPaging(addSearchSelection(subreddit.command("search")
    .description("Search posts within a subreddit.")
    .argument("<subreddit>", "subreddit name, with or without r/")
    .argument("<query>", "search query"))));
  subredditSearch.action((name: string, query: string, options, command: Command) => output(command, () => searchSubreddit(name, {
    query,
    sort: options.sort as SearchSort,
    time: options.time as TimeWindow,
    limit: options.limit,
    after: options.after,
  })));

  const thread = addDebug(program.command("thread")
    .description("Save a Reddit post and its comment discussion.")
    .argument("<post>", "post ID, t3_ fullname, or Reddit URL")
    .addOption(new Option("--comment-sort <order>", "comment order").choices([...COMMENT_SORTS]).default("best"))
    .option("--comment <id>", "save only a focused comment subtree"));
  thread.addHelpText("after", "\nSaves post.md and the selected comments to the OS temporary directory. By default requests Reddit's fullest practical comment tree.\n");
  thread.action((value: string, options, command: Command) => output(command, () => getThread(value, {
    commentSort: options.commentSort as CommentSort,
    commentId: options.comment,
  })));

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  try {
    const program = buildProgram();
    if (argv.length <= 2) program.help();
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof RedditError) process.stderr.write(`Error: ${error.code}: ${error.message}\n`);
    else process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

void main();
