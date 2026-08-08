import {
  approxReorgChancePercent,
  signalsBip110,
} from './bip110';
import {
  activeTip,
  findKnotsAndCoreNodes,
  indexHeadersByHash,
  indexHeadersById,
  walkBack,
  type ForkDataResponse,
  type ForkHeaderInfo,
} from './forkObserver';
import {
  orangeTipsAgree,
  type OrangeNodesResponse,
} from './orange';
import {
  MAX_BRANCH_DISPLAY,
  SHARED_HISTORY_LEN,
  type ForkTopology,
  type TopologyBlock,
} from './types';

function headerToBlock(
  h: ForkHeaderInfo,
  side: TopologyBlock['side'],
): TopologyBlock {
  return {
    hash: h.hash,
    height: h.height,
    prevHash: h.prev_blockhash || null,
    version: h.version,
    time: h.time,
    miner: h.miner || null,
    side,
    signals: signalsBip110(h.version),
  };
}

function tipOnlyBlock(
  hash: string,
  height: number,
  side: TopologyBlock['side'],
  prevHash: string | null = null,
): TopologyBlock {
  return {
    hash,
    height,
    prevHash,
    version: null,
    time: null,
    miner: null,
    side,
    signals: false,
  };
}

function findCommonAncestorHash(
  corePath: ForkHeaderInfo[],
  knotsPath: ForkHeaderInfo[],
): string | null {
  const knotsHashes = new Set(knotsPath.map((h) => h.hash));
  for (const h of corePath) {
    if (knotsHashes.has(h.hash)) return h.hash;
  }
  return null;
}

function branchAfterAncestor(
  pathNewestFirst: ForkHeaderInfo[],
  ancestorHash: string,
): ForkHeaderInfo[] {
  const out: ForkHeaderInfo[] = [];
  for (const h of pathNewestFirst) {
    if (h.hash === ancestorHash) break;
    out.push(h);
  }
  // path is tip→ancestor; reverse to ancestor→tip (exclude ancestor)
  return out.reverse();
}

function sharedBeforeAncestor(
  pathNewestFirst: ForkHeaderInfo[],
  ancestorHash: string,
  len: number,
): ForkHeaderInfo[] {
  const idx = pathNewestFirst.findIndex((h) => h.hash === ancestorHash);
  if (idx < 0) return [];
  // from ancestor back toward older blocks, include ancestor at end of shared row
  const slice = pathNewestFirst.slice(idx, idx + len).reverse();
  return slice;
}

/**
 * Build topology from orange dual tips + fork.observer header DAG.
 */
export function buildTopology(
  orange: OrangeNodesResponse | null,
  fork: ForkDataResponse | null,
  now = Date.now(),
): ForkTopology {
  const coreTipOrange = orange
    ? { hash: orange.main.hash, height: orange.main.height }
    : null;
  const knotsTipOrange = orange
    ? { hash: orange.bip110.hash, height: orange.bip110.height }
    : null;

  let coreTip = coreTipOrange;
  let knotsTip = knotsTipOrange;

  if (fork) {
    const { core, knots } = findKnotsAndCoreNodes(fork.nodes);
    const c = activeTip(core);
    const k = activeTip(knots);
    // Prefer orange tips when present (fresher dual-node view); else fork.observer
    if (!coreTip && c) coreTip = { hash: c.hash, height: c.height };
    if (!knotsTip && k) knotsTip = { hash: k.hash, height: k.height };
  }

  if (!coreTip && !knotsTip) {
    return emptyTopology(now);
  }

  // If only one tip known, treat as agree on that tip
  if (!coreTip) coreTip = knotsTip;
  if (!knotsTip) knotsTip = coreTip;

  const agree =
    orange != null
      ? orangeTipsAgree(orange)
      : coreTip!.hash === knotsTip!.hash;

  const byHash = fork
    ? indexHeadersByHash(fork.header_infos)
    : new Map<string, ForkHeaderInfo>();
  const byId = fork
    ? indexHeadersById(fork.header_infos)
    : new Map<number, ForkHeaderInfo>();

  if (agree) {
    return buildAgreeTopology(coreTip!, byHash, byId, now);
  }

  return buildForkedTopology(coreTip!, knotsTip!, byHash, byId, now);
}

