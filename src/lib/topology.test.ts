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
    expect(topology.shared).toHaveLength(1);
    expect(topology.shared[0]?.height).toBe(961631);

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

  it('walks sparse fork.observer DAG via prev_id when prev_blockhash gaps', () => {
    // Mirrors live fork.observer: height 635 omitted, 636.prev_blockhash missing
    // from header_infos, but prev_id still links 636 → 634 → … → ancestor.
    const ancestor = 'aaa0000000000000000000000000000000000000000000000000000000000631';
    const c632 = 'bbb0000000000000000000000000000000000000000000000000000000000632';
    const c633 = 'bbb0000000000000000000000000000000000000000000000000000000000633';
    const c634 = 'bbb0000000000000000000000000000000000000000000000000000000000634';
    const c636 = 'bbb0000000000000000000000000000000000000000000000000000000000636';
    const k632 = 'ccc0000000000000000000000000000000000000000000000000000000000632';
    const missing635 = 'ddd0000000000000000000000000000000000000000000000000000000000635';

    const headers = [
      {
        id: 105,
        prev_id: 104,
        height: 961631,
        hash: ancestor,
        version: 0x20000000,
        prev_blockhash: 'prev-of-ancestor',
        time: 0,
        miner: '',
      },
      {
        id: 106,
        prev_id: 105,
        height: 961632,
        hash: c632,
        version: 0x20000000,
        prev_blockhash: ancestor,
        time: 0,
        miner: '',
      },
      {
        id: 108,
        prev_id: 106,
        height: 961633,
        hash: c633,
        version: 0x20000000,
        prev_blockhash: c632,
        time: 0,
        miner: '',
      },
      {
        id: 109,
        prev_id: 108,
        height: 961634,
        hash: c634,
        version: 0x20000000,
        prev_blockhash: c633,
        time: 0,
        miner: '',
      },
      {
        id: 110,
        prev_id: 109,
        height: 961636,
        hash: c636,
        version: 0x20000000,
        prev_blockhash: missing635, // not in header_infos
        time: 0,
        miner: '',
      },
      {
        id: 107,
        prev_id: 105,
        height: 961632,
        hash: k632,
        version: 0x20000000 | (1 << 4),
        prev_blockhash: ancestor,
        time: 0,
        miner: '',
      },
    ];

    const baseOrange = fixtureForkedCoreAhead().orange;
    const orange = {
      ...baseOrange,
      main: { ...baseOrange.main, hash: c636, height: 961636 },
      bip110: { ...baseOrange.bip110, hash: k632, height: 961632 },
      status: 'forked',
    };

    const fork = {
      header_infos: headers,
      nodes: [
        {
          id: 0,
          name: 'Bitcoin Core',
          tips: [{ hash: c636, height: 961636, status: 'active' }],
        },
        {
          id: 1,
          name: 'Knots BIP-110',
          tips: [{ hash: k632, height: 961632, status: 'active' }],
        },
      ],
    };

    const topology = buildTopology(orange, fork);
    expect(topology.status).toBe('forked');
    expect(topology.commonAncestor?.height).toBe(961631);
    expect(topology.coreBranch.map((b) => b.height)).toEqual([
      961632, 961633, 961634, 961636,
    ]);
    expect(topology.knotsBranch.map((b) => b.height)).toEqual([961632]);
  });
});
