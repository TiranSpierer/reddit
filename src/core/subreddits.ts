import { join } from "node:path";
import { decode } from "html-entities";
import { reddit } from "../client.js";
import { atomicWrite, subredditDirectory } from "../files.js";
import { toYaml } from "../format.js";
import {
  type RawPost, type RawSubreddit, type RawListing, type RawRulesResponse,
  type PostSummary, type SubredditSummary, toPostSummary, toSubredditSummary,
  normalizeSubreddit, normalizeSubredditType, RedditError,
} from "../types.js";
import type { TimeWindow } from "./search.js";

export interface PageArgs { limit?: number; after?: string }

export async function findSubreddits(query: string, args: PageArgs = {}): Promise<{ subreddits: SubredditSummary[]; after: string | null }> {
  const data = await reddit.get<RawListing<RawSubreddit>>("/subreddits/search.json", {
    q: query, limit: args.limit ?? 25, after: args.after,
  });
  return {
    subreddits: data.data.children.filter((child) => child.kind === "t5").map((child) => toSubredditSummary(child.data)),
    after: data.data.after,
  };
}

export async function subredditInfo(subreddit: string): Promise<unknown> {
  const name = normalizeSubreddit(subreddit);
  const about = await reddit.get<{ kind: string; data: RawSubreddit }>(`/r/${name}/about.json`);
  if ((about.data as unknown as Record<string, unknown>).quarantine === true) {
    throw new RedditError("SUBREDDIT_QUARANTINED", `r/${name} is quarantined`);
  }
  const rules = await reddit.get<RawRulesResponse>(`/r/${name}/about/rules.json`);
  const directory = subredditDirectory(about.data.display_name);
  const sidebarPath = join(directory, "sidebar.md");
  const rulesPath = join(directory, "rules.yml");
  await Promise.all([
    atomicWrite(sidebarPath, `${about.data.description.trim()}\n`),
    atomicWrite(rulesPath, toYaml((rules.rules ?? []).map((rule) => ({
      name: rule.short_name, description: rule.description,
    })))),
  ]);
  return {
    name: about.data.display_name,
    display_name: `r/${about.data.display_name}`,
    title: decode(about.data.title),
    description: decode(about.data.public_description),
    subscribers: about.data.subscribers,
    active_users: about.data.active_user_count,
    created: new Date(about.data.created_utc * 1000).toISOString(),
    type: normalizeSubredditType(about.data.subreddit_type),
    nsfw: about.data.over18,
    url: `https://www.reddit.com${about.data.url}`,
    files: { sidebar: sidebarPath, rules: rulesPath },
  };
}

export type FeedSort = "hot" | "new" | "top" | "rising" | "controversial";

export async function subredditPosts(subreddit: string, args: PageArgs & { sort?: FeedSort; time?: TimeWindow } = {}): Promise<{ posts: PostSummary[]; after: string | null }> {
  const name = normalizeSubreddit(subreddit);
  const sort = args.sort ?? "hot";
  const data = await reddit.get<RawListing<RawPost>>(`/r/${name}/${sort}.json`, {
    t: args.time ?? "day", limit: args.limit ?? 25, after: args.after,
  });
  return {
    posts: data.data.children.filter((child) => child.kind === "t3").map((child) => toPostSummary(child.data)),
    after: data.data.after,
  };
}
