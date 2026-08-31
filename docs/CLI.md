# CLI reference

## Global search

```text
reddit-cli search <query>
  --sort relevance|hot|top|new|comments
  --time hour|day|week|month|year|all
  --limit 1..100
  --after <cursor>
  --debug
```

## Subreddits

```text
reddit-cli subreddit find <query>
  --limit 1..100
  --after <cursor>
  --debug

reddit-cli subreddit info <subreddit>
  --debug

reddit-cli subreddit posts <subreddit>
  --sort hot|new|top|rising|controversial
  --time hour|day|week|month|year|all
  --limit 1..100
  --after <cursor>
  --debug

reddit-cli subreddit search <subreddit> <query>
  --sort relevance|hot|top|new|comments
  --time hour|day|week|month|year|all
  --limit 1..100
  --after <cursor>
  --debug
```

Subreddit names accept an optional `r/` prefix. `info` prints compact metadata and saves the full sidebar and rules.

## Threads

```text
reddit-cli thread <post-id|t3_fullname|reddit-url>
  --comment-sort best|top|new|controversial|old|qa
  --comment <comment-id>
  --debug
```

Thread retrieval requests up to 500 top-level comments and depth 10, then preserves Reddit's remaining `more` counts in the saved tree. Stdout includes:

```yaml
comments_saved: 12
total_comments: 20
comment_selection:
  sort: best
files:
  post: <os-temp>/reddit-cli/posts/<id>/post.md
  comments: <os-temp>/reddit-cli/posts/<id>/comments-best.yml
```

`comments_saved` counts every actual comment written recursively. `total_comments` is Reddit's current reported count and can include comments Reddit does not return.

## Pagination

List commands return Reddit's `after` cursor. Pass it to the same command to request the next page. Cursors are temporary and should not be cached long-term.

## Errors and debug output

Errors use codes such as `INVALID_INPUT`, `NOT_FOUND`, `RATE_LIMITED`, `SUBREDDIT_PRIVATE`, `SUBREDDIT_BANNED`, `SUBREDDIT_QUARANTINED`, `REDDIT_ACCESS_BLOCKED`, and `NETWORK_ERROR`.

Without `--debug`, stderr contains one concise error. With `--debug`, an available failed HTTP response body is additionally written untouched to stdout. Network failures without an HTTP response have no raw body to print.
