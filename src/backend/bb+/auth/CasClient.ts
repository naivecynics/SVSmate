import { URLSearchParams } from 'url';
import { BbFetch } from '../http/BbFetch';

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
    private readonly fetch: BbFetch,
    private readonly credMgr: CredentialManager,
  ) {}

  /**
   * Ensures the session is authenticated.  
   * Returns immediately if a GET to `/ultra/course` is already `200`.
   *
   * @param username  SUSTech student/staff ID.
   * @param password  SUSTech password.
   * @returns         `true` on success, `false` otherwise.
   */
  async ensureLogin(username: string, password: string): Promise<boolean> {
    const loggedIn = await this.quickCheck();
    if (loggedIn) return true;

    const creds = await this.credMgr.getCredentials();
    if (!creds) return false;

    const execution = await this.fetchExecution();
    if (!execution) return false;

    const ticketURL = await this.submitCredentials(
      username,
      password,
      execution,
    );
    if (!ticketURL) return false;

    return this.validateServiceTicket(ticketURL);
  }

  /** Lightweight probe to see if cookies are still valid. */
  private async quickCheck(): Promise<boolean> {
    const res = await this.fetch.get(
      'https://bb.sustech.edu.cn/ultra/course',
      { redirect: 'manual' },
    );
    return res.status === 200;
  }

  /** Grabs CAS login page and extracts the `execution` hidden field. */
  private async fetchExecution(): Promise<string | null> {
    const url =
      `${CasClient.CAS_URL}?service=${encodeURIComponent(CasClient.SERVICE_URL)}`;
    const res = await this.fetch.get(url, { redirect: 'follow' });
    if (res.status !== 200) return null;

    const html = await res.text();
    const match = html.match(/name="execution"\s+value="([^"]+)"/);
    return match ? match[1] : null;
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

    if (res.status !== 302) return null;
    const location = res.headers.get('location') ?? '';
    return location.includes('ticket=') ? location : null;
  }

  /**
   * Follows the service ticket redirect, completing the SSO handshake.
   *
   * @param ticketURL  The `location` header obtained from `submitCredentials`.
   */
  private async validateServiceTicket(ticketURL: string): Promise<boolean> {
    const res = await this.fetch.get(ticketURL, { redirect: 'follow' });
    return res.status === 200 && res.url.includes('bb.sustech.edu.cn');
  }
}
