import { createWriteStream } from 'fs';
import { mkdirSync, existsSync } from 'fs';
import { dirname, basename, join } from 'path';
import { pipeline } from 'stream/promises';
import pLimit from 'p-limit';
import { BBFetch } from '../http/BBFetch';

/**
 * Downloads arbitrary files with concurrency control.
 */
export class DownloadService {
  /**
   * @param fetch          HTTP client (already logged-in).
   * @param concurrency    Max parallel downloads (`4` by default).
   */
  constructor(
    private readonly fetch: BBFetch,
    private readonly concurrency = 4,
  ) {}

  /**
   * Downloads a single file to `savePath`.  
   * Intermediate folders are created automatically.
   *
   * @returns  `true` on success, `false` on HTTP error.
   */
  async download(url: string, savePath: string): Promise<boolean> {
    ensureDir(dirname(savePath));

    const res = await this.fetch.get(url, { redirect: 'follow' });
    if (!res.ok) {return false;}

    const fileStream = createWriteStream(savePath);
    await pipeline(res.body as any, fileStream);
    return true;
  }

  /**
   * Downloads multiple files concurrently.
   *
   * @param items    Array of `{ url, path }`.
   * @param onError  Optional callback when a download fails.
   */
  async downloadAll(
    items: Array<{ url: string; path: string }>,
    onError?: (item: { url: string; path: string }) => void,
  ): Promise<void> {
    const limit = pLimit(this.concurrency);
    await Promise.all(
      items.map((item) =>
        limit(async () => {
          const ok = await this.download(item.url, item.path);
          if (!ok && onError) {onError(item);}
        }),
      ),
    );
  }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {mkdirSync(dir, { recursive: true });}
}
