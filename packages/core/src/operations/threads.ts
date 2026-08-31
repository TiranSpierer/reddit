import { reddit } from "../client.js";
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
      created_utc: raw.created_utc,
      edited_utc: raw.edited === false ? null : raw.edited,
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

export interface ThreadResult {
  post: ReturnType<typeof toPostFull>;
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
  const response = await reddit.get<CommentsResponse>(`/comments/${id}.json`, {
    sort,
    limit: includeComments ? (args.commentLimit ?? 500) : 0,
    depth: args.commentDepth ?? 10,
    ...(commentId ? { comment: commentId } : {}),
  });
  const rawPost = response[0].data.children[0]?.data as RawPost | undefined;
  if (!rawPost) throw new RedditError("NOT_FOUND", `Post not found: ${value}`);
  const post = toPostFull(rawPost);
  const parsed = includeComments ? parseCommentTree(response[1].data.children) : { items: [], moreCount: 0 };
  if (commentId && !containsComment(parsed.items, commentId)) {
    throw new RedditError("NOT_FOUND", `Comment not found in post ${id}: ${commentId}`);
  }
  return {
    post,
    comments: parsed.items,
    commentsSaved: countComments(parsed.items),
    moreCount: parsed.moreCount,
    sort,
    includeComments,
    ...(commentId ? { commentId } : {}),
    ...(args.commentLimit ? { commentLimit: args.commentLimit } : {}),
    ...(args.commentDepth ? { commentDepth: args.commentDepth } : {}),
  };
}
