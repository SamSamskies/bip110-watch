import { useEffect, useState } from 'react';
import { formatHeight } from '../lib/bip110';
import type { ForkTopology } from '../lib/types';

type Props = {
  topology: ForkTopology | null;
  lastSuccessAt: number | null;
  error: string | null;
  source: string;
};

export function StatusBar({
  topology,
  lastSuccessAt,
  error,
  source,
}: Props) {
  const tip =
    topology?.coreTip?.height ?? topology?.knotsTip?.height ?? null;
  const ageLabel = useDataAge(lastSuccessAt);

  return (
    <div className="status-bar">
      <div className="stat">
        <span className="stat-label">Tip</span>
        <span className="stat-value">
          {tip != null ? formatHeight(tip) : '—'}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Updated</span>
        <span className="stat-value">
          {ageLabel}
          {source !== 'live' ? ` · mock` : ''}
        </span>
      </div>
      {error ? <p className="status-error">{error}</p> : null}
    </div>
  );
}

function useDataAge(lastSuccessAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lastSuccessAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastSuccessAt]);

  if (lastSuccessAt == null) return '—';
  return formatAge(now - lastSuccessAt);
}

/** Compact relative age for live status (e.g. "just now", "5s ago"). */
export function formatAge(ageMs: number): string {
  const sec = Math.max(0, Math.floor(ageMs / 1000));
  if (sec < 2) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
