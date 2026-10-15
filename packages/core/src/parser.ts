import * as cheerio from "cheerio";
import { decode } from "html-entities";
import type { PostSummary, PostFull, Comment, SubredditFull, SubredditSummary } from "./types.js";
import { postPreview } from "./types.js";

type $ = cheerio.CheerioAPI;

function isoToEpoch(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms / 1000;
}

function stripId(fullname: string): string {
  return fullname.replace(/^t[0-9]_/, "");
}

function cleanText(html: string): string {
  return decode(html).trim();
}

function parseScreenviewData($: $): Record<string, unknown> {
  try {
    const raw = $("shreddit-screenview-data").attr("data");
    return raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch { return {}; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPostSummary($: $, el: any): PostSummary | null {
  const $el = $(el);
  const title = $el.attr("post-title");
  if (!title || $el.attr("ad-type")) return null;
  const fullId = $el.attr("id") || "";
  const id = stripId(fullId);
  const permalink = $el.attr("permalink") || "";
  const base = "https://www.reddit.com";
  const isSelf = ($el.attr("post-type") || "").includes("text") || ($el.attr("domain") || "").startsWith("self.");
  const selftext = $(`[id="${fullId}-post-rtjson-content"]`).text().trim();
  return {
    id,
    title: decode(title),
    subreddit: $el.attr("subreddit-name") || "",
    permalink: base + permalink,
    external_url: isSelf ? base + permalink : $el.attr("content-href") || base + permalink,
    author: $el.attr("author") || "[deleted]",
    score: Number($el.attr("score")) || 0,
    upvote_ratio: Number($el.attr("upvote-ratio")) || 0,
    num_comments: Number($el.attr("comment-count")) || 0,
    created_utc: isoToEpoch($el.attr("created-timestamp") || ""),
    flair: null,
    nsfw: false,
    locked: false,
    archived: false,
    body_snippet: isSelf ? postPreview(selftext) : "",
  };
}

export function parsePostPage(html: string): { post: PostFull; comments: Comment[] } {
  const $ = cheerio.load(html);
  const $post = $("shreddit-post").first();
  const fullId = $post.attr("id") || "";
  const id = stripId(fullId);
  const permalink = $post.attr("permalink") || "";
  const base = "https://www.reddit.com";
  const isSelf = ($post.attr("post-type") || "").includes("text") || ($post.attr("domain") || "").startsWith("self.");
  const selftext = $(`[id="${fullId}-post-rtjson-content"]`).text().trim();

  const svd = parseScreenviewData($) as { post?: { nsfw?: boolean } };

  const post: PostFull = {
    id,
    title: decode($post.attr("post-title") || ""),
    subreddit: $post.attr("subreddit-name") || "",
    permalink: base + permalink,
    external_url: isSelf ? base + permalink : $post.attr("content-href") || base + permalink,
    author: $post.attr("author") || "[deleted]",
    score: Number($post.attr("score")) || 0,
    upvote_ratio: Number($post.attr("upvote-ratio")) || 0,
    num_comments: Number($post.attr("comment-count")) || 0,
    created_utc: isoToEpoch($post.attr("created-timestamp") || ""),
    edited_utc: null,
    flair: null,
    nsfw: svd.post?.nsfw === true,
    locked: false,
    archived: false,
    is_video: ($post.attr("post-type") || "") === "video",
    body: cleanText(selftext),
    awards: [],
  };

  const commentMap = new Map<string, Comment>();
  const roots: Comment[] = [];

  $("shreddit-comment").each((_, el) => {
    const $c = $(el);
    if ($c.attr("ad-type")) return;
    const thingId = $c.attr("thingid") || "";
    if (!thingId.startsWith("t1_")) return;
    const cId = stripId(thingId);
    const bodyEl = $(`[id="${thingId}-comment-rtjson-content"]`);
    const body = cleanText(bodyEl.text());

    const comment: Comment = {
      id: cId,
      author: $c.attr("author") || "[deleted]",
      body,
      score: Number($c.attr("score")) || 0,
      created_utc: isoToEpoch($c.attr("created") || ""),
      edited_utc: null,
      depth: Number($c.attr("depth")) || 0,
      replies: [],
      more_replies: 0,
    };

    commentMap.set(thingId, comment);
    const parentId = $c.attr("parentid") || "";
    if (parentId && commentMap.has(parentId)) {
      commentMap.get(parentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return { post, comments: roots };
}

export function parseFeedPage(html: string): { posts: PostSummary[]; after: string | null } {
  const $ = cheerio.load(html);
  const posts: PostSummary[] = [];
  $("shreddit-post").each((_, el) => {
    const summary = extractPostSummary($, el);
    if (summary) posts.push(summary);
  });

  let after: string | null = null;
  $("faceplate-partial").each((_, el) => {
    const src = $(el).attr("src") || "";
    const match = src.match(/[?&]after=([^&]+)/);
    if (match) after = decodeURIComponent(match[1]);
  });

  return { posts, after };
}

export function parseSearchPage(html: string): { posts: PostSummary[]; after: string | null } {
  const $ = cheerio.load(html);
  const posts: PostSummary[] = [];
  const seen = new Set<string>();

  $('a[data-testid="post-title"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href") || "";
    const match = href.match(/\/r\/(\w+)\/comments\/(\w+)\//);
    if (!match) return;
    const [, subreddit, id] = match;
    if (seen.has(id)) return;
    seen.add(id);

    const title = $a.attr("aria-label") || $a.text().trim();
    const row = $a.closest("div").parent();

    let score = 0;
    let numComments = 0;
    row.find("faceplate-number").each((_, numEl) => {
      const n = Number($(numEl).attr("number")) || 0;
      const label = $(numEl).parent().text().trim().toLowerCase();
      if (label.includes("vote")) score = n;
      else if (label.includes("comment")) numComments = n;
    });

    const ts = row.find("faceplate-timeago").attr("ts") || "";

    posts.push({
      id,
      title: decode(title),
      subreddit,
      permalink: `https://www.reddit.com${href}`,
      external_url: `https://www.reddit.com${href}`,
      author: "",
      score,
      upvote_ratio: 0,
      num_comments: numComments,
      created_utc: isoToEpoch(ts),
      flair: null,
      nsfw: false,
      locked: false,
      archived: false,
      body_snippet: "",
    });
  });

  let after: string | null = null;
  $("faceplate-partial").each((_, el) => {
    const src = $(el).attr("src") || "";
    const match = src.match(/[?&]after=([^&]+)/);
    if (match) after = decodeURIComponent(match[1]);
  });

  return { posts, after };
}

export function parseSubredditPage(html: string): SubredditFull {
  const $ = cheerio.load(html);
  const $header = $("shreddit-subreddit-header").first();
  const name = $header.attr("name") || "";

  return {
    name,
    display_name: `r/${name}`,
    title: decode($header.attr("display-name") || name),
    description: decode($header.attr("description") || ""),
    description_long: decode($header.attr("description") || ""),
    subscribers: 0,
    active_users: Number($header.attr("weekly-active-users")) || 0,
    created_utc: 0,
    type: "public",
    nsfw: false,
    url: `https://www.reddit.com/r/${name}/`,
    rules: [],
  };
}

export function parseSubredditSearch(html: string): { subreddits: SubredditSummary[]; after: string | null } {
  const $ = cheerio.load(html);
  const subreddits: SubredditSummary[] = [];

  $("a[href]").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href") || "";
    const match = href.match(/^\/r\/(\w+)\/?$/);
    if (!match) return;
    const name = match[1];
    const container = $a.closest("[data-faceplate-tracking-context]");
    const desc = container.find("[description]").attr("description") || "";
    const members = container.find("faceplate-number").first().attr("number") || "0";

    subreddits.push({
      name,
      display_name: `r/${name}`,
      title: name,
      description: decode(desc),
      subscribers: Number(members) || 0,
      active_users: 0,
      type: "public",
      nsfw: false,
    });
  });

  let after: string | null = null;
  $("faceplate-partial").each((_, el) => {
    const src = $(el).attr("src") || "";
    const match = src.match(/[?&]after=([^&]+)/);
    if (match) after = decodeURIComponent(match[1]);
  });

  return { subreddits, after };
}
