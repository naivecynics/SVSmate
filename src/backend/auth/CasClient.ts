import * as vscode from 'vscode';
import { URLSearchParams } from 'url';
import { BBFetch } from '../http/BBFetch';
import { CredentialManager } from './CredentialManager';
import * as cheerio from 'cheerio';
import { log } from '../../utils/OutputChannel';
import { updateStatusBar } from '../../frontend/statusBarItem';

/**
 * Handles CAS authentication flow for Blackboard.
 *
 * Responsibilities  
 * 1. Discover `execution` parameter on the CAS login page.  
 * 2. Submit user credentials.  
 * 3. Follow the service ticket redirect to finalise session cookies.
 */
export class CasClient {
  /** CAS login endpoint (no *service* param attached). */
  private static readonly CAS_URL =
    'https://cas.sustech.edu.cn/cas/login';

  /** Blackboard landing page used as *service* parameter. */
  private static readonly SERVICE_URL =
    'https://bb.sustech.edu.cn/webapps/login/';

  /**
   * @param fetch  Low-level HTTP client with cookie support.
   * @param credMgr  User credentials input helper.
   */
  constructor(
    private readonly fetch: BBFetch,
    private readonly credMgr: CredentialManager,
  ) {}

  /**
   * Ensures the current cookie jar represents a valid Blackboard session.
   * If a quick probe to `/ultra/course` already returns 200, the method
   * resolves `true` immediately.
   *
   * All credential prompting / caching is delegated to
   * {@link CredentialManager}.
   *
   * @returns `true` on successful login, `false` on failure or user cancel.
   */
  async ensureLogin(): Promise<boolean> {
    const loggedIn = await this.quickCheck();
    if (loggedIn) {return true;}

    const creds = await this.credMgr.getCredentials();
    if (!creds) {return false;}

    const execution = await this.fetchExecution();
    if (!execution) {return false;}

    const ticketURL = await this.submitCredentials(
      creds.username,
      creds.password,
      execution,
    );
    if (!ticketURL) {return false;}

    await updateStatusBar(this.credMgr);
    return this.validateServiceTicket(ticketURL);
  }

  /** Lightweight probe to see if cookies are still valid. */
  private async quickCheck(): Promise<boolean> {
    const res = await this.fetch.get(
      'https://bb.sustech.edu.cn/ultra/course', 
      { redirect: 'manual', }
    );
    if (res.status === 200) { return true; }
    if (res.status === 302) {
      const location = res.headers.get('location') || '';
      if (location.includes('cas.sustech.edu.cn')) { return false; }
    }
    const meRes = await this.fetch.get(
      'https://bb.sustech.edu.cn/learn/api/public/v1/users/me',
      { redirect: 'manual', }
    );
    return meRes.status === 200;
  }

  /** Grabs CAS login page and extracts the `execution` hidden field. */
  private async fetchExecution(): Promise<string | null> {
    const url = `${CasClient.CAS_URL}?service=${encodeURIComponent(CasClient.SERVICE_URL)}`;
    const res = await this.fetch.get(url, { redirect: 'follow' });

    log.info('CasClient', `fetchExecution → HTTP ${res.status}`);
    if (res.status !== 200) {return null;}

    const html = await res.text();
    const $ = cheerio.load(html);
    const exec = $('input[name="execution"]').val();
    return exec ? String(exec) : null;
  }

  /**
   * Submits the login form and expects a 302 containing `ticket=...`.
   *
   * @returns  Redirect location containing the service ticket. `null` if failed.
   */
  private async submitCredentials(
    username: string,
    password: string,
    execution: string,
  ): Promise<string | null> {
    const url =
      `${CasClient.CAS_URL}?service=${encodeURIComponent(CasClient.SERVICE_URL)}`;

    const body = new URLSearchParams({
      username,
      password,
      execution,
      _eventId: 'submit',
      geolocation: '',
      submit: '登录',
    });

    const res = await this.fetch.post(url, body, {
      redirect: 'manual',
    });

    if (res.status !== 302) {return null;}
    const location = res.headers.get('location') ?? '';
    if (location.includes('authenticationFailure')) {
      vscode.window.showErrorMessage('Credential invalid. Please try again.');
      return null;
    }
    return location.includes('ticket=') ? location : null;
  }

  /**
   * Follows the service ticket redirect, completing the SSO handshake.
   *
   * @param ticketURL  The `location` header obtained from `submitCredentials`.
   */
  private async validateServiceTicket(ticketURL: string): Promise<boolean> {
    const res = await this.fetch.get(ticketURL, { redirect: 'follow' });
    const ok  = res.status === 200 && res.url.includes('bb.sustech.edu.cn');
    if (ok) {this.fetch.saveCookies();}
    return ok;
  }
}
