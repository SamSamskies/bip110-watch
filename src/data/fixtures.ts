import type { ForkDataResponse, ForkHeaderInfo } from '../lib/forkObserver';
import type { OrangeNodesResponse } from '../lib/orange';
import { buildTopology } from '../lib/topology';
import type { ForkTopology } from '../lib/types';

function hdr(
  id: number,
  prevId: number,
  height: number,
  hash: string,
  prev: string,
  version: number,
  miner: string,
): ForkHeaderInfo {
  return {
    id,
    prev_id: prevId,
    height,
    hash,
    version,
    prev_blockhash: prev,
    time: 1_700_000_000 + height,
    miner,
  };
}

const NOSIG = 0x20000000;
const SIG = 0x20000000 | (1 << 4);

/** In-agreement fixture: both tips at same hash. */
export function fixtureInAgreement(): {
  orange: OrangeNodesResponse;
  fork: ForkDataResponse;
  topology: ForkTopology;
} {
  const tipHash = '0000000000000000000aagree000000000000000000000000000000000001';
  const headers: ForkHeaderInfo[] = [];
  let prev = '0000000000000000000000000000000000000000000000000000000000000000';
  for (let h = 961610; h <= 961618; h++) {
    const hash =
      h === 961618
        ? tipHash
        : `0000000000000000000shared${String(h).padStart(8, '0')}000000000000`;
    headers.push(
      hdr(h, h - 1, h, hash, prev, NOSIG, h % 2 ? 'Foundry USA' : 'AntPool'),
    );
    prev = hash;
  }

  const orange: OrangeNodesResponse = {
    bip110: {
      chain: 'main',
      hash: tipHash,
      height: 961618,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: true,
      subversion: '/Satoshi:29.3.0/Knots:20260508/',
    },
    main: {
      chain: 'main',
      hash: tipHash,
      height: 961618,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: false,
      subversion: '/Satoshi:31.0.0/',
    },
    mandatoryHeight: 961632,
    rejected: [],
    schemaVersion: 1,
    status: 'agree',
    updated: Math.floor(Date.now() / 1000),
    lastKnownStatus: 'agree',
    stale: false,
  };

  const fork: ForkDataResponse = {
    header_infos: headers,
    nodes: [
      {
        id: 0,
        name: 'Bitcoin Core',
        tips: [{ hash: tipHash, height: 961618, status: 'active' }],
      },
      {
        id: 1,
        name: 'Knots BIP-110',
        tips: [{ hash: tipHash, height: 961618, status: 'active' }],
      },
    ],
    countdown: { height: 961632, label: 'mandatory BIP-110 signaling' },
  };

  return { orange, fork, topology: buildTopology(orange, fork) };
}

/**
 * Forked fixture matching the reference mock:
 * common ancestor 961631, standard +2 (632–633), BIP-110 +1 (632).
 */
export function fixtureForkedCoreAhead(): {
  orange: OrangeNodesResponse;
  fork: ForkDataResponse;
  topology: ForkTopology;
} {
  const headers: ForkHeaderInfo[] = [];
  let prev = '0000000000000000000000000000000000000000000000000000000000000000';

  // Shared 961625–961631
  const sharedHashes: string[] = [];
  for (let h = 961625; h <= 961631; h++) {
    const hash = `0000000000000000000common${String(h).padStart(6, '0')}aaaaaaaaaaaa`;
    sharedHashes.push(hash);
    headers.push(
      hdr(h, h - 1, h, hash, prev, NOSIG, 'ViaBTC'),
    );
    prev = hash;
  }
  const ancestor = sharedHashes[sharedHashes.length - 1]!;

  const core632 = '0000000000000000000core632bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const core633 = '0000000000000000000core633cccccccccccccccccccccccccccccc';
  const knots632 = '0000000000000000000knots632dddddddddddddddddddddddddddd';

  headers.push(hdr(9616320, 961631, 961632, core632, ancestor, NOSIG, 'Foundry USA'));
  headers.push(hdr(9616330, 9616320, 961633, core633, core632, NOSIG, 'AntPool'));
  headers.push(hdr(9616321, 961631, 961632, knots632, ancestor, SIG, 'OCEAN'));

  const orange: OrangeNodesResponse = {
    bip110: {
      chain: 'main',
      hash: knots632,
      height: 961632,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: true,
      subversion: '/Satoshi:29.3.0/Knots:20260508/',
    },
    main: {
      chain: 'main',
      hash: core633,
      height: 961633,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: false,
      subversion: '/Satoshi:31.0.0/',
    },
    mandatoryHeight: 961632,
    rejected: [],
    schemaVersion: 1,
    status: 'forked',
    updated: Math.floor(Date.now() / 1000),
    lastKnownStatus: 'forked',
    stale: false,
  };

  const fork: ForkDataResponse = {
    header_infos: headers,
    nodes: [
      {
        id: 0,
        name: 'Bitcoin Core',
        tips: [{ hash: core633, height: 961633, status: 'active' }],
      },
      {
        id: 1,
        name: 'Knots BIP-110',
        tips: [{ hash: knots632, height: 961632, status: 'active' }],
      },
    ],
    countdown: { height: 961632, label: 'mandatory BIP-110 signaling' },
  };

  return { orange, fork, topology: buildTopology(orange, fork) };
}

