import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchOrangeNodes,
  orangeTipsAgree,
  type OrangeNodesResponse,
} from '../lib/orange';
import { fetchForkData, type ForkDataResponse } from '../lib/forkObserver';
import { buildTopology } from '../lib/topology';
import type { ForkTopology } from '../lib/types';
import {
  fixtureForkedCoreAhead,
  fixtureForkedLongBranches,
  fixtureInAgreement,
} from '../data/fixtures';
import {
  activeEsploraHostName,
  fetchRecentBlocks,
  type EsploraBlock,
} from '../lib/esplora';

export type MonitorSource =
  | 'live'
  | 'mock-forked'
  | 'mock-agree'
  | 'mock-long';

export type ForkMonitorState = {
  topology: ForkTopology | null;
  orange: OrangeNodesResponse | null;
  fork: ForkDataResponse | null;
  esploraHost: string | null;
  loading: boolean;
  error: string | null;
  source: MonitorSource;
};

const initial: ForkMonitorState = {
  topology: null,
  orange: null,
  fork: null,
  esploraHost: null,
  loading: true,
  error: null,
  source: 'live',
};

function readSourceParam(): MonitorSource {
  if (typeof window === 'undefined') return 'live';
  const q = new URLSearchParams(window.location.search).get('mock');
  if (q === 'forked') return 'mock-forked';
  if (q === 'agree') return 'mock-agree';
  if (q === 'long') return 'mock-long';
  return 'live';
}

export function useForkMonitor(): ForkMonitorState & {
  refresh: () => void;
} {
  const [state, setState] = useState<ForkMonitorState>(() => ({
    ...initial,
    source: readSourceParam(),
  }));
  const orangeRef = useRef<OrangeNodesResponse | null>(null);
  const forkRef = useRef<ForkDataResponse | null>(null);
  /** Bumps on each live load so stale Strict Mode / HMR fetches cannot apply. */
  const loadGen = useRef(0);

  const applyTopology = useCallback(
    (
      orange: OrangeNodesResponse | null,
      fork: ForkDataResponse | null,
      patch: Partial<ForkMonitorState> = {},
    ) => {
      // Never clear last-good refs on a partial/null apply (failed sibling fetch).
      if (orange) orangeRef.current = orange;
      if (fork) forkRef.current = fork;
      const orangeNext = orange ?? orangeRef.current;
      const topology = buildTopology(orangeNext, fork);
      setState((prev) => ({
        ...prev,
        orange: orangeNext,
        fork,
        topology,
        loading: false,
        error: patch.error !== undefined ? patch.error : prev.error,
        ...patch,
      }));
    },
    [],
  );

  const loadLive = useCallback(async () => {
    const gen = ++loadGen.current;
    orangeRef.current = null;
    forkRef.current = null;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      esploraHost: null,
      source: 'live',
    }));

    const isCurrent = () => gen === loadGen.current;

    const orangePromise = fetchOrangeNodes()
      .then((orange) => {
        if (!isCurrent()) return;
        orangeRef.current = orange;
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        return err instanceof Error ? err.message : String(err);
      });

    const forkPromise = fetchForkData()
      .then((fork) => {
        if (!isCurrent()) return;
        forkRef.current = fork;
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        return err instanceof Error ? err.message : String(err);
      });

    const [orangeErr, forkErr] = await Promise.all([
      orangePromise,
      forkPromise,
    ]);
    if (!isCurrent()) return;

    const orange = orangeRef.current;
    const fork = forkRef.current;

    if (orange || fork) {
      // Prefer full DAG when tips diverge; orange-only stubs only if fork failed.
      if (
        orange &&
        !fork &&
        !orangeTipsAgree(orange)
      ) {
        // Keep loading until we decide — show orange tips once fork is known null.
        applyTopology(orange, null, {
          error: null,
          esploraHost: null,
        });
        return;
      }
      applyTopology(orange, fork, {
        error: null,
        esploraHost: null,
      });
      return;
    }

    // Both proxies failed — try Esplora once for a tip-only agree view.
    try {
      const blocks: EsploraBlock[] = await fetchRecentBlocks();
      if (!isCurrent()) return;
      if (blocks[0]) {
        const tip = blocks[0];
        const syntheticOrange: OrangeNodesResponse = {
          bip110: {
            chain: 'main',
            hash: tip.id,
            height: tip.height,
            ibd: false,
            ok: true,
            progress: 1,
            pruned: false,
            subversion: 'esplora-fallback',
          },
          main: {
            chain: 'main',
            hash: tip.id,
            height: tip.height,
            ibd: false,
            ok: true,
            progress: 1,
            pruned: false,
            subversion: 'esplora-fallback',
          },
          mandatoryHeight: 961632,
          rejected: [],
          schemaVersion: 1,
          status: 'agree',
          updated: Math.floor(Date.now() / 1000),
        };
        applyTopology(syntheticOrange, null, {
          esploraHost: activeEsploraHostName(),
          error: 'Using Esplora fallback (orange/fork proxies unavailable)',
        });
        return;
      }
    } catch {
      /* ignore */
    }

    if (!isCurrent()) return;
    setState((prev) => ({
      ...prev,
      loading: false,
      error:
        (typeof orangeErr === 'string' && orangeErr) ||
        (typeof forkErr === 'string' && forkErr) ||
        'Failed to load topology',
      esploraHost: null,
    }));
  }, [applyTopology]);

  const refresh = useCallback(() => {
    const source = readSourceParam();
    if (source === 'mock-forked') {
      loadGen.current += 1;
      const { orange, fork, topology } = fixtureForkedCoreAhead();
      orangeRef.current = orange;
      forkRef.current = fork;
      setState({
        ...initial,
        source,
        orange,
        fork,
        topology,
        loading: false,
        error: null,
      });
      return;
    }
    if (source === 'mock-agree') {
      loadGen.current += 1;
      const { orange, fork, topology } = fixtureInAgreement();
      orangeRef.current = orange;
      forkRef.current = fork;
      setState({
        ...initial,
        source,
        orange,
        fork,
        topology,
        loading: false,
        error: null,
      });
      return;
    }
    if (source === 'mock-long') {
      loadGen.current += 1;
      const { orange, fork, topology } = fixtureForkedLongBranches();
      orangeRef.current = orange;
      forkRef.current = fork;
      setState({
        ...initial,
        source,
        orange,
        fork,
        topology,
        loading: false,
        error: null,
      });
      return;
    }
    void loadLive();
  }, [loadLive]);

  useEffect(() => {
    refresh();
    return () => {
      // Invalidate in-flight work from this mount (Strict Mode remount / unmount).
      loadGen.current += 1;
    };
  }, [refresh]);

  return { ...state, refresh };
}
