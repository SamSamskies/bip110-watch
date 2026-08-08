import { afterEach, describe, expect, it } from 'vitest';
import {
  clearFilledHeaders,
  findPathGaps,
  fillStandardPathGaps,
  mergeFilledHeaders,
  seedFilledHeader,
  esploraBlockToHeader,
} from './headerFill';
import type { ForkDataResponse, ForkHeaderInfo } from './forkObserver';
import type { EsploraBlock } from './esplora';
import { buildTopology } from './topology';

function hdr(
  id: number,
  prevId: number,
  height: number,
  hash: string,
  prev: string,
): ForkHeaderInfo {
  return {
    id,
    prev_id: prevId,
    height,
    hash,
    version: 0x20000000,
    prev_blockhash: prev,
    time: 0,
    miner: '',
  };
}

afterEach(() => {
  clearFilledHeaders();
});

describe('findPathGaps', () => {
  it('finds a height jump between bordering headers', () => {
    const path = [
      hdr(3, 2, 644, 'h644', 'h643'),
      hdr(2, 1, 634, 'h634', 'h633'),
      hdr(1, 0, 633, 'h633', 'h632'),
    ];
    expect(findPathGaps(path)).toEqual([
      { startHash: 'h643', untilHash: 'h634', untilHeight: 634 },
    ]);
  });
});

describe('fillStandardPathGaps', () => {
  it('merges session cache and walks filled prev hashes', async () => {
    const ancestor = 'h631';
    const c632 = 'h632';
    const c634 = 'h634';
    const c644 = 'h644';
    const k632 = 'k632';

    // Sparse: 644.prev_id → 634, but prev_blockhash → 643
    const fork: ForkDataResponse = {
      header_infos: [
        hdr(1, 0, 631, ancestor, 'h630'),
        hdr(2, 1, 632, c632, ancestor),
        hdr(3, 2, 634, c634, c632),
        hdr(4, 3, 644, c644, 'h643'),
        hdr(5, 1, 632, k632, ancestor),
      ],
      nodes: [
        {
          id: 0,
          name: 'Bitcoin Core',
          tips: [{ hash: c644, height: 644, status: 'active' }],
        },
        {
          id: 1,
          name: 'Knots BIP-110',
          tips: [{ hash: k632, height: 632, status: 'active' }],
        },
      ],
    };

    const blocks: Record<string, EsploraBlock> = {};
    for (let h = 643; h >= 635; h--) {
      const hash = `h${h}`;
      const prev = h === 635 ? c634 : `h${h - 1}`;
      blocks[hash] = {
        id: hash,
        height: h,
        version: 0x20000000,
        timestamp: 0,
        tx_count: 1,
        size: 1,
        weight: 1,
        merkle_root: '',
        previousblockhash: prev,
      };
    }

    const result = await fillStandardPathGaps(
      fork,
      c644,
      async (hash) => {
        const b = blocks[hash];
        if (!b) throw new Error(`unexpected fetch ${hash}`);
        return b;
      },
      async () => ({
        vin: [
          {
            is_coinbase: true,
            scriptsig: Buffer.from('Mined by AntPool', 'utf8').toString('hex'),
          },
        ],
        vout: [{ scriptpubkey_address: '12dRugNcdxK39288NjcDV4GX7rMsKCGn6B' }],
      }),
    );

    expect(result.filled).toBe(9);
    expect(result.minersUpdated).toBe(9);
    expect(
      result.fork.header_infos.find((h) => h.hash === 'h643')?.miner,
    ).toBe('AntPool');
    expect(result.fork.header_infos.some((h) => h.hash === 'h643')).toBe(true);
    expect(result.fork.header_infos.some((h) => h.hash === 'h635')).toBe(true);

    const orange = {
      main: {
        chain: 'main',
        hash: c644,
        height: 644,
        ibd: false,
        ok: true,
        progress: 1,
        pruned: false,
        subversion: '',
      },
      bip110: {
        chain: 'main',
        hash: k632,
        height: 632,
        ibd: false,
        ok: true,
        progress: 1,
        pruned: true,
        subversion: '',
      },
      mandatoryHeight: 961632,
      rejected: [],
      schemaVersion: 1,
      status: 'forked',
      updated: 0,
    };

    const topology = buildTopology(orange, result.fork);
    expect(topology.coreBranch.map((b) => b.height)).toEqual([
      632, 634, 635, 636, 637, 638, 639, 640, 641, 642, 643, 644,
    ]);
  });

  it('reuses the session cache without re-fetching', async () => {
    seedFilledHeader(
      esploraBlockToHeader(
        {
          id: 'h643',
          height: 643,
          version: 0x20000000,
          timestamp: 0,
          tx_count: 1,
          size: 1,
          weight: 1,
          merkle_root: '',
          previousblockhash: 'h642',
        },
        'AntPool',
      ),
    );

    const fork: ForkDataResponse = {
      header_infos: [
        hdr(1, 0, 642, 'h642', 'h641'),
        hdr(2, 1, 644, 'h644', 'h643'),
      ],
      nodes: [],
    };

    let fetches = 0;
    const merged = mergeFilledHeaders(fork);
    expect(merged.header_infos.some((h) => h.hash === 'h643')).toBe(true);

    const result = await fillStandardPathGaps(
      merged,
      'h644',
      async () => {
        fetches += 1;
        throw new Error('should not fetch');
      },
      async () => {
        fetches += 1;
        throw new Error('should not fetch coinbase');
      },
    );
    expect(fetches).toBe(0);
    expect(result.filled).toBe(0);
  });
});
