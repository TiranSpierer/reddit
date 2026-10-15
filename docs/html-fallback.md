# HTML-only fallback approach

Backup strategy for when Reddit blocks all JSON API access including `oauth.reddit.com` with anonymous `token_v2` tokens.

## Context

Reddit killed all `.json` endpoints for anonymous users. The JS challenge still works and grants session cookies, but those cookies only unlock HTML page access — not JSON API endpoints.

## How it works

Uses `cheerio` to parse Reddit's server-rendered Shreddit HTML pages instead of the dead JSON API. The challenge solving (seed+seed proof-of-work) is unchanged.

### Data sources

| Operation | Endpoint | Parser |
|---|---|---|
| Post metadata | `/comments/{id}/` HTML page | `<shreddit-post>` attributes |
| Post body | `/comments/{id}/` HTML page | `<div id="t3_xxx-post-rtjson-content">` text |
| Comments | `/comments/{id}/` HTML page | `<shreddit-comment>` attributes + body divs |
| Feed | `/r/{sub}/{sort}/` HTML page | `<shreddit-post>` elements |
| Search | `/search/?q=...&type=link` HTML page | `<a data-testid="post-title">` + `faceplate-number` + `faceplate-timeago` |
| Subreddit info | `/r/{sub}/` HTML page | `<shreddit-subreddit-header>` attributes |
| NSFW detection | Post page | `<shreddit-screenview-data>` JSON blob |
| Feed pagination | Feed page | `<faceplate-partial>` `src` attribute with `after=` cursor |

### Cheerio selectors

**Post page:**
- Title: `$('shreddit-post').attr('post-title')`
- Author: `$('shreddit-post').attr('author')`
- Score: `$('shreddit-post').attr('score')`
- Upvote ratio: `$('shreddit-post').attr('upvote-ratio')`
- Comment count: `$('shreddit-post').attr('comment-count')`
- Created: `$('shreddit-post').attr('created-timestamp')` (ISO string)
- Body: `$('[id="t3_xxx-post-rtjson-content"]').text()`
- Post type: `$('shreddit-post').attr('post-type')` (text/link/image/video)

**Comments:**
- ID: `$('shreddit-comment').attr('thingid')` (strip `t1_` prefix)
- Author: `$('shreddit-comment').attr('author')`
- Score: `$('shreddit-comment').attr('score')`
- Depth: `$('shreddit-comment').attr('depth')`
- Parent: `$('shreddit-comment').attr('parentid')` (for tree building)
- Body: `$('[id="t1_xxx-comment-rtjson-content"]').text()`

**Search results:**
- Title link: `$('a[data-testid="post-title"]')` → `aria-label` + `href`
- Score: parent's `faceplate-number` where sibling text contains "votes"
- Comments: parent's `faceplate-number` where sibling text contains "comments"
- Time: parent's `faceplate-timeago` `ts` attribute

### Known limitations vs JSON API

- `subscribers` — not in server-rendered HTML (only `weekly-active-users`)
- `edited_utc` — not available for posts or comments
- `awards` — not available
- `rules` — loaded client-side, not in SSR HTML
- `author` in search results — not rendered
- `description_long` (full sidebar markdown) — only short description available
- `created_utc` for subreddits — not available
- Feed pages return ~3 initial posts (pagination cursor works for more)

## When to use

Activate this branch if Reddit blocks `oauth.reddit.com` for anonymous `token_v2` Bearer tokens. The HTML approach is more resilient because Reddit cannot block it without breaking their own website for logged-out users.
