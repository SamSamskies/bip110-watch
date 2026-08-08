import { ESPLORA_HOSTS, REQUEST_TIMEOUT_MS } from './types';

let activeHost: string = ESPLORA_HOSTS[0];
let hostProbe: Promise<string> | null = null;

export function getActiveEsploraHost(): string {
  return activeHost;
}

export function activeEsploraHostName(): string {
  return activeHost.replace(/^https?:\/\//, '');
}

async function getWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function resolveHost(): Promise<string> {
  if (hostProbe) return hostProbe;

  hostProbe = (async () => {
    let lastError: unknown;
    for (const host of ESPLORA_HOSTS) {
      try {
        const res = await getWithTimeout(`${host}/api/blocks/tip/height`);
        if (!res.ok) {
          lastError = new Error(`${host} responded ${res.status}`);
          continue;
        }
        activeHost = host;
        return host;
      } catch (err) {
        lastError = err;
      }
    }
    hostProbe = null;
    throw new Error(
      `No Esplora host reachable. Last: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  })();

  return hostProbe;
}

async function esploraFetchJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const host = await resolveHost();
    try {
      const res = await getWithTimeout(`${host}${path}`);
      if (res.status === 429 || res.status >= 500) {
        hostProbe = null;
        lastError = new Error(`${host} ${res.status}`);
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${host}${path} → ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      hostProbe = null;
      lastError = err;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}

export type EsploraBlock = {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash?: string;
  bits?: number;
};

/** Recent tip blocks (newest first). Vanilla Esplora `/api/blocks`. */
export async function fetchRecentBlocks(): Promise<EsploraBlock[]> {
  return esploraFetchJson<EsploraBlock[]>('/api/blocks');
}

export async function fetchTipHeight(): Promise<number> {
  return esploraFetchJson<number>('/api/blocks/tip/height');
}

/** Single block header by hash. */
export async function fetchBlock(hash: string): Promise<EsploraBlock> {
  return esploraFetchJson<EsploraBlock>(`/api/block/${hash}`);
}

export type EsploraTx = {
  vin: { scriptsig?: string; is_coinbase?: boolean }[];
  vout: { scriptpubkey_address?: string; value?: number }[];
};

/** Coinbase tx for a block (first txid). */
export async function fetchBlockCoinbase(blockHash: string): Promise<EsploraTx | null> {
  const txids = await esploraFetchJson<string[]>(
    `/api/block/${blockHash}/txids`,
  );
  const coinbaseId = txids[0];
  if (!coinbaseId) return null;
  return esploraFetchJson<EsploraTx>(`/api/tx/${coinbaseId}`);
}
