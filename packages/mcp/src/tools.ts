import { z } from "zod";
import {
  findSubreddits, getThread, searchReddit, searchSubreddit,
  subredditInfo, subredditPosts,
} from "@tiranspierer/reddit-core";
import { presentListing, presentSubredditInfo, presentSubreddits, presentThread, toYaml } from "@tiranspierer/reddit-output";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: any) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

const wrap = (handler: (args: any) => Promise<unknown>) => async (args: any) => ({
  content: [{ type: "text" as const, text: toYaml(await handler(args)) }],
});
const ranking = z.enum(["relevance", "hot", "top", "new", "comments"]);
const window = z.enum(["hour", "day", "week", "month", "year", "all"]);
const limit = z.coerce.number().int().min(1).max(100).optional().describe("Number of results (default: 25)");
const after = z.string().optional().describe("Pagination cursor from a previous response");

export const tools: ToolDefinition[] = [
  {
    name: "search_reddit",
    description: "Search posts across all of Reddit.",
    schema: z.object({
      query: z.string().describe("Search query string"),
      sort: ranking.optional().describe("Ranking method (default: relevance)"),
      time: window.optional().describe("Time window (default: all)"), limit, after,
    }),
    handler: wrap(async (args) => presentListing(await searchReddit(args))),
  },
  {
    name: "search_subreddits",
    description: "Search for subreddits by name or topic.",
    schema: z.object({ query: z.string().describe("Search query"), limit, after }),
    handler: wrap(async ({ query, ...args }) => presentSubreddits(await findSubreddits(query, args))),
  },
  {
    name: "get_subreddit_info",
    description: "Get metadata and save the sidebar and rules for a subreddit.",
    schema: z.object({ subreddit: z.string().describe("Subreddit name, with or without r/ prefix") }),
    handler: wrap(async ({ subreddit }) => presentSubredditInfo(await subredditInfo(subreddit))),
  },
  {
    name: "get_subreddit_posts",
    description: "Browse the posts feed of a subreddit.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name"),
      sort: z.enum(["hot", "new", "top", "rising", "controversial"]).optional().describe("Feed type (default: hot)"),
      time: window.optional().describe("Time window (default: day)"), limit, after,
    }),
    handler: wrap(async ({ subreddit, ...args }) => presentListing(await subredditPosts(subreddit, args))),
  },
  {
    name: "search_subreddit_posts",
    description: "Search posts within a specific subreddit.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit to restrict search to"),
      query: z.string().describe("Search query"),
      sort: ranking.optional().describe("Ranking method (default: relevance)"),
      time: window.optional().describe("Time window (default: all)"), limit, after,
    }),
    handler: wrap(async ({ subreddit, ...args }) => presentListing(await searchSubreddit(subreddit, args))),
  },
  {
    name: "get_post",
    description: "Save a Reddit post and its selected comment discussion.",
    schema: z.object({
      post_id: z.string().describe("Post ID, t3_ fullname, or full Reddit permalink URL"),
      include_comments: z.boolean().optional().describe("Include comments (default: true)"),
      comment_sort: z.enum(["best", "top", "new", "controversial", "old", "qa"]).optional().describe("Comment sort order (default: best)"),
      comment_limit: z.coerce.number().int().min(1).max(100).optional().describe("Maximum top-level comments (default: 20)"),
      comment_depth: z.coerce.number().int().min(1).max(10).optional().describe("Maximum reply nesting depth (default: 3)"),
      comment_id: z.string().optional().describe("Return only this comment subtree"),
    }),
    handler: wrap(async (args) => presentThread(await getThread(args.post_id, {
      includeComments: args.include_comments,
      commentSort: args.comment_sort,
      commentLimit: args.comment_limit ?? 20,
      commentDepth: args.comment_depth ?? 3,
      commentId: args.comment_id,
    }))),
  },
];