function emptyTopology(now: number): ForkTopology {
  return {
    status: 'unknown',
    shared: [],
    coreBranch: [],
    knotsBranch: [],
    commonAncestor: null,
    coreTip: null,
    knotsTip: null,
    deltaBlocks: 0,
    leader: null,
    reorgChancePercent: null,
    coreLabel: 'STANDARD',
    knotsLabel: 'BIP-110',
    updatedAt: now,
  };
}

function buildAgreeTopology(
  tip: { hash: string; height: number },
  byHash: Map<string, ForkHeaderInfo>,
  byId: Map<number, ForkHeaderInfo>,
  now: number,
): ForkTopology {
  const path = walkBack(byHash, tip.hash, SHARED_HISTORY_LEN + 2, byId);
  let shared: TopologyBlock[];

  if (path.length > 0) {
    shared = path
      .slice(0, SHARED_HISTORY_LEN)
      .reverse()
      .map((h) => headerToBlock(h, 'shared'));
  } else {
    // Sparse: invent a short height ladder ending at tip
    shared = [];
    for (let i = SHARED_HISTORY_LEN - 1; i >= 0; i--) {
      const height = tip.height - i;
      const isTip = i === 0;
      shared.push(
        tipOnlyBlock(
          isTip ? tip.hash : `unknown:${height}`,
          height,
          'shared',
          height > tip.height - (SHARED_HISTORY_LEN - 1)
            ? `unknown:${height - 1}`
            : null,
        ),
      );
    }
    // Fix tip hash on last
    shared[shared.length - 1] = tipOnlyBlock(tip.hash, tip.height, 'shared');
  }

  const last = shared[shared.length - 1]!;
  return {
    status: 'agree',
    shared,
    coreBranch: [],
    knotsBranch: [],
    commonAncestor: last,
    coreTip: tip,
    knotsTip: tip,
    deltaBlocks: 0,
    leader: null,
    reorgChancePercent: null,
    coreLabel: 'STANDARD',
    knotsLabel: 'BIP-110',
    updatedAt: now,
  };
}

