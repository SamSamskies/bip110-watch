import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ESPLORA_INTERVAL_MS,
  FORK_DATA_INTERVAL_MS,
  ORANGE_NODES_INTERVAL_MS,
} from '../lib/types';
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
import { fillStandardPathGaps, mergeFilledHeaders } from '../lib/headerFill';

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
  lastSuccessAt: number | null;
  source: MonitorSource;
};

const initial: ForkMonitorState = {
  topology: null,
  orange: null,
  fork: null,
  esploraHost: null,
  loading: true,
  error: null,
  lastSuccessAt: null,
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
  const orangeInflight = useRef(false);
  const forkInflight = useRef(false);
  const orangeRef = useRef<OrangeNodesResponse | null>(null);
  const forkRef = useRef<ForkDataResponse | null>(null);

  const applyTopology = useCallback(
    (
      orange: OrangeNodesResponse | null,
      fork: ForkDataResponse | null,
      patch: Partial<ForkMonitorState> = {},
    ) => {
      // Never clear last-good refs on a partial/null apply (failed sibling poll).
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
        lastSuccessAt: Date.now(),
        error: patch.error !== undefined ? patch.error : prev.error,
        ...patch,
      }));
    },
    [],
  );

  /** Paint DAG immediately; Esplora-fill standard-path holes in the background. */
  const enrichAndApply = useCallback(
    async (
      orange: OrangeNodesResponse | null,
      fork: ForkDataResponse | null,
      patch: Partial<ForkMonitorState> = {},
    ) => {
      if (!fork) {
        applyTopology(orange, null, patch);
        return;
      }

      let merged = mergeFilledHeaders(fork);
      applyTopology(orange, merged, patch);

      const tipHash = orange?.main.hash;
      if (!tipHash) return;

      try {
        const result = await fillStandardPathGaps(merged, tipHash);
        if (result.filled > 0 || result.minersUpdated > 0) {
          // Re-read tip in case a newer orange poll landed during the fill.
          applyTopology(orangeRef.current, result.fork, {
            ...patch,
            ...(result.host ? { esploraHost: result.host } : {}),
          });
        }
      } catch {
        /* keep sparse topology */
      }
    },
    [applyTopology],
  );

  const pollOrange = useCallback(async () => {
    if (orangeInflight.current) return;
    orangeInflight.current = true;
    try {
      const orange = await fetchOrangeNodes();
      // Diverged tips without a DAG would paint a tip-only gap flash — wait for fork.
      if (!forkRef.current && !orangeTipsAgree(orange)) {
        orangeRef.current = orange;
        setState((prev) => ({
          ...prev,
          orange,
          error: null,
          loading: prev.topology == null ? true : prev.loading,
        }));
        return;
      }
      await enrichAndApply(orange, forkRef.current, { error: null });
    } catch (err) {
      // Keep last-good topology; only surface the error if we have nothing yet.
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          prev.topology != null
            ? prev.error
            : err instanceof Error
              ? err.message
              : String(err),
      }));
    } finally {
      orangeInflight.current = false;
    }
  }, [enrichAndApply]);

  const pollFork = useCallback(async () => {
    if (forkInflight.current) return;
    forkInflight.current = true;
    try {
      const fork = await fetchForkData();
      await enrichAndApply(orangeRef.current, fork, { error: null });
    } catch (err) {
      if (forkRef.current) {
        // Keep last-good DAG — do not wipe to orange-only tip stubs.
        setState((prev) => ({
          ...prev,
          loading: false,
        }));
      } else if (orangeRef.current) {
        await enrichAndApply(orangeRef.current, null, { error: null });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error ? err.message : String(err),
        }));
      }
    } finally {
      forkInflight.current = false;
    }
  }, [enrichAndApply]);

  const pollEsploraFallback = useCallback(async () => {
    if (orangeRef.current || forkRef.current) return;
    try {
      const blocks: EsploraBlock[] = await fetchRecentBlocks();
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
      }
    } catch {
      /* ignore */
    }
  }, [applyTopology]);

  const refresh = useCallback(() => {
    const source = readSourceParam();
    if (source === 'mock-forked') {
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
        lastSuccessAt: Date.now(),
        error: null,
      });
      return;
    }
    if (source === 'mock-agree') {
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
        lastSuccessAt: Date.now(),
        error: null,
      });
      return;
    }
    if (source === 'mock-long') {
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
        lastSuccessAt: Date.now(),
        error: null,
      });
      return;
    }
    void pollOrange();
    void pollFork();
  }, [pollOrange, pollFork]);

  useEffect(() => {
    const source = readSourceParam();
    if (source !== 'live') {
      refresh();
      return;
    }

    let orangeTimer: number | undefined;
    let forkTimer: number | undefined;
    let esploraTimer: number | undefined;

    const clearTimers = () => {
      if (orangeTimer !== undefined) window.clearInterval(orangeTimer);
      if (forkTimer !== undefined) window.clearInterval(forkTimer);
      if (esploraTimer !== undefined) window.clearInterval(esploraTimer);
      orangeTimer = undefined;
      forkTimer = undefined;
      esploraTimer = undefined;
    };

    const startTimers = () => {
      clearTimers();
      orangeTimer = window.setInterval(
        () => void pollOrange(),
        ORANGE_NODES_INTERVAL_MS,
      );
      forkTimer = window.setInterval(
        () => void pollFork(),
        FORK_DATA_INTERVAL_MS,
      );
      esploraTimer = window.setInterval(
        () => void pollEsploraFallback(),
        ESPLORA_INTERVAL_MS,
      );
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        startTimers();
      } else {
        clearTimers();
      }
    };

    // One fetch on mount so a briefly-hidden first paint still gets data.
    refresh();
    if (document.visibilityState === 'visible') {
      startTimers();
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, pollOrange, pollFork, pollEsploraFallback]);

  return { ...state, refresh };
}
