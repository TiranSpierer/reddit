# Reddit API behavior

## Access modes

When `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are both set, requests use a client-credentials bearer token at `oauth.reddit.com`. Otherwise requests use Reddit's anonymous JSON endpoints with browser headers and session cookies.

Anonymous access bootstraps cookies through Reddit's Atom endpoint and automatically handles the currently known JavaScript challenge. If Reddit changes that flow, the client throws `REDDIT_ACCESS_BLOCKED`; `--debug` exposes the failed response body for diagnosis.

## Rate limits

The client tracks `x-ratelimit-remaining` and `x-ratelimit-reset`, waits when exhausted, and retries one 429 response. Rate limits are scoped by Reddit and can vary by access mode.

## Endpoints

```text
/search.json
/subreddits/search.json
/r/<subreddit>/about.json
/r/<subreddit>/about/rules.json
/r/<subreddit>/<sort>.json
/r/<subreddit>/search.json
/comments/<post-id>.json
```

The comments endpoint returns a two-element array: post listing followed by comment listing. Comment trees can contain `more` stubs instead of comments; their counts are preserved as `more_count` or `more_replies`.

Deleted and moderator-removed content are valid Reddit values (`[deleted]` and `[removed]`), not client errors.

List endpoints use Reddit fullname cursors such as `t3_abc123` and `t5_abc123`. An absent `after` value means no next page.
