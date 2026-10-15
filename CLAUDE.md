# CLAUDE.md

TypeScript monorepo with a shared Reddit core and separate CLI and MCP adapters. Anonymous access works without credentials; OAuth client credentials are optional.

The neutral root package exposes two explicit binaries, `reddit-cli` and `reddit-mcp`; do not rely on npm executable inference.

## Commands

```bash
npm install
npm test
node packages/cli/dist/cli.js --help
```

## Architecture

- `packages/core` owns the Reddit client, OAuth/cookies/challenges, rate limits, typed errors, domain mappings, search, communities, feeds, and configurable thread retrieval.
- `packages/core` uses cheerio to parse Reddit's Shreddit HTML pages (Reddit killed anonymous `.json` access; all data is now extracted from server-rendered HTML).
- `packages/output` owns YAML, atomic files, ISO timestamp presentation, subreddit sidebar/rules files, and thread body/comment files.
- `packages/cli` owns the explicit Commander hierarchy, choices, debug behavior, and CLI defaults.
- `packages/mcp` owns the legacy six MCP tool names, Zod schemas, stdio server, and MCP defaults.

Core operations return structured values and throw `RedditError`. They do not import Commander, MCP, YAML, or filesystem presentation.

## HTML parsing limitations

Some fields available in the old JSON API are not present in HTML:
- `subscribers` (total member count) — not in server-rendered HTML; `active_users` uses weekly-active-users
- `edited_utc` — not available for posts or comments
- `awards` — not available (award count exists but not names)
- `rules` — loaded client-side, not in server-rendered HTML
- `author` — not available in search results
- `upvote_ratio` — not available in search results
- `flair`, `locked`, `archived`, `spoiler` — not reliably available
- `description_long` (full sidebar markdown) — only the short description is in initial HTML
- `created_utc` for subreddits — not available
- Feed pages return ~3 initial posts with a pagination cursor for more

## Invariants

- Route all Reddit requests through `client.ts`.
- All data extraction from Reddit HTML goes through `parser.ts` using cheerio.
- Never print request authorization, cookies, client secrets, or OAuth tokens.
- `--debug` prints only an untouched failed response body; normal errors stay concise on stderr.
- Search/feed results remain bounded stdout YAML and retain Reddit cursors.
- Both adapters use the shared output package for deterministic subreddit and thread files.
- A thread reports actual recursively saved comments separately from Reddit's reported total.
- Different comment sorts and focused subtrees use different filenames.
- The known anonymous challenge is automatic. Unknown challenge formats fail clearly as `REDDIT_ACCESS_BLOCKED`; there is no manual solver command.

## Changes

- Keep HTTP, core operations, filesystem output, and CLI parsing separate.
- Preserve MCP tool names and input schemas for existing direct users.
- Update README and `docs/CLI.md` for user-visible behavior.
- Run `npm test`, MCP protocol tests, packed-install tests, and representative live commands.
