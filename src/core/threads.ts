import { join } from "node:path";
import { reddit } from "../client.js";
import { atomicWrite, threadDirectory } from "../files.js";
import { toYaml } from "../format.js";
import {
  type RawPost, type RawComment, type RawMoreStub, type RawListing,
  type CommentsResponse, type Comment, toPostFull, extractPostId, normalizeCommentId, RedditError,
} from "../types.js";

export type CommentSort = "best" | "top" | "new" | "controversial" | "old" | "qa";

function parseCommentTree(
  children: Array<{ kind: string; data: RawComment | RawMoreStub }>,
  depth = 0,
): { items: Comment[]; moreCount: number } {
  const items: Comment[] = [];
  let moreCount = 0;
  for (const child of children) {
    if (child.kind === "more") {
      moreCount += (child.data as RawMoreStub).count;
      continue;
    }
    const raw = child.data as RawComment;
    const replies = raw.replies === "" || !raw.replies
      ? { items: [], moreCount: 0 }
      : parseCommentTree((raw.replies as RawListing<RawComment | RawMoreStub>).data.children, depth + 1);
    items.push({
      id: raw.id,
      author: raw.author,
      body: raw.body,
      score: raw.score,
      created: new Date(raw.created_utc * 1000).toISOString(),
      edited: raw.edited === false ? null : new Date(raw.edited * 1000).toISOString(),
      depth,
      replies: replies.items,
      more_replies: replies.moreCount,
    });
  }
  return { items, moreCount };
}

function countComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

export function containsComment(comments: Comment[], id: string): boolean {
  return comments.some((comment) => comment.id === id || containsComment(comment.replies, id));
}

function postMarkdown(post: ReturnType<typeof toPostFull>): string {
  const links = [
    `Reddit: ${post.permalink}`,
    ...(post.external_url !== post.permalink ? [`External link: ${post.external_url}`] : []),
  ];
  return `# ${post.title}\n\n${links.join("\n")}\n\n${post.body || "(No text body.)"}\n`;
}

export async function getThread(
  value: string,
  args: { commentSort?: CommentSort; commentId?: string } = {},
): Promise<unknown> {
  const id = extractPostId(value);
  const sort = args.commentSort ?? "best";
  const commentId = args.commentId ? normalizeCommentId(args.commentId) : undefined;
  const response = await reddit.get<CommentsResponse>(`/comments/${id}.json`, {
    sort,
    limit: 500,
    depth: 10,
    ...(commentId ? { comment: commentId } : {}),
  });
  const rawPost = response[0].data.children[0]?.data as RawPost | undefined;
  if (!rawPost) throw new RedditError("NOT_FOUND", `Post not found: ${value}`);
  const post = toPostFull(rawPost);
  const parsed = parseCommentTree(response[1].data.children);
  if (commentId && !containsComment(parsed.items, commentId)) {
    throw new RedditError("NOT_FOUND", `Comment not found in post ${id}: ${commentId}`);
  }
  const commentsSaved = countComments(parsed.items);
  const directory = threadDirectory(id);
  const postPath = join(directory, "post.md");
  const selection = `${commentId ? `${commentId}-` : ""}${sort}`;
  const commentsPath = join(directory, `comments-${selection}.yml`);
  await Promise.all([
    atomicWrite(postPath, postMarkdown(post)),
    atomicWrite(commentsPath, toYaml({
      post_id: id,
      sort,
      ...(commentId ? { comment_id: commentId } : {}),
      comments_saved: commentsSaved,
      total_comments: post.num_comments,
      more_count: parsed.moreCount,
      comments: parsed.items,
    })),
  ]);
  return {
    id: post.id,
    title: post.title,
    subreddit: post.subreddit,
    author: post.author,
    score: post.score,
    comments_saved: commentsSaved,
    total_comments: post.num_comments,
    created: post.created,
    url: post.permalink,
    comment_selection: { sort, ...(commentId ? { comment_id: commentId } : {}) },
    files: { post: postPath, comments: commentsPath },
  };
}
