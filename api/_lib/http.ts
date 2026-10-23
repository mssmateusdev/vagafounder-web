import { BROWSER_UA } from './util.js';

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * fetch com timeout e User-Agent de navegador por padrão.
 * Equivalente ao cliente reqwest global do backend Rust.
 */
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { headers = {}, timeoutMs = 8000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        ...headers,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGetText(url: string, opts: FetchOptions = {}): Promise<string> {
  const resp = await httpGet(url, opts);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.text();
}

export async function httpGetJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const resp = await httpGet(url, {
    ...opts,
    headers: { Accept: 'application/json, text/plain, */*', ...(opts.headers ?? {}) },
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}
