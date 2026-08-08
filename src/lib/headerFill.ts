import {
  fetchBlock,
  fetchBlockCoinbase,
  activeEsploraHostName,
  type EsploraBlock,
} from './esplora';
import {
  indexHeadersByHash,
  indexHeadersById,
  walkBack,
  type ForkDataResponse,
  type ForkHeaderInfo,
} from './forkObserver';
import { identifyMiner } from './miner';

/** Session-scoped fills keyed by block hash. Survives polls; cleared on full reload. */
const filledByHash = new Map<string, ForkHeaderInfo>();

/** Negative ids so Esplora fills never collide with fork.observer ids. */
let nextFillId = -1;

const MAX_FILL_PER_PASS = 32;
const ESPLORA_PACE_MS = 150;

export function filledHeaderCount(): number {
  return filledByHash.size;
}

export function clearFilledHeaders(): void {
  filledByHash.clear();
  nextFillId = -1;
}

/** For tests — seed the session cache. */
export function seedFilledHeader(header: ForkHeaderInfo): void {
  filledByHash.set(header.hash, header);
}

export function esploraBlockToHeader(
  block: EsploraBlock,
  miner = '',
): ForkHeaderInfo {
  return {
    id: nextFillId--,
    prev_id: -1, // unknown; walks prefer prev_blockhash when present
    height: block.height,
    hash: block.id,
    version: block.version,
    prev_blockhash: block.previousblockhash ?? '',
    merkle_root: block.merkle_root,
    time: block.timestamp,
    bits: block.bits,
    miner,
  };
}

async function minerForBlock(
  blockHash: string,
  fetchCoinbase: typeof fetchBlockCoinbase = fetchBlockCoinbase,
): Promise<string> {
  try {
    const tx = await fetchCoinbase(blockHash);
    if (!tx) return '';
    const script = tx.vin[0]?.scriptsig ?? '';
    const addrs = tx.vout
      .map((v) => v.scriptpubkey_address)
      .filter((a): a is string => Boolean(a));
    return identifyMiner(script, addrs);
  } catch {
    return '';
  }
}

/** Merge session cache into a fork payload (skip hashes already present). */
export function mergeFilledHeaders(fork: ForkDataResponse): ForkDataResponse {
  if (filledByHash.size === 0) return fork;
  const have = new Set(fork.header_infos.map((h) => h.hash));
  const extras: ForkHeaderInfo[] = [];
  for (const h of filledByHash.values()) {
    if (!have.has(h.hash)) extras.push(h);
  }
  if (extras.length === 0) return fork;
  return {
    ...fork,
    header_infos: [...fork.header_infos, ...extras],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type Gap = {
  /** First missing prev hash above the older known header. */
  startHash: string;
  /** Stop when this hash is reached (exclusive). */
  untilHash: string;
  untilHeight: number;
};

/** Height jumps on a tip→ancestor walk (newest-first). */
export function findPathGaps(pathNewestFirst: ForkHeaderInfo[]): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < pathNewestFirst.length - 1; i++) {
    const newer = pathNewestFirst[i]!;
    const older = pathNewestFirst[i + 1]!;
    if (newer.height - older.height <= 1) continue;
    const startHash = newer.prev_blockhash;
    if (!startHash) continue;
    gaps.push({
      startHash,
      untilHash: older.hash,
      untilHeight: older.height,
    });
  }
  return gaps;
}

/**
 * Fetch missing active-chain headers via Esplora into the session cache,
 * then return fork data with cache merged in.
 * Only fills small near-tip gaps on the standard path (Esplora follows one tip).
 * Skips huge historical holes in fork.observer's sparse DAG.
 */
export async function fillStandardPathGaps(
  fork: ForkDataResponse,
  tipHash: string,
  fetch = fetchBlock,
  fetchCoinbase: typeof fetchBlockCoinbase = fetchBlockCoinbase,
): Promise<{
  fork: ForkDataResponse;
  filled: number;
  minersUpdated: number;
  host: string | null;
}> {
  let merged = mergeFilledHeaders(fork);
  const byHash = indexHeadersByHash(merged.header_infos);
  const byId = indexHeadersById(merged.header_infos);
  const path = walkBack(byHash, tipHash, 128, byId);
  if (path.length < 2) {
    return { fork: merged, filled: 0, minersUpdated: 0, host: null };
  }

  const tipHeight = path[0]!.height;
  const minHeight = tipHeight - 64;
  // Only small holes near the tip — ignore fork.observer's sparse history.
  const gaps = findPathGaps(path).filter(
    (g) =>
      g.untilHeight >= minHeight &&
      tipHeight - g.untilHeight - 1 <= MAX_FILL_PER_PASS,
  );

  let filled = 0;
  let minersUpdated = 0;
  let usedEsplora = false;

  // Backfill miner on prior session fills that only have headers.
  for (const h of filledByHash.values()) {
    if (h.miner) continue;
    usedEsplora = true;
    const miner = await minerForBlock(h.hash, fetchCoinbase);
    if (miner) {
      h.miner = miner;
      filledByHash.set(h.hash, h);
      minersUpdated += 1;
    }
    await sleep(ESPLORA_PACE_MS);
  }

  for (const gap of gaps) {
    if (filled >= MAX_FILL_PER_PASS) break;
    let hash: string | undefined = gap.startHash;

    while (hash && filled < MAX_FILL_PER_PASS) {
      if (hash === gap.untilHash) break;

      const known = byHash.get(hash) ?? filledByHash.get(hash);
      if (known) {
        if (known.height <= gap.untilHeight) break;
        hash = known.prev_blockhash || undefined;
        continue;
      }

      const block = await fetch(hash);
      usedEsplora = true;
      if (block.height <= gap.untilHeight || block.id === gap.untilHash) {
        break;
      }

      await sleep(ESPLORA_PACE_MS);
      const miner = await minerForBlock(block.id, fetchCoinbase);
      if (miner) minersUpdated += 1;

      const header = esploraBlockToHeader(block, miner);
      filledByHash.set(header.hash, header);
      byHash.set(header.hash, header);
      filled += 1;
      hash = block.previousblockhash;
      if (hash) await sleep(ESPLORA_PACE_MS);
    }
  }

  merged = mergeFilledHeaders(merged);
  return {
    fork: merged,
    filled,
    minersUpdated,
    host: usedEsplora ? activeEsploraHostName() : null,
  };
}
