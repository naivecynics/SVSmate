import fetch from 'node-fetch';

/**
 * Download raw ICS text. Caller is responsible for parsing / merging.
 */
export async function fetchIcsText(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {throw new Error(resp.statusText);}
  return await resp.text();
}
