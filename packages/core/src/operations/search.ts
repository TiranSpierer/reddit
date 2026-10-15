import { reddit } from "../client.js";
import { type RawPost, type RawListing, type PostSummary, toPostSummary, normalizeSubreddit } from "../types.js";
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

export async function searchReddit(args: SearchArgs): Promise<SearchResult> {
  const html = await reddit.getHtml("/search/", {
    q: args.query,
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
    type: "link",
  });
  const result = parseSearchPage(html);
  return { posts: result.posts.slice(0, args.limit ?? 25), after: result.after };
}

export async function searchSubreddit(subreddit: string, args: SearchArgs): Promise<SearchResult> {
  const name = normalizeSubreddit(subreddit);
  const html = await reddit.getHtml(`/r/${name}/search/`, {
    q: args.query,
    restrict_sr: 1,
    sort: args.sort ?? "relevance",
    t: args.time ?? "all",
    type: "link",
  });
  const result = parseSearchPage(html);
  return { posts: result.posts.slice(0, args.limit ?? 25), after: result.after };
}
