# CLAUDE.md

TypeScript CLI for searching and reading Reddit discussions. Anonymous access works without credentials; OAuth client credentials are optional.

## Commands

```bash
npm install
npm test
node dist/cli.js --help
```

## Architecture

- `client.ts` is the single HTTP boundary. It owns OAuth tokens, anonymous cookies, the known automatic challenge flow, rate limits, retries, error classification, and sanitized debug responses.
- `core/search.ts` contains global and subreddit-scoped post search.
- `core/subreddits.ts` contains community discovery, metadata, saved sidebar/rules, and feeds.
- `core/threads.ts` fetches the fullest practical comment tree, maps nested comments, and saves deterministic post/comment files.
- `types.ts` contains lean Reddit response types, clean output mappers, identifiers, and typed errors.
- `files.ts` writes files atomically below the OS temporary directory.
- `cli.ts` explicitly defines Commander commands, choices, rendering, debug behavior, and exit codes.

Core operations return structured values and throw `RedditError`. Commander and stdout/stderr behavior belong only in `cli.ts`.

## Invariants

- Route all Reddit requests through `client.ts`.
- Never print request authorization, cookies, client secrets, or OAuth tokens.
- `--debug` prints only an untouched failed response body; normal errors stay concise on stderr.
- Search/feed results remain bounded stdout YAML and retain Reddit cursors.
- Subreddit sidebars/rules and thread bodies/comments are always saved to deterministic files.
- A thread reports actual recursively saved comments separately from Reddit's reported total.
- Different comment sorts and focused subtrees use different filenames.
- The known anonymous challenge is automatic. Unknown challenge formats fail clearly as `REDDIT_ACCESS_BLOCKED`; there is no manual solver command.

## Changes

- Keep HTTP, core operations, filesystem output, and CLI parsing separate.
- Update README and `docs/CLI.md` for user-visible behavior.
- Run `npm test` and representative live commands before committing.