function buildForkedTopology(
  coreTip: { hash: string; height: number },
  knotsTip: { hash: string; height: number },
  byHash: Map<string, ForkHeaderInfo>,
  byId: Map<number, ForkHeaderInfo>,
  now: number,
): ForkTopology {
  const corePath = walkBack(byHash, coreTip.hash, 128, byId);
  const knotsPath = walkBack(byHash, knotsTip.hash, 128, byId);

  let ancestorHash = findCommonAncestorHash(corePath, knotsPath);
  let sharedHeaders: ForkHeaderInfo[] = [];
  let coreBranchHeaders: ForkHeaderInfo[] = [];
  let knotsBranchHeaders: ForkHeaderInfo[] = [];

  if (ancestorHash) {
    sharedHeaders = sharedBeforeAncestor(
      corePath.length ? corePath : knotsPath,
      ancestorHash,
      SHARED_HISTORY_LEN,
    );
    coreBranchHeaders = branchAfterAncestor(corePath, ancestorHash);
    knotsBranchHeaders = branchAfterAncestor(knotsPath, ancestorHash);
  } else {
    // No overlapping headers in DAG — synthesize ancestor as min(height)-1
    // and put each tip alone on its branch.
    const ancHeight = Math.min(coreTip.height, knotsTip.height) - 1;
    ancestorHash = `synthetic-ancestor:${ancHeight}`;
    sharedHeaders = [];
    for (let i = SHARED_HISTORY_LEN - 1; i >= 0; i--) {
      const height = ancHeight - i;
      // We don't have real hashes; leave placeholders except we still need a block
      sharedHeaders.push({
        id: -1 - i,
        prev_id: -2 - i,
        height,
        hash: height === ancHeight ? ancestorHash : `synthetic:${height}`,
        version: 0x20000000,
        prev_blockhash: `synthetic:${height - 1}`,
        time: 0,
        miner: '',
      });
    }
    const coreH = byHash.get(coreTip.hash);
    const knotsH = byHash.get(knotsTip.hash);
    if (coreH) coreBranchHeaders = [coreH];
    else
      coreBranchHeaders = [
        {
          id: -100,
          prev_id: -1,
          height: coreTip.height,
          hash: coreTip.hash,
          version: 0x20000000,
          prev_blockhash: ancestorHash,
          time: 0,
          miner: '',
        },
      ];
    if (knotsH) knotsBranchHeaders = [knotsH];
    else
      knotsBranchHeaders = [
        {
          id: -101,
          prev_id: -1,
          height: knotsTip.height,
          hash: knotsTip.hash,
          version: BIP110_SIGNAL_VERSION_FALLBACK,
          prev_blockhash: ancestorHash,
          time: 0,
          miner: '',
        },
      ];
  }

  // Cap branch display length
  if (coreBranchHeaders.length > MAX_BRANCH_DISPLAY) {
    coreBranchHeaders = coreBranchHeaders.slice(-MAX_BRANCH_DISPLAY);
  }
  if (knotsBranchHeaders.length > MAX_BRANCH_DISPLAY) {
    knotsBranchHeaders = knotsBranchHeaders.slice(-MAX_BRANCH_DISPLAY);
  }

  const shared = sharedHeaders.map((h) => headerToBlock(h, 'shared'));
  const coreBranch = coreBranchHeaders.map((h) => headerToBlock(h, 'core'));
  const knotsBranch = knotsBranchHeaders.map((h) => headerToBlock(h, 'knots'));

  // Ensure tips are present even if walk missed them
  ensureTip(coreBranch, coreTip, 'core', ancestorHash);
  ensureTip(knotsBranch, knotsTip, 'knots', ancestorHash);

  const commonAncestor =
    shared[shared.length - 1] ??
    tipOnlyBlock(ancestorHash!, Math.min(coreTip.height, knotsTip.height) - 1, 'shared');

  const deltaBlocks = Math.abs(coreTip.height - knotsTip.height);
  let leader: ForkTopology['leader'] = null;
  if (coreTip.height > knotsTip.height) leader = 'core';
  else if (knotsTip.height > coreTip.height) leader = 'knots';

  return {
    status: 'forked',
    shared,
    coreBranch,
    knotsBranch,
    commonAncestor,
    coreTip,
    knotsTip,
    deltaBlocks,
    leader,
    reorgChancePercent:
      deltaBlocks > 0 ? approxReorgChancePercent(deltaBlocks) : 50,
    coreLabel: `STANDARD +${coreBranch.length}`,
    knotsLabel: `BIP-110 +${knotsBranch.length}`,
    updatedAt: now,
  };
}

/** Version with bit 4 set — used only for synthetic knots tip placeholder. */
const BIP110_SIGNAL_VERSION_FALLBACK = 0x20000000 | (1 << 4);

function ensureTip(
  branch: TopologyBlock[],
  tip: { hash: string; height: number },
  side: 'core' | 'knots',
  ancestorHash: string | null,
): void {
  if (branch.some((b) => b.hash === tip.hash)) return;
  const prev =
    branch.length > 0
      ? branch[branch.length - 1]!.hash
      : ancestorHash;
  branch.push(tipOnlyBlock(tip.hash, tip.height, side, prev));
}

/** Format reorg chance for status line. */
export function formatReorgChance(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct >= 1) return `${pct.toFixed(0)}%`;
  if (pct >= 0.1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}
