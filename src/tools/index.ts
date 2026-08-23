import { z } from "zod";
import { searchReddit, searchSubredditPosts } from "./search.js";
import { searchSubreddits, getSubredditInfo, getSubredditPosts } from "./subreddits.js";
import { getPost } from "./posts.js";
import { reddit } from "../client.js";
import { toYaml, handleError } from "../format.js";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: any) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;
}

const wrap = (handler: (args: any) => Promise<unknown>) => async (args: any) => {
  try {
    return { content: [{ type: "text" as const, text: toYaml(await handler(args)) }] };
  } catch (error) {
    return handleError(error);
  }
};
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
      time: window.optional().describe("Time window (default: all)"),
      limit,
      after,
    }),
    handler: wrap(searchReddit),
  },
  {
    name: "search_subreddits",
    description: "Search for subreddits by name or topic.",
    schema: z.object({ query: z.string().describe("Search query"), limit, after }),
    handler: wrap(searchSubreddits),
  },
  {
    name: "get_subreddit_info",
    description: "Get metadata and rules for a subreddit.",
    schema: z.object({ subreddit: z.string().describe("Subreddit name, with or without r/ prefix") }),
    handler: wrap(getSubredditInfo),
  },
  {
    name: "get_subreddit_posts",
    description: "Browse the posts feed of a subreddit.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name"),
      sort: z.enum(["hot", "new", "top", "rising", "controversial"]).optional().describe("Feed type (default: hot)"),
      time: window.optional().describe("Time window (default: day)"),
      limit,
      after,
    }),
    handler: wrap(getSubredditPosts),
  },
  {
    name: "search_subreddit_posts",
    description: "Search posts within a specific subreddit.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit to restrict search to"),
      query: z.string().describe("Search query"),
      sort: ranking.optional().describe("Ranking method (default: relevance)"),
      time: window.optional().describe("Time window (default: all)"),
      limit,
      after,
    }),
    handler: wrap(searchSubredditPosts),
  },
  {
    name: "get_post",
    description: "Get a Reddit post's full content and comment tree.",
    schema: z.object({
      post_id: z.string().describe("Post ID, t3_ fullname, or full Reddit permalink URL"),
      include_comments: z.boolean().optional().describe("Include comments (default: true)"),
      comment_sort: z.enum(["best", "top", "new", "controversial", "old", "qa"]).optional().describe("Comment sort order (default: best)"),
      comment_limit: z.coerce.number().int().min(1).max(100).optional().describe("Maximum top-level comments (default: 20)"),
      comment_depth: z.coerce.number().int().min(1).max(10).optional().describe("Maximum reply nesting depth (default: 3)"),
      comment_id: z.string().optional().describe("Return only this comment subtree"),
    }),
    handler: wrap(getPost),
  },
];

if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
  tools.push({
    name: "solve_reddit_challenge",
    description: "Submit a solution only after another command returns CHALLENGE_REQUIRED.",
    schema: z.object({
      solution: z.string().describe("Computed challenge solution"),
      token: z.string().describe("Token from the challenge form"),
    }),
    handler: async ({ solution, token }) => {
      await reddit.submitChallengeSolution(solution, token);
      return { content: [{ type: "text", text: "Solution accepted. Retry the original command." }] };
    },
  });
}
