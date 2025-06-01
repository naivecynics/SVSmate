import fetch, { RequestInit, Response } from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieStore } from '../auth/CookieStore';

/** Default desktop user-agent for Blackboard. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Thin wrapper around `node-fetch` that automatically persists cookies
 * via {@link CookieStore}.
 *
 * The wrapper does **not** follow redirects by default (`redirect: "manual"`).
 * The caller decides whether and how to handle `302` responses.
 */
export class BBFetch {
  private readonly client: typeof fetch;

  /**
   * @param cookieStore Cookie persistence layer shared across requests.
   */
  constructor(private readonly cookieStore: CookieStore) {
    // `fetch-cookie` patches fetch so it transparently reads/writes the jar.
    this.client = fetchCookie(
      fetch,
      cookieStore.cookieJar as unknown as any,
    ) as typeof fetch;
  }

  /**
   * Sends a `GET` request with sensible defaults.
   *
   * @param url     Absolute target URL.
   * @param init    Additional `fetch` options.
   * @returns       Raw {@link Response}.
   */
  async get(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.client(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) },
      redirect: 'manual',
    });
    this.cookieStore.save();
    return res;
  }

  /**
   * Sends a `POST` request.  
   * Adds `Content-Type: application/x-www-form-urlencoded` unless overridden.
   *
   * @param url     Absolute target URL.
   * @param body    Request body (string or `URLSearchParams`).
   * @param init    Additional `fetch` options.
   * @returns       Raw {@link Response}.
   */
  async post(
    url: string,
    body: any,
    init: RequestInit = {},
  ): Promise<Response> {
    const res = await this.client(url, {
      method: 'POST',
      body,
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(init.headers || {}),
      },
    });
    this.cookieStore.save();
    return res;
  }
}
