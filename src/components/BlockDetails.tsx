import { formatHeight, shortHash, signalStatus } from '../lib/bip110';
import type { TopologyBlock } from '../lib/types';

type Props = {
  block: TopologyBlock | null;
  onClose: () => void;
};

export function BlockDetails({ block, onClose }: Props) {
  if (!block) return null;

  const signal = signalStatus(block.version);
  const explorerHash = block.hash.startsWith('synthetic')
      ? null
      : block.hash;

  return (
    <aside className="block-details" aria-label="Block details">
      <header>
        <h2>Block {formatHeight(block.height)}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <dl>
        <div>
          <dt>Hash</dt>
          <dd>
            {explorerHash ? (
              <a
                href={`https://mempool.space/block/${explorerHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortHash(block.hash, 20, 14)}
              </a>
            ) : (
              <span>{shortHash(block.hash)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Previous</dt>
          <dd>{block.prevHash ? shortHash(block.prevHash) : '—'}</dd>
        </div>
        <div>
          <dt>Side</dt>
          <dd className={`side side--${block.side}`}>
            {block.side === 'core'
              ? 'standard'
              : block.side === 'knots'
                ? 'bip-110'
                : 'shared'}
          </dd>
        </div>
        <div>
          <dt>BIP-110</dt>
          <dd>
            {signal === 'bip110'
              ? 'Signaling'
              : signal === 'no_signal'
                ? 'No signal'
                : 'Unknown'}
          </dd>
        </div>
        <div>
          <dt>Miner</dt>
          <dd>{block.miner || '—'}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {block.time
              ? new Date(block.time * 1000).toISOString().replace('T', ' ').slice(0, 19)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{block.version != null ? `0x${block.version.toString(16)}` : '—'}</dd>
        </div>
      </dl>
    </aside>
  );
}
