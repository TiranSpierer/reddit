import { RedditError } from "./types.js";

const BASE_URL = "https://www.reddit.com";
const OAUTH_BASE_URL = "https://oauth.reddit.com";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID?.trim() || "";
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
const HAS_OAUTH = Boolean(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET);

const OAUTH_USER_AGENT = `reddit-mcp/1.0 (github.com/TiranSpierer/reddit-mcp)`;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const CHALLENGE_BOOTSTRAP_URL = `${BASE_URL}/r/popular/hot.atom`;
const CHALLENGE_MARKER = 'name="js_challenge"';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinSetCookies(headers: Headers, existing = ""): string {
  const raw =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")!]
        : [];
  const pairs = raw.map((c) => c.split(";")[0]).filter(Boolean);
  return [existing, ...pairs].filter(Boolean).join("; ");
}

function buildChallengeMessage(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1].trim())
    .filter((s) => /solution|challenge|js_challenge/i.test(s));
  const forms = [...html.matchAll(/<form[\s\S]*?<\/form>/g)]
    .map((m) => m[0])
    .filter((f) => /name="solution"/i.test(f));

  return [
    "Reddit's auto-solver couldn't parse the current challenge — they likely changed the format.",
    "Inspect the JavaScript and form below, compute the value the JS would set into the form's `solution` field, then call `solve_reddit_challenge(solution=<your value>, token=<token from form>)`.",
    "After it succeeds, retry your original tool call.",
    "",
    "--- Challenge JavaScript ---",
    scripts.join("\n\n") || "(no challenge-related <script> found)",
    "",
    "--- Challenge form ---",
    forms.join("\n\n") || "(no <form> with name=\"solution\" found)",
  ].join("\n");
}

// ─── OAuth token management ──────────────────────────────────────────────────

interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

let oauthToken: OAuthToken | null = null;
let oauthTokenPromise: Promise<OAuthToken> | null = null;

async function fetchOAuthToken(): Promise<OAuthToken> {
  const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OAUTH_USER_AGENT,
      },
      body: "grant_type=client_credentials",
    });
  } catch (err) {
    throw new RedditError("NETWORK_ERROR", `OAuth token request failed: ${String(err)}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new RedditError("NETWORK_ERROR", `OAuth token request returned HTTP ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000, // refresh 30s early
  };
}

async function ensureOAuthToken(): Promise<string> {
  if (oauthToken && Date.now() < oauthToken.expiresAt) {
    return oauthToken.accessToken;
  }
  if (!oauthTokenPromise) {
    oauthTokenPromise = fetchOAuthToken()
      .then((t) => {
        oauthToken = t;
        return t;
      })
      .finally(() => {
        oauthTokenPromise = null;
      });
  }
  const token = await oauthTokenPromise;
  return token.accessToken;
}

// ─── Client ──────────────────────────────────────────────────────────────────

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

class RedditClient {
  private rateLimit: RateLimitState = { remaining: 100, resetAt: 0 };
  private cookies: string | null = null;
  private cookiePromise: Promise<string> | null = null;
  private pendingChallenge: {
    submitUrl: string;
    bootstrapCookies: string;
  } | null = null;

  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const cleanPath = path.endsWith(".json") ? path : `${path}.json`;

    if (HAS_OAUTH) {
      const url = new URL(cleanPath, OAUTH_BASE_URL);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
      if (this.rateLimit.remaining <= 0) {
        const waitMs = Math.max(0, this.rateLimit.resetAt - Date.now());
        if (waitMs > 0) await sleep(waitMs);
      }
      return this.fetchOAuth<T>(url.toString(), false);
    }

