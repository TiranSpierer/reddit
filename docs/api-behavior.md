# Reddit API behavior

## Access modes

When `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are both set, requests use a client-credentials bearer token at `oauth.reddit.com`. Otherwise the client solves Reddit's JavaScript challenge to obtain a `token_v2` anonymous JWT, then uses it as a bearer token on `oauth.reddit.com`.

Reddit blocks anonymous tokens on `/comments/<id>` and `/search` endpoints. Those operations fall back to fetching the HTML page from `www.reddit.com` and parsing the Shreddit web components with cheerio.

If Reddit changes the challenge flow, the client throws `REDDIT_ACCESS_BLOCKED`; `--debug` exposes the failed response body for diagnosis.

## Rate limits

The client tracks `x-ratelimit-remaining` and `x-ratelimit-reset`, waits when exhausted, and retries one 429 response. Rate limits are scoped by Reddit and can vary by access mode.

## Endpoints

JSON via `oauth.reddit.com` (bearer token):

```text
/subreddits/search
/r/<subreddit>/about
/r/<subreddit>/about/rules
/r/<subreddit>/<sort>
/r/<subreddit>/search
/by_id/t3_<post-id>
```

HTML via `www.reddit.com` (session cookies):

```text
/r/<subreddit>/comments/<post-id>/   → comment tree (parsed from shreddit-comment elements)
/search/?q=<query>&type=link         → post search results (parsed from data-testid elements)
```

The HTML comment tree is built from `<shreddit-comment>` attributes: `thingid`, `author`, `score`, `depth`, `parentid`, `created`. Comment bodies come from `<div id="t1_xxx-comment-rtjson-content">`.

Deleted and moderator-removed content are valid Reddit values (`[deleted]` and `[removed]`), not client errors.

List endpoints use Reddit fullname cursors such as `t3_abc123` and `t5_abc123`. An absent `after` value means no next page.
