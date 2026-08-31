# reddit-cli

CLI for searching and reading Reddit discussions. It supports anonymous access without an API key and optional OAuth credentials for higher rate limits.

## Install

Recommended: install [`web-platforms`](https://github.com/TiranSpierer/agent-plugins) from the agent plugin marketplace.

Run directly:

```bash
npx -y git+https://github.com/TiranSpierer/reddit-cli.git reddit-cli --help
```

## Commands

```bash
reddit-cli search "typescript error" --sort top --time year

reddit-cli subreddit find "robot vacuum"
reddit-cli subreddit info RobotVacuums
reddit-cli subreddit posts RobotVacuums --sort new
reddit-cli subreddit search RobotVacuums "budget mop"

reddit-cli thread 1w391er
reddit-cli thread <reddit-url> --comment-sort top
reddit-cli thread 1w391er --comment p6ypqcs
```

Searches and feeds print compact YAML and an `after` cursor for pagination.

`subreddit info` saves optional community material under `<os-temp>/reddit-cli/subreddits/<name>/`:

```text
sidebar.md  Full community sidebar
rules.yml   Community rules
```

`thread` always saves the post and selected comment discussion under `<os-temp>/reddit-cli/posts/<post-id>/`:

```text
post.md                         Post title, links, and body
comments-best.yml               Default comment selection
comments-top.yml                A requested sort
comments-<comment-id>-best.yml  A focused comment subtree
```

Thread stdout reports `comments_saved` and Reddit's `total_comments`. Reddit may return fewer comments because of deleted content or unresolved `more` nodes.

## Debugging

Add `--debug` before or after a command. Normal errors remain concise on stderr; when Reddit returned an HTTP response, its untouched body is printed to stdout. Authorization, cookies, client secrets, and OAuth tokens are never printed.

```bash
reddit-cli subreddit info missing-community --debug
reddit-cli --debug thread missing-post
```

## Optional OAuth

Set both variables to use Reddit's client-credentials API instead of anonymous access:

```text
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
```

## Development

```bash
npm install
npm test
node dist/cli.js --help
```

Requires Node.js 20 or newer.