    const url = new URL(cleanPath, BASE_URL);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    if (this.rateLimit.remaining <= 0) {
      const waitMs = Math.max(0, this.rateLimit.resetAt - Date.now());
      if (waitMs > 0) await sleep(waitMs);
    }
    return this.fetchAnonymous<T>(url.toString(), false);
  }

  // ─── OAuth path ──────────────────────────────────────────────────────────

  private async fetchOAuth<T>(url: string, isRetry: boolean): Promise<T> {
    const token = await ensureOAuthToken();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": OAUTH_USER_AGENT,
        },
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Network request failed: ${String(err)}`);
    }

    this.updateRateLimit(response.headers);

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if (response.status === 401 && !isRetry) {
      oauthToken = null;
      return this.fetchOAuth<T>(url, true);
    }

    if (response.status === 429) {
      if (isRetry) {
        throw new RedditError("RATE_LIMITED", "Rate limit exceeded after retry");
      }
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const waitSec = resetHeader ? parseInt(resetHeader, 10) : 10;
      await sleep(waitSec * 1000);
      return this.fetchOAuth<T>(url, true);
    }

    if (response.status === 403) {
      let reason = "";
      try {
        const body = (await response.json()) as { reason?: string };
        reason = body.reason ?? "";
      } catch { /* body wasn't JSON */ }
      if (reason === "private") {
        throw new RedditError("SUBREDDIT_PRIVATE", "This subreddit is private");
      }
      if (reason === "banned") {
        throw new RedditError("SUBREDDIT_BANNED", "This subreddit has been banned");
      }
      throw new RedditError("NOT_FOUND", `Access denied (${response.status})`);
    }

    if (response.status === 404) {
      throw new RedditError("NOT_FOUND", `Not found: ${url}`);
    }

    throw new RedditError("NETWORK_ERROR", `Unexpected HTTP ${response.status}`);
  }

  // ─── Anonymous/challenge-solver path ─────────────────────────────────────

  private async ensureCookies(): Promise<string> {
    if (this.cookies) return this.cookies;
    if (!this.cookiePromise) {
      this.cookiePromise = this.solveChallenge()
        .then((c) => {
          this.cookies = c;
          return c;
        })
        .finally(() => {
          this.cookiePromise = null;
        });
    }
    return this.cookiePromise;
  }

  private async solveChallenge(): Promise<string> {
    let initial: Response;
    try {
      initial = await fetch(CHALLENGE_BOOTSTRAP_URL, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Bootstrap fetch failed: ${String(err)}`);
    }

    const html = await initial.text();
    const bootstrapCookies = joinSetCookies(initial.headers);

    if (!html.includes(CHALLENGE_MARKER)) {
      return bootstrapCookies;
    }

    const seedMatch = html.match(/\("([0-9a-f]+)"\)/);
    const tokenMatch = html.match(/name="token"\s+value="([^"]+)"/);
    const canonicalUrl = initial.url || CHALLENGE_BOOTSTRAP_URL;

    if (!seedMatch || !tokenMatch) {
      this.pendingChallenge = { submitUrl: canonicalUrl, bootstrapCookies };
      throw new RedditError("CHALLENGE_REQUIRED", buildChallengeMessage(html));
    }

    const seed = seedMatch[1];
    const token = tokenMatch[1];
    const solution = seed + seed;

    const submitUrl = new URL(canonicalUrl);
    submitUrl.searchParams.set("solution", solution);
    submitUrl.searchParams.set("token", token);
    submitUrl.searchParams.set("js_challenge", "1");
    submitUrl.searchParams.set("jsc_orig_r", "");

    let solved: Response;
    try {
      solved = await fetch(submitUrl.toString(), {
        headers: {
          ...BROWSER_HEADERS,
          Referer: canonicalUrl,
          Cookie: bootstrapCookies,
        },
        redirect: "follow",
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Challenge submit failed: ${String(err)}`);
    }

    if (!solved.ok) {
      throw new RedditError(
        "NETWORK_ERROR",
        `Challenge submit returned HTTP ${solved.status}`
      );
    }

    return joinSetCookies(solved.headers, bootstrapCookies);
  }

  async submitChallengeSolution(solution: string, token: string): Promise<void> {
    if (!this.pendingChallenge) {
      throw new RedditError(
        "NETWORK_ERROR",
        "No pending challenge to resolve. The auto-solver may have already succeeded, or no tool call has triggered a challenge yet."
      );
    }

    const url = new URL(this.pendingChallenge.submitUrl);
    url.searchParams.set("solution", solution);
    url.searchParams.set("token", token);
    url.searchParams.set("js_challenge", "1");
    url.searchParams.set("jsc_orig_r", "");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          ...BROWSER_HEADERS,
          Cookie: this.pendingChallenge.bootstrapCookies,
          Referer: this.pendingChallenge.submitUrl,
        },
        redirect: "follow",
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Solution submit failed: ${String(err)}`);
    }

    const body = await res.text();
    if (!res.ok || body.includes(CHALLENGE_MARKER)) {
      throw new RedditError(
        "CHALLENGE_REQUIRED",
        `Solution rejected (HTTP ${res.status}). Re-inspect the challenge and try a different solution.`
      );
    }

    this.cookies = joinSetCookies(res.headers, this.pendingChallenge.bootstrapCookies);
    this.pendingChallenge = null;
  }

  private async fetchAnonymous<T>(url: string, isRetry: boolean): Promise<T> {
    const cookies = await this.ensureCookies();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          ...BROWSER_HEADERS,
          Cookie: cookies,
        },
        redirect: "follow",
      });
    } catch (err) {
      throw new RedditError("NETWORK_ERROR", `Network request failed: ${String(err)}`);
    }

    this.updateRateLimit(response.headers);

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if (response.status === 429) {
      if (isRetry) {
        throw new RedditError("RATE_LIMITED", "Rate limit exceeded after retry");
      }
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const waitSec = resetHeader ? parseInt(resetHeader, 10) : 10;
      await sleep(waitSec * 1000);
      return this.fetchAnonymous<T>(url, true);
    }

    if (response.status === 403) {
      if (!isRetry) {
        this.cookies = null;
        return this.fetchAnonymous<T>(url, true);
      }
      let reason = "";
      try {
        const body = (await response.json()) as { reason?: string };
        reason = body.reason ?? "";
      } catch { /* body wasn't JSON */ }
      if (reason === "private") {
        throw new RedditError("SUBREDDIT_PRIVATE", "This subreddit is private");
      }
      if (reason === "banned") {
        throw new RedditError("SUBREDDIT_BANNED", "This subreddit has been banned");
      }
      throw new RedditError("NOT_FOUND", `Access denied (${response.status})`);
    }

    if (response.status === 404) {
      throw new RedditError("NOT_FOUND", `Not found: ${url}`);
    }

    throw new RedditError("NETWORK_ERROR", `Unexpected HTTP ${response.status}`);
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining !== null) this.rateLimit.remaining = parseFloat(remaining);
    if (reset !== null) this.rateLimit.resetAt = Date.now() + parseInt(reset, 10) * 1000;
  }
}

export const reddit = new RedditClient();
