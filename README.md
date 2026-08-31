# Reddit

Read-only Reddit access for coding agents: search Reddit and individual communities, browse feeds, and save complete discussion threads for local analysis. No API key is required.

Recommended: install [`web-platforms`](https://github.com/TiranSpierer/agent-plugins) from the agent plugin marketplace. The CLI is preferred for better token efficiency.

> [!IMPORTANT]
> **Migrating from v1:** replace the old implicit `npx -y git+https://github.com/TiranSpierer/reddit-mcp.git` command with the explicit MCP command shown below.

## MCP installation

Standard configuration:

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "git+https://github.com/TiranSpierer/reddit.git",
        "reddit-mcp"
      ]
    }
  }
}
```

<details>
<summary>Claude Code</summary>

```bash
claude mcp add reddit -s user -- npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-mcp
```

</details>

<details>
<summary>Codex</summary>

```bash
codex mcp add reddit -- npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-mcp
```

</details>

<details>
<summary>VS Code / Copilot</summary>

```bash
code --add-mcp '{"name":"reddit","command":"npx","args":["-y","-p","git+https://github.com/TiranSpierer/reddit.git","reddit-mcp"]}'
```

</details>

<details>
<summary>Cursor</summary>

Follow the [Cursor MCP documentation](https://cursor.com/docs/mcp) and use the standard configuration above.

</details>

<details>
<summary>Windsurf</summary>

Follow the [Windsurf MCP documentation](https://docs.windsurf.com/windsurf/cascade/mcp) and use the standard configuration above.

</details>

<details>
<summary>Antigravity</summary>

```bash
agy mcp add reddit -- npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-mcp
```

</details>

<details>
<summary>Cline</summary>

Add to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "git+https://github.com/TiranSpierer/reddit.git",
        "reddit-mcp"
      ],
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary>Authenticated mode (optional)</summary>

Set `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` for OAuth client-credentials access and higher rate limits.

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "-p", "git+https://github.com/TiranSpierer/reddit.git", "reddit-mcp"],
      "env": {
        "REDDIT_CLIENT_ID": "your_client_id",
        "REDDIT_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

Claude Code:

```bash
claude mcp add reddit -s user \
  -e REDDIT_CLIENT_ID=your_client_id \
  -e REDDIT_CLIENT_SECRET=your_client_secret \
  -- npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-mcp
```

Codex:

```bash
codex mcp add reddit \
  --env REDDIT_CLIENT_ID=your_client_id \
  --env REDDIT_CLIENT_SECRET=your_client_secret \
  -- npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-mcp
```

To request credentials, use Reddit's [developer form](https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164&tf_14867328473236=api_request_type_enterprise). See Reddit's [API access policy](https://support.reddithelp.com/hc/articles/42728983564564) for details.

</details>

---

<details>
<summary><strong>CLI</strong></summary>

Run directly:

```bash
npx -y -p git+https://github.com/TiranSpierer/reddit.git reddit-cli --help
```

Commands:

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

Searches and feeds print compact YAML with an `after` cursor. Subreddit sidebars/rules and thread bodies/comments are saved under the OS temporary directory; stdout returns compact metadata and file paths.

See [docs/CLI.md](docs/CLI.md) for the full command reference.

</details>

<details>
<summary><strong>MCP tools</strong></summary>

| Tool | Description |
|---|---|
| `search_reddit` | Search posts across Reddit |
| `search_subreddits` | Find communities by topic |
| `get_subreddit_info` | Get community metadata and save its sidebar/rules |
| `get_subreddit_posts` | Browse a community feed |
| `search_subreddit_posts` | Search within a community |
| `get_post` | Save a post and selected comment discussion |

The MCP adapter preserves the established six tool names and input schemas. It uses the same compact summaries and deterministic files as the CLI.

</details>

<details>
<summary><strong>Generated files</strong></summary>

```text
<os-temp>/reddit-cli/subreddits/<name>/
├── sidebar.md
└── rules.yml

<os-temp>/reddit-cli/posts/<post-id>/
├── post.md
├── comments-best.yml
├── comments-top.yml
└── comments-<comment-id>-best.yml
```

Thread output reports `comments_saved` separately from Reddit's `total_comments`.

</details>

<details>
<summary><strong>Debugging</strong></summary>

Add `--debug` before or after a CLI command. Normal errors remain concise on stderr; when Reddit returned an HTTP response, its untouched body is printed to stdout. Authorization, cookies, client secrets, and OAuth tokens are never printed.

```bash
reddit-cli subreddit info missing-community --debug
reddit-cli --debug thread missing-post
```

</details>

<details>
<summary><strong>Architecture</strong></summary>

```text
packages/core    Reddit client, domain types, and operations
packages/output  Shared YAML and deterministic file presentation
packages/cli     Explicit Commander interface
packages/mcp     MCP tool interface
```

The CLI and MCP adapters share Reddit behavior without sharing interface decisions.

</details>

<details>
<summary><strong>Local development</strong></summary>

```bash
npm install
npm test
node packages/cli/dist/cli.js --help
```

Requires Node.js 20 or newer.

</details>
