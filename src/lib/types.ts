export const REQUEST_TIMEOUT_MS = 10_000;

export const ESPLORA_HOSTS = [
  'https://mempool.bitaroo.net',
  'https://mempool.emzy.de',
  'https://mempool.space',
  'https://blockstream.info',
] as const;

/** Shared path length: ancestor only when forked; tip only when tips agree. */
export const SHARED_HISTORY_LEN = 1;
/** Blocks kept right after the fork when a lane is collapsed. */
export const BRANCH_HEAD_DISPLAY = 3;
/** Most-recent blocks kept at the tip when a lane is collapsed. */
export const BRANCH_TIP_DISPLAY = 3;

export type ChainSide = 'core' | 'knots' | 'shared';

export type TopologyBlock = {
  hash: string;
  height: number;
  prevHash: string | null;
  version: number | null;
  time: number | null;
  miner: string | null;
  /** Observed on this side of the fork (or shared). */
  side: ChainSide;
  signals: boolean;
};

export type ForkTopology = {
  status: 'agree' | 'forked' | 'unknown';
  shared: TopologyBlock[];
  coreBranch: TopologyBlock[];
  knotsBranch: TopologyBlock[];
  commonAncestor: TopologyBlock | null;
  coreTip: { hash: string; height: number } | null;
  knotsTip: { hash: string; height: number } | null;
  /** Absolute height lead of the longer tip over the shorter. */
  deltaBlocks: number;
  /** Which tip is ahead when forked. */
  leader: ChainSide | null;
  /** Approx % chance the trailing side reorgs the leader (equal hashrate). */
  reorgChancePercent: number | null;
  coreLabel: string;
  knotsLabel: string;
  updatedAt: number;
};
