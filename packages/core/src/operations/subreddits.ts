import { decode } from "html-entities";
import { reddit } from "../client.js";
import {
  type PostSummary, type SubredditSummary, type SubredditFull,
  normalizeSubreddit, RedditError,
} from "../types.js";
import { parseFeedPage, parseSubredditPage, parseSubredditSearch } from "../parser.js";
import type { TimeWindow } from "./search.js";

export interface PageArgs { limit?: number; after?: string }

export async function findSubreddits(query: string, args: PageArgs = {}): Promise<{ subreddits: SubredditSummary[]; after: string | null }> {
  const html = await reddit.getHtml("/search/", { q: query, type: "sr" });
  const result = parseSubredditSearch(html);
  const limit = args.limit ?? 25;
  return { subreddits: result.subreddits.slice(0, limit), after: result.after };
}

export async function subredditInfo(subreddit: string): Promise<SubredditFull> {
  const name = normalizeSubreddit(subreddit);
  const html = await reddit.getHtml(`/r/${name}/`);
  const info = parseSubredditPage(html);
  if (!info.name) throw new RedditError("NOT_FOUND", `Subreddit not found: r/${name}`);
  return info;
}

export type FeedSort = "hot" | "new" | "top" | "rising" | "controversial";

export async function subredditPosts(subreddit: string, args: PageArgs & { sort?: FeedSort; time?: TimeWindow } = {}): Promise<{ posts: PostSummary[]; after: string | null }> {
  const name = normalizeSubreddit(subreddit);
  const sort = args.sort ?? "hot";
  const html = await reddit.getHtml(`/r/${name}/${sort}/`, { t: args.time ?? "day" });
  const result = parseFeedPage(html);
  const limit = args.limit ?? 25;
  return { posts: result.posts.slice(0, limit), after: result.after };
}
