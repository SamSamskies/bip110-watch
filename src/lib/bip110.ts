/** BIP-110 (reduced_data) deployment constants and bit-4 helpers. */

export const BIP110_BIT = 4;
export const BIP110_BIT_MASK = 1 << BIP110_BIT;
export const BIP110_THRESHOLD = 1109;
export const BIP110_PERIOD = 2016;
export const MANDATORY_START = 961_632;
export const MANDATORY_END = 963_647;
export const LOCK_IN_HEIGHT = 963_648;
export const MAX_ACTIVATION_HEIGHT = 965_664;

export type SignalStatus = 'bip110' | 'no_signal' | 'unknown';

/** True when nVersion signals BIP-110 version bit 4 (BIP9-style). */
export function signalsBip110(version: number | null | undefined): boolean {
  if (version == null || !Number.isFinite(version)) return false;
  return (version & BIP110_BIT_MASK) !== 0;
}

export function signalStatus(version: number | null | undefined): SignalStatus {
  if (version == null || !Number.isFinite(version)) return 'unknown';
  return signalsBip110(version) ? 'bip110' : 'no_signal';
}

export function blocksUntilMandatory(tipHeight: number): number {
  return Math.max(0, MANDATORY_START - tipHeight);
}

export function isInMandatoryWindow(height: number): boolean {
  return height >= MANDATORY_START && height <= MANDATORY_END;
}

/**
 * Approximate probability that the trailing chain catches up and reorgs the
 * leader, assuming equal hashrate and a simple race (trailing needs Δ+1 blocks
 * before leader finds another). Uses P(reorg) ≈ 1 / 2^(Δ+1).
 * Returned as a percentage 0–100. Label as approximate in the UI.
 */
export function approxReorgChancePercent(leadBlocks: number): number {
  const delta = Math.max(0, Math.floor(leadBlocks));
  if (delta === 0) return 50;
  const p = 1 / 2 ** (delta + 1);
  return Math.min(100, Math.max(0, p * 100));
}

export function formatHeight(height: number): string {
  return height.toLocaleString('en-US');
}

export function shortHash(hash: string, head = 16, tail = 12): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}