/**
 * Long forked fixture to exercise branch truncation UI:
 * common ancestor 961631, standard +14, BIP-110 +3.
 */
export function fixtureForkedLongBranches(): {
  orange: OrangeNodesResponse;
  fork: ForkDataResponse;
  topology: ForkTopology;
} {
  const headers: ForkHeaderInfo[] = [];
  const ancestor = '0000000000000000000common961631aaaaaaaaaaaaaaaaaaaaaa';
  headers.push(
    hdr(961631, 961630, 961631, ancestor, 'prev-ancestor', NOSIG, 'ViaBTC'),
  );

  let prevCore = ancestor;
  let coreTipHash = ancestor;
  let coreTipHeight = 961631;
  for (let h = 961632; h <= 961645; h++) {
    const hash = `0000000000000000000core${String(h).padStart(6, '0')}bbbbbbbbbbbbbb`;
    headers.push(
      hdr(
        h * 10,
        h === 961632 ? 961631 : (h - 1) * 10,
        h,
        hash,
        prevCore,
        NOSIG,
        'Foundry USA',
      ),
    );
    prevCore = hash;
    coreTipHash = hash;
    coreTipHeight = h;
  }

  let prevKnots = ancestor;
  let knotsTipHash = ancestor;
  let knotsTipHeight = 961631;
  for (let h = 961632; h <= 961634; h++) {
    const hash = `0000000000000000000knots${String(h).padStart(6, '0')}dddddddddddddd`;
    headers.push(
      hdr(
        h * 10 + 1,
        h === 961632 ? 961631 : (h - 1) * 10 + 1,
        h,
        hash,
        prevKnots,
        SIG,
        'OCEAN',
      ),
    );
    prevKnots = hash;
    knotsTipHash = hash;
    knotsTipHeight = h;
  }

  const orange: OrangeNodesResponse = {
    bip110: {
      chain: 'main',
      hash: knotsTipHash,
      height: knotsTipHeight,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: true,
      subversion: '/Satoshi:29.3.0/Knots:20260508/',
    },
    main: {
      chain: 'main',
      hash: coreTipHash,
      height: coreTipHeight,
      ibd: false,
      ok: true,
      progress: 1,
      pruned: false,
      subversion: '/Satoshi:31.0.0/',
    },
    mandatoryHeight: 961632,
    rejected: [],
    schemaVersion: 1,
    status: 'forked',
    updated: Math.floor(Date.now() / 1000),
    lastKnownStatus: 'forked',
    stale: false,
  };

  const fork: ForkDataResponse = {
    header_infos: headers,
    nodes: [
      {
        id: 0,
        name: 'Bitcoin Core',
        tips: [{ hash: coreTipHash, height: coreTipHeight, status: 'active' }],
      },
      {
        id: 1,
        name: 'Knots BIP-110',
        tips: [
          { hash: knotsTipHash, height: knotsTipHeight, status: 'active' },
        ],
      },
    ],
  };

  return { orange, fork, topology: buildTopology(orange, fork) };
}
