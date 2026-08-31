import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { containsComment, extractPostId, normalizeCommentId, normalizeSubreddit, toPostSummary } from "../packages/core/dist/index.js";
import { presentListing } from "../packages/output/dist/index.js";

function cli(...args) {
  return spawnSync(process.execPath, ["packages/cli/dist/cli.js", ...args], { encoding: "utf8" });
}

test("top-level help exposes the resource-oriented CLI", () => {
  const result = cli("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /search \[options\] <query>/);
  assert.match(result.stdout, /subreddit \[options\]/);
  assert.match(result.stdout, /thread \[options\] <post>/);
  assert.doesNotMatch(result.stdout, /get-post|search-reddit|challenge/);
});

test("thread help has deterministic files and no output-suppression flags", () => {
  const result = cli("thread", "--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /fullest practical comment tree/);
  assert.match(result.stdout, /--comment-sort/);
  assert.match(result.stdout, /--comment <id>/);
  assert.doesNotMatch(result.stdout, /comment-limit|comment-depth|include-comments|no-comments/);
});

test("Commander validates choices concisely", () => {
  const result = cli("search", "test", "--sort", "invalid");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Allowed choices are relevance, hot, top, new, comments/);
  assert.doesNotMatch(result.stderr, /invalid_value|Zod/);
});

test("Reddit identifiers normalize", () => {
  assert.equal(normalizeSubreddit("r/node"), "node");
  assert.equal(extractPostId("t3_abc123"), "abc123");
  assert.equal(extractPostId("https://www.reddit.com/r/node/comments/abc123/title/"), "abc123");
  assert.equal(normalizeCommentId("t1_def456"), "def456");
  assert.throws(() => extractPostId("../../bad"), /post must be/);
  assert.throws(() => normalizeSubreddit("../../bad"), /subreddit must be/);
});

test("post summaries use readable timestamps", () => {
  const summary = toPostSummary({
    id: "abc", name: "t3_abc", title: "Title &amp; details", subreddit: "node",
    permalink: "/r/node/comments/abc/title/", url: "/r/node/comments/abc/title/",
    author: "person", score: 1, upvote_ratio: 1, num_comments: 2,
    created_utc: 0, edited: false, link_flair_text: null, over_18: false,
    spoiler: false, locked: false, archived: false, is_self: true, is_video: false,
    selftext: "Body", all_awardings: [],
  });
  assert.equal(summary.title, "Title & details");
  const presented = presentListing({ posts: [summary], after: null });
  assert.equal(presented.posts[0].created, "1970-01-01T00:00:00.000Z");
});

test("focused comment validation searches nested replies", () => {
  const comment = (id, replies = []) => ({ id, replies });
  assert.equal(containsComment([comment("a", [comment("b")])], "b"), true);
  assert.equal(containsComment([comment("a")], "missing"), false);
});
