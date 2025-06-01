import * as fs from 'fs';
import * as path from 'path';
import { CookieJar } from 'tough-cookie';

/**
 * Persists a {@link CookieJar} on disk and reloads it on startup.
 *
 * @example
 * ```ts
 * const store = new CookieStore('/absolute/path/bbCookies.json');
 * const jar   = store.cookieJar;
 * // … use jar with fetch-cookie …
 * store.save(); // whenever you want to flush to disk
 * ```
 */
export class CookieStore {
  private readonly jar: CookieJar;

  /**
   * @param filePath Absolute path for the JSON file used to persist cookies.
   */
  constructor(private readonly filePath: string) {
    this.jar = this.load();
  }

  /** The underlying {@link CookieJar}. */
  get cookieJar(): CookieJar {
    return this.jar;
  }

  /**
   * Serialises the current {@link CookieJar} and writes it to disk.
   * Creates parent directories if they do not exist.
   */
  save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const json = this.jar.serializeSync();
    fs.writeFileSync(this.filePath, JSON.stringify(json));
  }

  /**
   * Loads a {@link CookieJar} from disk or returns an empty one on failure.
   *
   * @returns A deserialised cookie jar.
   */
  private load(): CookieJar {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return CookieJar.deserializeSync(JSON.parse(raw));
      }
    } catch {
      /* fall through – an empty jar will be returned */
    }
    return new CookieJar();
  }
}
