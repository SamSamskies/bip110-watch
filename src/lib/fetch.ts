import { REQUEST_TIMEOUT_MS } from './types';

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`${url} → ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
