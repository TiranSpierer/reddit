import { join } from "node:path";
import type { Comment, PostSummary, SubredditFull, ThreadResult } from "@tiranspierer/reddit-core";
import { atomicWrite, subredditDirectory, threadDirectory } from "./files.js";
import { toYaml } from "./format.js";

function iso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

export function presentListing<T extends { posts: PostSummary[]; after: string | null }>(result: T): unknown {
  return {
    ...result,
    posts: result.posts.map((post) => ({
      ...post,
      created: iso(post.created_utc),
      created_utc: undefined,
    })),
  };
}

export async function presentSubredditInfo(info: SubredditFull): Promise<unknown> {
  const directory = subredditDirectory(info.name);
  const sidebarPath = join(directory, "sidebar.md");
  const rulesPath = join(directory, "rules.yml");
  await Promise.all([
    atomicWrite(sidebarPath, `${info.description_long.trim()}\n`),
    atomicWrite(rulesPath, toYaml(info.rules.map((rule) => ({ name: rule.short_name, description: rule.description })))),
  ]);
  return {
    name: info.name,
    display_name: info.display_name,
    title: info.title,
    description: info.description,
    subscribers: info.subscribers,
    active_users: info.active_users,
    created: iso(info.created_utc),
    type: info.type,
    nsfw: info.nsfw,
    url: info.url,
    files: { sidebar: sidebarPath, rules: rulesPath },
  };
}

function presentComment(comment: Comment): unknown {
  return {
    ...comment,
    created: iso(comment.created_utc),
    created_utc: undefined,
    edited: comment.edited_utc === null ? null : iso(comment.edited_utc),
    edited_utc: undefined,
    replies: comment.replies.map(presentComment),
  };
}

function postMarkdown(result: ThreadResult): string {
  const { post } = result;
  const links = [
    `Reddit: ${post.permalink}`,
    ...(post.external_url !== post.permalink ? [`External link: ${post.external_url}`] : []),
  ];
  return `# ${post.title}\n\n${links.join("\n")}\n\n${post.body || "(No text body.)"}\n`;
}

export async function presentThread(result: ThreadResult): Promise<unknown> {
  const { post } = result;
  const directory = threadDirectory(post.id);
  const postPath = join(directory, "post.md");
  const selection = [
    result.commentId,
    result.sort,
    result.commentLimit ? `limit${result.commentLimit}` : undefined,
    result.commentDepth ? `depth${result.commentDepth}` : undefined,
  ].filter(Boolean).join("-");
  const commentsPath = join(directory, `comments-${selection}.yml`);
  const writes = [atomicWrite(postPath, postMarkdown(result))];
  if (result.includeComments) {
    writes.push(atomicWrite(commentsPath, toYaml({
      post_id: post.id,
      sort: result.sort,
      ...(result.commentId ? { comment_id: result.commentId } : {}),
      ...(result.commentLimit ? { top_level_limit: result.commentLimit } : {}),
      ...(result.commentDepth ? { depth: result.commentDepth } : {}),
      comments_saved: result.commentsSaved,
      total_comments: post.num_comments,
      more_count: result.moreCount,
      comments: result.comments.map(presentComment),
    })));
  }
  await Promise.all(writes);
  return {
    id: post.id,
    title: post.title,
    subreddit: post.subreddit,
    author: post.author,
    score: post.score,
    ...(result.includeComments ? { comments_saved: result.commentsSaved, total_comments: post.num_comments } : {}),
    created: iso(post.created_utc),
    url: post.permalink,
    comment_selection: {
      sort: result.sort,
      ...(result.commentId ? { comment_id: result.commentId } : {}),
      ...(result.commentLimit ? { top_level_limit: result.commentLimit } : {}),
      ...(result.commentDepth ? { depth: result.commentDepth } : {}),
    },
    files: { post: postPath, ...(result.includeComments ? { comments: commentsPath } : {}) },
  };
}
