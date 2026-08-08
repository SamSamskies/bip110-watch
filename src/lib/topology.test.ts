import { describe, expect, it } from 'vitest';
import {
  approxReorgChancePercent,
  signalsBip110,
  signalStatus,
  MANDATORY_START,
  blocksUntilMandatory,
} from './bip110';
import { buildTopology, formatReorgChance } from './topology';
import {
  fixtureForkedCoreAhead,
  fixtureInAgreement,
} from '../data/fixtures';

describe('bip110 helpers', () => {
  it('detects version bit 4', () => {
    expect(signalsBip110(0x20000000)).toBe(false);
    expect(signalsBip110(0x20000000 | (1 << 4))).toBe(true);
    expect(signalStatus(null)).toBe('unknown');
    expect(signalStatus(0x20000010)).toBe('bip110');
  });

  it('counts blocks until mandatory', () => {
    expect(blocksUntilMandatory(MANDATORY_START)).toBe(0);
    expect(blocksUntilMandatory(MANDATORY_START - 10)).toBe(10);
  });

  it('approx reorg chance shrinks with lead', () => {
    expect(approxReorgChancePercent(0)).toBe(50);
    expect(approxReorgChancePercent(1)).toBeCloseTo(25, 5);
    expect(approxReorgChancePercent(1)).toBeGreaterThan(
      approxReorgChancePercent(2),
    );
    expect(formatReorgChance(0.07)).toBe('0.07%');
  });
});

describe('topology buildTopology', () => {
  it('builds in-agreement shared chain', () => {
    const { orange, fork, topology } = fixtureInAgreement();
    expect(orange.main.hash).toBe(orange.bip110.hash);
    expect(topology.status).toBe('agree');
    expect(topology.coreBranch).toHaveLength(0);
    expect(topology.knotsBranch).toHaveLength(0);
    expect(topology.shared.length).toBeGreaterThan(0);
    expect(topology.commonAncestor?.hash).toBe(orange.main.hash);
    expect(topology.deltaBlocks).toBe(0);
    void fork;
  });

  it('builds forked standard-ahead topology like the reference', () => {
    const { topology } = fixtureForkedCoreAhead();
    expect(topology.status).toBe('forked');
    expect(topology.leader).toBe('core');
    expect(topology.deltaBlocks).toBe(1);
    expect(topology.commonAncestor?.height).toBe(961631);

    expect(topology.coreBranch).toHaveLength(2);
    expect(topology.knotsBranch).toHaveLength(1);
    expect(topology.coreLabel).toBe('STANDARD +2');
    expect(topology.knotsLabel).toBe('BIP-110 +1');

    // BIP-110 tip signals
    expect(topology.knotsBranch[0]?.signals).toBe(true);
    // Standard branch does not
    expect(topology.coreBranch.every((b) => !b.signals)).toBe(true);

    expect(topology.reorgChancePercent).toBeCloseTo(25, 5);
  });

  it('handles missing fork DAG with orange tips only', () => {
    const { orange } = fixtureForkedCoreAhead();
    const topology = buildTopology(orange, null);
    expect(topology.status).toBe('forked');
    expect(topology.coreTip?.height).toBe(961633);
    expect(topology.knotsTip?.height).toBe(961632);
    expect(topology.shared.length).toBeGreaterThan(0);
  });
});
