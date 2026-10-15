import { reddit } from "../client.js";
import { type Comment, RedditError, extractPostId, normalizeCommentId } from "../types.js";
import { parsePostPage } from "../parser.js";
import type { PostFull } from "../types.js";

export type CommentSort = "best" | "top" | "new" | "controversial" | "old" | "qa";

function countComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

export function containsComment(comments: Comment[], id: string): boolean {
  return comments.some((comment) => comment.id === id || containsComment(comment.replies, id));
}

export interface ThreadResult {
  post: PostFull;
  comments: Comment[];
  commentsSaved: number;
  moreCount: number;
  sort: CommentSort;
  commentId?: string;
  includeComments: boolean;
  commentLimit?: number;
  commentDepth?: number;
}

export async function getThread(
  value: string,
  args: { includeComments?: boolean; commentSort?: CommentSort; commentId?: string; commentLimit?: number; commentDepth?: number } = {},
): Promise<ThreadResult> {
  const id = extractPostId(value);
  const sort = args.commentSort ?? "best";
  const includeComments = args.includeComments !== false;
  const commentId = args.commentId ? normalizeCommentId(args.commentId) : undefined;

  const html = await reddit.getHtml(`/comments/${id}/`, { sort });
  let { post, comments } = parsePostPage(html);

  if (!post.id) throw new RedditError("NOT_FOUND", `Post not found: ${value}`);

  if (commentId && !containsComment(comments, commentId)) {
    const focusedPath = post.permalink.replace("https://www.reddit.com", "") + commentId + "/";
    const focusedHtml = await reddit.getHtml(focusedPath, { sort, context: 3 });
    const focused = parsePostPage(focusedHtml);
    comments = focused.comments;
    if (!containsComment(comments, commentId)) {
      throw new RedditError("NOT_FOUND", `Comment not found in post ${id}: ${commentId}`);
    }
  }

  const commentsSaved = countComments(comments);

  return {
    post,
    comments: includeComments ? comments : [],
    commentsSaved: includeComments ? commentsSaved : 0,
    moreCount: Math.max(0, post.num_comments - commentsSaved),
    sort,
    includeComments,
    ...(commentId ? { commentId } : {}),
    ...(args.commentLimit ? { commentLimit: args.commentLimit } : {}),
    ...(args.commentDepth ? { commentDepth: args.commentDepth } : {}),
  };
}
