import { formatHeight } from '../lib/bip110';
import type { ForkTopology, TopologyBlock } from '../lib/types';

type Props = {
  topology: ForkTopology;
  selectedHash: string | null;
  onSelect: (block: TopologyBlock) => void;
};

const BLOCK_W = 72;
const BLOCK_H = 56;
const GAP = 28;
const LABEL_GAP = 4;
const LABEL_H = 14;
const LANE_GAP = 108;
const PAD_X = 24;
const PAD_Y = 40;

function blockColor(side: TopologyBlock['side']): string {
  if (side === 'core') return 'var(--core)';
  if (side === 'knots') return 'var(--knots)';
  return 'var(--shared)';
}

export function ForkTopology({ topology, selectedHash, onSelect }: Props) {
  const { shared, coreBranch, knotsBranch, status } = topology;
  const forked = status === 'forked';

  const sharedCount = shared.length;
  const maxBranch = Math.max(coreBranch.length, knotsBranch.length, 1);

  const sharedWidth =
    sharedCount > 0 ? sharedCount * BLOCK_W + (sharedCount - 1) * GAP : 0;
  const branchWidth =
    maxBranch > 0 ? maxBranch * BLOCK_W + (maxBranch - 1) * GAP : 0;
  // fork connector gap between shared and branches
  const forkGap = forked ? GAP + 20 : 0;
  const width = PAD_X * 2 + sharedWidth + forkGap + branchWidth + 100;
  const height = forked
    ? PAD_Y * 2 + LANE_GAP + BLOCK_H * 2 + LABEL_H
    : PAD_Y * 2 + BLOCK_H + LABEL_H + 24;

  const midY = height / 2;
  const coreY = midY - LANE_GAP / 2 - BLOCK_H / 2;
  const knotsY = midY + LANE_GAP / 2 - BLOCK_H / 2;
  const sharedY = forked ? midY - BLOCK_H / 2 : midY - BLOCK_H / 2;

  const sharedStartX = PAD_X;
  const branchStartX = PAD_X + sharedWidth + forkGap;

  const ancestor = shared[shared.length - 1] ?? null;
  const ancestorCx =
    sharedStartX +
    (sharedCount > 0 ? (sharedCount - 1) * (BLOCK_W + GAP) + BLOCK_W / 2 : 0);
  const ancestorBottom = sharedY + BLOCK_H;

  const statusText = statusLabel(topology);

  return (
    <section className="topology-card" aria-label="Fork topology">
      <header className="topology-header">
        <div className="topology-titles">
          <p className="eyebrow">Active chains</p>
          <h1>Fork topology</h1>
        </div>
        {statusText ? (
          <p className="topology-status" role="status">
            {statusText}
          </p>
        ) : (
          <span className="topology-status" aria-hidden />
        )}
        {forked && topology.deltaBlocks > 0 ? (
          <div className="delta-badge" title="Height difference between tips">
            <span aria-hidden>▲</span>{' '}
            {topology.leader === 'core'
              ? 'Core'
              : topology.leader === 'knots'
                ? 'Knots'
                : null}{' '}
            {topology.deltaBlocks} BLOCK
            {topology.deltaBlocks === 1 ? '' : 'S'}
          </div>
        ) : (
          <div className="delta-badge delta-badge--muted">Δ 0</div>
        )}
      </header>

      <div className="topology-canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          aria-label={statusText ?? 'Fork topology diagram'}
        >
          {/* Shared links */}
          {shared.map((b, i) => {
            if (i === 0) return null;
            const x1 = sharedStartX + (i - 1) * (BLOCK_W + GAP) + BLOCK_W;
            const x2 = sharedStartX + i * (BLOCK_W + GAP);
            const y = sharedY + BLOCK_H / 2;
            return (
              <line
                key={`sl-${b.hash}`}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                className="link link--shared"
              />
            );
          })}

          {/* Fork connectors from ancestor to first branch blocks */}
          {forked && ancestor && coreBranch[0] && (
            <path
              className="link link--core"
              fill="none"
              d={forkPath(
                ancestorCx,
                ancestorBottom,
                branchStartX,
                coreY + BLOCK_H / 2,
              )}
            />
          )}
          {forked && ancestor && knotsBranch[0] && (
            <path
              className="link link--knots"
              fill="none"
              d={forkPath(
                ancestorCx,
                ancestorBottom,
                branchStartX,
                knotsY + BLOCK_H / 2,
              )}
            />
          )}

          {/* Branch internal links */}
          {forked &&
            coreBranch.map((b, i) => {
              if (i === 0) return null;
              const x1 = branchStartX + (i - 1) * (BLOCK_W + GAP) + BLOCK_W;
              const x2 = branchStartX + i * (BLOCK_W + GAP);
              const y = coreY + BLOCK_H / 2;
              return (
                <line
                  key={`cl-${b.hash}`}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  className="link link--core"
                />
              );
            })}
          {forked &&
            knotsBranch.map((b, i) => {
              if (i === 0) return null;
              const x1 = branchStartX + (i - 1) * (BLOCK_W + GAP) + BLOCK_W;
              const x2 = branchStartX + i * (BLOCK_W + GAP);
              const y = knotsY + BLOCK_H / 2;
              return (
                <line
                  key={`kl-${b.hash}`}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  className="link link--knots"
                />
              );
            })}

          {/* Shared blocks */}
          {shared.map((b, i) => (
            <BlockNode
              key={b.hash}
              block={b}
              x={sharedStartX + i * (BLOCK_W + GAP)}
              y={sharedY}
              selected={selectedHash === b.hash}
              onSelect={onSelect}
            />
          ))}

          {/* Core / Knots branches */}
          {forked &&
            coreBranch.map((b, i) => (
              <BlockNode
                key={b.hash}
                block={b}
                x={branchStartX + i * (BLOCK_W + GAP)}
                y={coreY}
                selected={selectedHash === b.hash}
                onSelect={onSelect}
              />
            ))}
          {forked &&
            knotsBranch.map((b, i) => (
              <BlockNode
                key={b.hash}
                block={b}
                x={branchStartX + i * (BLOCK_W + GAP)}
                y={knotsY}
                selected={selectedHash === b.hash}
                onSelect={onSelect}
              />
            ))}

          {/* Lane labels */}
          {forked && (
            <>
              <text
                x={branchStartX + coreBranch.length * (BLOCK_W + GAP) - GAP + 8}
                y={coreY + BLOCK_H / 2 + 5}
                className="lane-label lane-label--core"
              >
                {topology.coreLabel}
              </text>
              <text
                x={
                  branchStartX + knotsBranch.length * (BLOCK_W + GAP) - GAP + 8
                }
                y={knotsY + BLOCK_H / 2 + 5}
                className="lane-label lane-label--knots"
              >
                {topology.knotsLabel}
              </text>
            </>
          )}
        </svg>
      </div>

      <footer className="topology-footer">
        <div className="legend">
          <span className="legend-item">
            <i className="dot dot--bip110" /> BIP110
          </span>
          <span className="legend-item">
            <i className="dot dot--nosignal" /> NO SIGNAL
          </span>
        </div>
        <div className="ancestor-meta">
          {topology.commonAncestor ? (
            <>
              <span className="meta-label">Common ancestor</span>{' '}
              <span className="meta-value">
                {formatHeight(topology.commonAncestor.height)}
              </span>
            </>
          ) : (
            <span className="meta-label">No ancestor yet</span>
          )}
        </div>
      </footer>
    </section>
  );
}

