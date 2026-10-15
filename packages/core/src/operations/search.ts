import { reddit } from "../client.js";
import { type PostSummary, normalizeSubreddit } from "../types.js";
import { parseSearchPage } from "../parser.js";

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
  const html = await reddit.getHtml(path, {
    q: args.query,
    ...(restrict ? { restrict_sr: 1 } : {}),
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
    type: "link",
  });
  const result = parseSearchPage(html);
  const limit = args.limit ?? 25;
  return {
    posts: result.posts.slice(0, limit),
    after: result.after,
  };
}

export function searchReddit(args: SearchArgs): Promise<SearchResult> {
  return search("/search/", args);
}

export function searchSubreddit(subreddit: string, args: SearchArgs): Promise<SearchResult> {
  return search(`/r/${normalizeSubreddit(subreddit)}/search/`, args, true);
}
