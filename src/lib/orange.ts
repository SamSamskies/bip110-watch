import { fetchJson } from './fetch';

export type OrangeNodeTip = {
  chain: string;
  hash: string;
  height: number;
  ibd: boolean;
  ok: boolean;
  progress: number;
  pruned: boolean;
  subversion: string;
};

export type OrangeNodesResponse = {
  bip110: OrangeNodeTip;
  main: OrangeNodeTip;
  mandatoryHeight: number;
  rejected: unknown[];
  schemaVersion: number;
  status: string;
  updated: number;
  receivedAt?: number;
  ageSeconds?: number;
  lastKnownStatus?: string;
  stale?: boolean;
};

export type OrangeSignalingResponse = {
  bit: number;
  tip: number;
  epochStart: number;
  scanned: number;
  signals: string;
  poolNames: string[];
  blockPools: number[];
  blockIds: string[];
  updated: string;
  pools: Record<string, unknown>;
};

const ORANGE_BASE = '/proxy/orange';

export async function fetchOrangeNodes(): Promise<OrangeNodesResponse> {
  return fetchJson<OrangeNodesResponse>(`${ORANGE_BASE}/nodes`);
}

export async function fetchOrangeSignaling(): Promise<OrangeSignalingResponse> {
  return fetchJson<OrangeSignalingResponse>(`${ORANGE_BASE}/signaling`);
}

export function orangeTipsAgree(nodes: OrangeNodesResponse): boolean {
  return (
    nodes.main.hash === nodes.bip110.hash &&
    nodes.main.height === nodes.bip110.height
  );
}
