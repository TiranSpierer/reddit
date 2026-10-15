import * as cheerio from "cheerio";
import { decode } from "html-entities";
import type { PostSummary, Comment } from "./types.js";

function isoToEpoch(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms / 1000;
}

function stripId(fullname: string): string {
  return fullname.replace(/^t[0-9]_/, "");
}

export function parseCommentsHtml(html: string): { comments: Comment[] } {
  const $ = cheerio.load(html);
  const commentMap = new Map<string, Comment>();
  const roots: Comment[] = [];

  $("shreddit-comment").each((_, el) => {
    const $c = $(el);
    if ($c.attr("ad-type")) return;
    const thingId = $c.attr("thingid") || "";
    if (!thingId.startsWith("t1_")) return;
    const cId = stripId(thingId);
    const bodyEl = $(`[id="${thingId}-comment-rtjson-content"]`);
    const body = decode(bodyEl.text().trim());

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

  return { comments: roots };
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