function statusLabel(t: ForkTopology): string | null {
  if (t.status === 'agree') return 'In agreement — both nodes on the same tip';
  if (t.status === 'unknown') return 'Waiting for chain tips…';
  if (t.status === 'forked' && t.deltaBlocks === 0) {
    return 'Same height, different tips';
  }
  return null;
}

function forkPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midX = (fromX + toX) / 2;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

function BlockNode({
  block,
  x,
  y,
  selected,
  onSelect,
}: {
  block: TopologyBlock;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (b: TopologyBlock) => void;
}) {
  const color = blockColor(block.side);
  const miner = truncateMiner(block.miner);
  return (
    <g
      className={`block-node${selected ? ' is-selected' : ''}`}
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(block)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(block);
        }
      }}
    >
      <rect
        width={BLOCK_W}
        height={BLOCK_H}
        rx={10}
        ry={10}
        fill="var(--block-fill)"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.75}
      />
      <text
        x={BLOCK_W / 2}
        y={BLOCK_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="block-height"
      >
        {formatHeight(block.height)}
      </text>
      <circle
        cx={BLOCK_W - 10}
        cy={10}
        r={4.5}
        className={block.signals ? 'signal-dot signal-dot--on' : 'signal-dot'}
      />
      <text
        x={BLOCK_W / 2}
        y={BLOCK_H + LABEL_GAP + 10}
        textAnchor="middle"
        className="block-miner"
      >
        {miner}
      </text>
      <title>
        {formatHeight(block.height)}
        {block.miner ? ` · ${block.miner}` : ''}
        {block.signals ? ' · BIP-110' : ' · no signal'}
      </title>
    </g>
  );
}

function truncateMiner(miner: string | null): string {
  if (!miner) return '—';
  const cleaned = miner.replace(/\s+Pool$/i, '').replace(/\s+USA$/i, '');
  if (cleaned.length <= 10) return cleaned;
  return `${cleaned.slice(0, 9)}…`;
}
