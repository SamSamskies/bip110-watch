import { fetchJson } from './fetch';

export type ForkHeaderInfo = {
  id: number;
  prev_id: number;
  height: number;
  hash: string;
  version: number;
  prev_blockhash: string;
  merkle_root?: string;
  time: number;
  bits?: number;
  nonce?: number;
  difficulty_int?: number;
  miner?: string;
};

export type ForkChainTip = {
  hash: string;
  height: number;
  branchlen?: number;
  status: string;
};

export type ForkNodeInfo = {
  id: number;
  name: string;
  description?: string;
  implementation?: string;
  tips: ForkChainTip[];
};

export type ForkDataResponse = {
  header_infos: ForkHeaderInfo[];
  nodes: ForkNodeInfo[];
  countdown?: { height: number; label: string };
};

/** Mainnet network id on fork.observer. */
export const FORK_MAINNET_ID = 1;

const FORK_BASE = '/proxy/fork';

export async function fetchForkData(
  networkId = FORK_MAINNET_ID,
): Promise<ForkDataResponse> {
  return fetchJson<ForkDataResponse>(`${FORK_BASE}/${networkId}/data.json`);
}

export function indexHeadersByHash(
  headers: ForkHeaderInfo[],
): Map<string, ForkHeaderInfo> {
  const map = new Map<string, ForkHeaderInfo>();
  for (const h of headers) {
    map.set(h.hash, h);
  }
  return map;
}

export function indexHeadersById(
  headers: ForkHeaderInfo[],
): Map<number, ForkHeaderInfo> {
  const map = new Map<number, ForkHeaderInfo>();
  for (const h of headers) {
    map.set(h.id, h);
  }
  return map;
}

/**
 * Walk prev links from tip hash toward genesis.
 * Prefer `prev_id` when an id index is provided — fork.observer often omits
 * intermediate headers from `header_infos`, so `prev_blockhash` walks break
 * even when the DAG still links via id (e.g. height gaps).
 */
export function walkBack(
  byHash: Map<string, ForkHeaderInfo>,
  tipHash: string,
  maxSteps = 64,
  byId?: Map<number, ForkHeaderInfo>,
): ForkHeaderInfo[] {
  const path: ForkHeaderInfo[] = [];
  let h = byHash.get(tipHash);
  for (let i = 0; i < maxSteps && h; i++) {
    path.push(h);
    const viaId = byId?.get(h.prev_id);
    if (viaId) {
      h = viaId;
      continue;
    }
    h = byHash.get(h.prev_blockhash);
  }
  return path;
}

export function findKnotsAndCoreNodes(nodes: ForkNodeInfo[]): {
  core: ForkNodeInfo | null;
  knots: ForkNodeInfo | null;
} {
  let core: ForkNodeInfo | null = null;
  let knots: ForkNodeInfo | null = null;

  for (const n of nodes) {
    const name = n.name.toLowerCase();
    if (!knots && (name.includes('bip-110') || name.includes('bip110') || name.includes('knots'))) {
      knots = n;
    }
    if (
      !core &&
      (name === 'bitcoin core' ||
        (name.includes('bitcoin core') && !name.includes('knots')))
    ) {
      core = n;
    }
  }

  // Fallbacks: first Core-like / first node with active tip
  if (!core) {
    core =
      nodes.find((n) =>
        (n.implementation || '').toLowerCase().includes('bitcoin core'),
      ) ?? nodes[0] ?? null;
  }
  if (!knots) {
    knots =
      nodes.find((n) => n.name.toLowerCase().includes('110')) ?? null;
  }

  return { core, knots };
}

export function activeTip(node: ForkNodeInfo | null): ForkChainTip | null {
  if (!node?.tips?.length) return null;
  const active = node.tips.find((t) => t.status === 'active');
  if (active) return active;
  return node.tips.reduce((best, t) =>
    (t.height ?? 0) > (best.height ?? 0) ? t : best,
  );
}
