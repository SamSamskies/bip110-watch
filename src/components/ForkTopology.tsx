import { useEffect, useState } from 'react';
import { formatHeight } from '../lib/bip110';
import { viewBranch } from '../lib/branchView';
import type { ForkTopology, TopologyBlock } from '../lib/types';

type Props = {
  topology: ForkTopology;
  selectedHash: string | null;
  onSelect: (block: TopologyBlock) => void;
};

const BLOCK_W = 72;
const BLOCK_H = 56;
const GAP = 28;
const OMIT_W = 56;
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

  const [expandCore, setExpandCore] = useState(false);
  const [expandKnots, setExpandKnots] = useState(false);

  useEffect(() => {
    setExpandCore(false);
    setExpandKnots(false);
  }, [topology.coreTip?.hash, topology.knotsTip?.hash]);

  const ancestorHeight = shared[shared.length - 1]?.height ?? null;
  const coreView = viewBranch(coreBranch, expandCore, undefined, ancestorHeight);
  const knotsView = viewBranch(
    knotsBranch,
    expandKnots,
    undefined,
    ancestorHeight,
  );

  const sharedCount = shared.length;
  const sharedWidth =
    sharedCount > 0 ? sharedCount * BLOCK_W + (sharedCount - 1) * GAP : 0;
  const branchWidth = Math.max(
    laneWidth(coreView),
    laneWidth(knotsView),
    BLOCK_W,
  );
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
              ? 'Standard'
              : topology.leader === 'knots'
                ? 'BIP-110'
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

          {forked && ancestor && (
            <LaneBranch
              side="core"
              view={coreView}
              y={coreY}
              branchStartX={branchStartX}
              ancestorCx={ancestorCx}
              ancestorBottom={ancestorBottom}
              selectedHash={selectedHash}
              onSelect={onSelect}
              onToggle={() => setExpandCore((v) => !v)}
              label={topology.coreLabel}
              labelClass="lane-label lane-label--core"
            />
          )}
          {forked && ancestor && (
            <LaneBranch
              side="knots"
              view={knotsView}
              y={knotsY}
              branchStartX={branchStartX}
              ancestorCx={ancestorCx}
              ancestorBottom={ancestorBottom}
              selectedHash={selectedHash}
              onSelect={onSelect}
              onToggle={() => setExpandKnots((v) => !v)}
              label={topology.knotsLabel}
              labelClass="lane-label lane-label--knots"
            />
          )}

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
        </svg>
      </div>
    </section>
  );
}

function itemWidth(kind: 'chip' | 'block'): number {
  return kind === 'chip' ? OMIT_W : BLOCK_W;
}

function LaneBranch({
  side,
  view,
  y,
  branchStartX,
  ancestorCx,
  ancestorBottom,
  selectedHash,
  onSelect,
  onToggle,
  label,
  labelClass,
}: {
  side: 'core' | 'knots';
  view: ReturnType<typeof viewBranch>;
  y: number;
  branchStartX: number;
  ancestorCx: number;
  ancestorBottom: number;
  selectedHash: string | null;
  onSelect: (b: TopologyBlock) => void;
  onToggle: () => void;
  label: string;
  labelClass: string;
}) {
  const linkClass = side === 'core' ? 'link link--core' : 'link link--knots';
  if (view.items.length === 0) return null;

  const laneMidY = y + BLOCK_H / 2;
  let x = branchStartX;
  const placed = view.items.map((item) => {
    const at = x;
    x += itemWidth(item.kind) + GAP;
    return { item, x: at };
  });
  const labelX = x - GAP + 8;
  const first = placed[0]!;
  const firstDashed = first.item.kind === 'chip';

  return (
    <g className={`lane-branch lane-branch--${side}`}>
      <path
        className={`${linkClass}${firstDashed ? ' link--dashed' : ''}`}
        fill="none"
        d={forkPath(
          ancestorCx,
          ancestorBottom,
          first.x + itemWidth(first.item.kind) / 2,
          laneMidY,
        )}
      />

      {placed.map((cur, i) => {
        if (i === 0) return null;
        const prev = placed[i - 1]!;
        const dashed =
          prev.item.kind === 'chip' || cur.item.kind === 'chip';
        return (
          <line
            key={`l-${side}-${i}`}
            x1={prev.x + itemWidth(prev.item.kind)}
            y1={laneMidY}
            x2={cur.x}
            y2={laneMidY}
            className={`${linkClass}${dashed ? ' link--dashed' : ''}`}
          />
        );
      })}

      {placed.map(({ item, x: ix }, i) =>
        item.kind === 'chip' ? (
          <OmitChip
            key={`c-${side}-${i}`}
            x={ix}
            y={y}
            side={side}
            omitted={item.omitted}
            collapsed={item.collapsed}
            interactive={item.canToggle}
            isDataGap={item.isDataGap}
            onToggle={onToggle}
          />
        ) : (
          <BlockNode
            key={item.block.hash}
            block={item.block}
            x={ix}
            y={y}
            selected={selectedHash === item.block.hash}
            onSelect={onSelect}
          />
        ),
      )}

      <text x={labelX} y={laneMidY + 5} className={labelClass}>
        {label}
      </text>
    </g>
  );
}

function laneWidth(view: ReturnType<typeof viewBranch>): number {
  if (view.items.length === 0) return 0;
  let w = 0;
  for (let i = 0; i < view.items.length; i++) {
    w += itemWidth(view.items[i]!.kind);
    if (i < view.items.length - 1) w += GAP;
  }
  return w;
}

function OmitChip({
  x,
  y,
  side,
  omitted,
  collapsed,
  interactive,
  isDataGap,
  onToggle,
}: {
  x: number;
  y: number;
  side: 'core' | 'knots';
  omitted: number;
  collapsed: boolean;
  interactive: boolean;
  isDataGap: boolean;
  onToggle: () => void;
}) {
  const color = side === 'core' ? 'var(--core)' : 'var(--knots)';
  const label =
    interactive && !collapsed && !isDataGap ? '−' : `…+${omitted}`;
  const title = isDataGap
    ? `${omitted} block${omitted === 1 ? '' : 's'} missing from header data`
    : collapsed
      ? `Show ${omitted} older block${omitted === 1 ? '' : 's'}`
      : 'Show fewer blocks';

  return (
    <g
      className={interactive ? 'omit-toggle' : 'omit-gap'}
      transform={`translate(${x}, ${y})`}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={title}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onToggle();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
              }
            }
          : undefined
      }
    >
      <rect
        width={OMIT_W}
        height={BLOCK_H}
        rx={10}
        ry={10}
        fill="var(--block-fill)"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text
        x={OMIT_W / 2}
        y={BLOCK_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="omit-toggle-label"
        fill={color}
      >
        {label}
      </text>
      <title>{title}</title>
    </g>
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
