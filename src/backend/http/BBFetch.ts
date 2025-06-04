import fetch, { RequestInit, Response } from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { CookieStore } from '../auth/CookieStore';

/** Default desktop user-agent for Blackboard requests. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Thin wrapper around **`node-fetch`** that
 * 1. automatically attaches / persists cookies via {@link CookieStore};  
 * 2. applies a consistent user-agent;  
 * 3. defaults to **manual redirect handling** (the caller decides what to do
 *    with 302 responses).
 *
 * Every successful network round-trip is **not** persisted automatically
 * anymore; instead call {@link saveCookies} at explicit checkpoints
 * (e.g. after a login probe succeeds).
 */
export class BBFetch {
  /** Low-level fetch function patched by `fetch-cookie`. */
  private readonly client: (url: string, init?: RequestInit) => Promise<Response>;

  /**
   * @param cookieStore Cookie persistence layer shared across requests.
   */
  constructor(private readonly cookieStore: CookieStore) {
    this.client = fetchCookie(
      fetch,
      cookieStore.cookieJar as any,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Public helpers for cookie lifecycle                                */
  /* ------------------------------------------------------------------ */

  /** Returns the underlying {@link CookieJar} (read-only). */
  get jar(): CookieJar {
    return this.cookieStore.cookieJar;
  }

  /** Flushes in-memory cookies to disk. */
  saveCookies(): void {
    this.cookieStore.save();
  }

  /** Removes **all** cookies from the current jar (sync). */
  clearCookies(): void {
    const jar = this.cookieStore.cookieJar;
    jar.removeAllCookies(() => {});
  }

  /* ------------------------------------------------------------------ */
  /* HTTP convenience methods                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Sends a **GET** request with sensible defaults.
   *
   * @param url   Absolute target URL.
   * @param init  Optional fetch options (overrides defaults).
   */
  async get(url: string, init: RequestInit = {}): Promise<Response> {
    return this.client(url, {
      // redirect: 'manual',
      redirect: init.redirect ?? 'manual',
      headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) },
      ...init,
    });
  }

  /**
   * Sends a **POST** request.
   *
   * @param url   Absolute target URL.
   * @param body  Request body (`string` or `URLSearchParams`).
   * @param init  Optional fetch options (overrides defaults).
   */
  async post(
    url: string,
    body: any,
    init: RequestInit = {},
  ): Promise<Response> {
    return this.client(url, {
      method: 'POST',
      body,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(init.headers || {}),
      },
      // redirect: 'manual',
      redirect: init.redirect ?? 'manual',
      ...init,
    });
  }
}
