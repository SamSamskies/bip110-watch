export const REQUEST_TIMEOUT_MS = 10_000;
/** Tip status — small payload; keep relatively fresh while tab is visible. */
export const ORANGE_NODES_INTERVAL_MS = 15_000;
/** Fork DAG (~100KB) — blocks arrive ~10m; poll slowly to spare Vercel origin transfer. */
export const FORK_DATA_INTERVAL_MS = 90_000;
export const ESPLORA_INTERVAL_MS = 60_000;

export const ESPLORA_HOSTS = [
  'https://mempool.bitaroo.net',
  'https://mempool.emzy.de',
  'https://mempool.space',
  'https://blockstream.info',
] as const;

export const SHARED_HISTORY_LEN = 7;
export const MAX_BRANCH_DISPLAY = 6;

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
