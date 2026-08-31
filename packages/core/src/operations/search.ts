import { reddit } from "../client.js";
import { type RawPost, type RawListing, type PostSummary, toPostSummary, normalizeSubreddit } from "../types.js";

export type SearchSort = "relevance" | "hot" | "top" | "new" | "comments";
export type TimeWindow = "hour" | "day" | "week" | "month" | "year" | "all";

export interface SearchArgs {
  query: string;
  sort?: SearchSort;
  time?: TimeWindow;
  limit?: number;
  after?: string;
}

export interface SearchResult {
  posts: PostSummary[];
  after: string | null;
}

async function search(path: string, args: SearchArgs, restrict = false): Promise<SearchResult> {
  const data = await reddit.get<RawListing<RawPost>>(path, {
    q: args.query,
    ...(restrict ? { restrict_sr: 1 } : {}),
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
    limit: args.limit ?? 25,
    after: args.after,
  });
  return {
    posts: data.data.children.filter((child) => child.kind === "t3").map((child) => toPostSummary(child.data)),
    after: data.data.after,
  };
}

export function searchReddit(args: SearchArgs): Promise<SearchResult> {
  return search("/search.json", args);
}

export function searchSubreddit(subreddit: string, args: SearchArgs): Promise<SearchResult> {
  return search(`/r/${normalizeSubreddit(subreddit)}/search.json`, args, true);
}
