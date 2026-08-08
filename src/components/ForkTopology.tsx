import { useEffect, useRef, useState } from 'react';
import { formatHeight } from '../lib/bip110';
import { viewBranch } from '../lib/branchView';
import type { ForkTopology, TopologyBlock } from '../lib/types';

type Props = {
  topology: ForkTopology;
  selectedHash: string | null;
  onSelect: (block: TopologyBlock) => void;
};

const BLOCK_W = 92;
const BLOCK_H = 70;
const GAP = 34;
const OMIT_W = 72;
const LABEL_GAP = 5;
const LABEL_H = 16;
/** Vertical gap between the two post-fork lanes (horizontal layout). */
const LANE_GAP = 128;
/** Horizontal gap between the two post-fork columns (vertical layout). */
const COL_GAP = 40;
const PAD_X = 28;
const PAD_Y = 44;
const VERTICAL_MQ = '(max-width: 840px)';
/** Cap how far we grow to fill empty canvas width (never scale down). */
const MAX_FIT_SCALE = 1.35;

function blockColor(side: TopologyBlock['side']): string {
  if (side === 'core') return 'var(--core)';
  if (side === 'knots') return 'var(--knots)';
  return 'var(--shared)';
}

function useVerticalTopology(): boolean {
  const [vertical, setVertical] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(VERTICAL_MQ).matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(VERTICAL_MQ);
    const onChange = () => setVertical(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return vertical;
}

export function ForkTopology({ topology, selectedHash, onSelect }: Props) {
  const { shared, coreBranch, knotsBranch, status } = topology;
  const forked = status === 'forked';
  const vertical = useVerticalTopology();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const [expandCore, setExpandCore] = useState(false);
  const [expandKnots, setExpandKnots] = useState(false);

  useEffect(() => {
    setExpandCore(false);
    setExpandKnots(false);
  }, [topology.coreTip?.hash, topology.knotsTip?.hash]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setCanvasWidth(w);
    });
    ro.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const ancestorHeight = shared[shared.length - 1]?.height ?? null;
  const coreView = viewBranch(coreBranch, expandCore, ancestorHeight);
  const knotsView = viewBranch(knotsBranch, expandKnots, ancestorHeight);

  const sharedCount = shared.length;
  const layout = vertical
    ? verticalLayout(sharedCount, coreView, knotsView, forked)
    : horizontalLayout(sharedCount, coreView, knotsView, forked);

  // Grow into empty canvas width; never shrink below native size (scroll instead).
  const fitScale =
    canvasWidth > 0
      ? Math.min(MAX_FIT_SCALE, Math.max(1, canvasWidth / layout.width))
      : 1;
  const displayWidth = layout.width * fitScale;
  const displayHeight = layout.height * fitScale;

  // Tip-align when tips move. Do not steal scroll on expand — new blocks
  // appear opposite the tip window and should stay in view.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    if (vertical) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    } else {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [topology.coreTip?.hash, topology.knotsTip?.hash, vertical]);

  // Re-anchor to the tip after collapse (compact tip-window again).
  useEffect(() => {
    if (expandCore || expandKnots) return;
    const el = canvasRef.current;
    if (!el) return;
    if (vertical) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    } else {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [expandCore, expandKnots, displayWidth, displayHeight, vertical]);

  const ancestor = shared[shared.length - 1] ?? null;
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

      <div
        className={`topology-canvas${vertical ? ' topology-canvas--vertical' : ''}`}
        ref={canvasRef}
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={displayWidth}
          height={displayHeight}
          role="img"
          aria-label={statusText ?? 'Fork topology diagram'}
        >
          {layout.orientation === 'vertical' ? (
            <VerticalDiagram
              layout={layout}
              shared={shared}
              forked={forked}
              ancestor={ancestor}
              coreView={coreView}
              knotsView={knotsView}
              selectedHash={selectedHash}
              onSelect={onSelect}
              onToggleCore={() => setExpandCore((v) => !v)}
              onToggleKnots={() => setExpandKnots((v) => !v)}
              coreLabel={topology.coreLabel}
              knotsLabel={topology.knotsLabel}
            />
          ) : (
            <HorizontalDiagram
              layout={layout}
              shared={shared}
              forked={forked}
              ancestor={ancestor}
              coreView={coreView}
              knotsView={knotsView}
              selectedHash={selectedHash}
              onSelect={onSelect}
              onToggleCore={() => setExpandCore((v) => !v)}
              onToggleKnots={() => setExpandKnots((v) => !v)}
              coreLabel={topology.coreLabel}
              knotsLabel={topology.knotsLabel}
            />
          )}
        </svg>
      </div>
    </section>
  );
}

type HorizontalLayout = {
  orientation: 'horizontal';
  width: number;
  height: number;
  sharedStartX: number;
  sharedY: number;
  branchStartX: number;
  coreY: number;
  knotsY: number;
  ancestorCx: number;
  ancestorBottom: number;
};

type VerticalLayout = {
  orientation: 'vertical';
  width: number;
  height: number;
  sharedX: number;
  sharedStartY: number;
  branchStartY: number;
  coreX: number;
  knotsX: number;
  ancestorCx: number;
  ancestorBottom: number;
};

function horizontalLayout(
  sharedCount: number,
  coreView: ReturnType<typeof viewBranch>,
  knotsView: ReturnType<typeof viewBranch>,
  forked: boolean,
): HorizontalLayout {
  const sharedWidth =
    sharedCount > 0 ? sharedCount * BLOCK_W + (sharedCount - 1) * GAP : 0;
  const branchWidth = Math.max(
    laneExtent(coreView, 'horizontal'),
    laneExtent(knotsView, 'horizontal'),
    BLOCK_W,
  );
  const forkGap = forked ? GAP + 20 : 0;
  const width = PAD_X * 2 + sharedWidth + forkGap + branchWidth + 110;
  const height = forked
    ? PAD_Y * 2 + LANE_GAP + BLOCK_H * 2 + LABEL_H
    : PAD_Y * 2 + BLOCK_H + LABEL_H + 24;

  const midY = height / 2;
  const sharedY = midY - BLOCK_H / 2;
  const sharedStartX = PAD_X;
  const branchStartX = PAD_X + sharedWidth + forkGap;
  const ancestorCx =
    sharedStartX +
    (sharedCount > 0 ? (sharedCount - 1) * (BLOCK_W + GAP) + BLOCK_W / 2 : 0);

  return {
    orientation: 'horizontal',
    width,
    height,
    sharedStartX,
    sharedY,
    branchStartX,
    coreY: midY - LANE_GAP / 2 - BLOCK_H / 2,
    knotsY: midY + LANE_GAP / 2 - BLOCK_H / 2,
    ancestorCx,
    ancestorBottom: sharedY + BLOCK_H,
  };
}

function verticalLayout(
  sharedCount: number,
  coreView: ReturnType<typeof viewBranch>,
  knotsView: ReturnType<typeof viewBranch>,
  forked: boolean,
): VerticalLayout {
  const sharedHeight =
    sharedCount > 0 ? sharedCount * BLOCK_H + (sharedCount - 1) * GAP : 0;
  const branchHeight = Math.max(
    laneExtent(coreView, 'vertical'),
    laneExtent(knotsView, 'vertical'),
    BLOCK_H,
  );
  const forkGap = forked ? GAP + 12 : 0;
  const labelSpace = 28;
  const width = forked
    ? PAD_X * 2 + BLOCK_W * 2 + COL_GAP
    : PAD_X * 2 + BLOCK_W;
  const height =
    PAD_Y * 2 + sharedHeight + forkGap + (forked ? branchHeight : 0) + labelSpace;

  const midX = width / 2;
  const sharedX = midX - BLOCK_W / 2;
  const sharedStartY = PAD_Y;
  const branchStartY = PAD_Y + sharedHeight + forkGap;
  const ancestorBottom =
    sharedCount > 0
      ? sharedStartY + (sharedCount - 1) * (BLOCK_H + GAP) + BLOCK_H
      : sharedStartY;

  return {
    orientation: 'vertical',
    width,
    height,
    sharedX,
    sharedStartY,
    branchStartY,
    coreX: midX - COL_GAP / 2 - BLOCK_W,
    knotsX: midX + COL_GAP / 2,
    ancestorCx: midX,
    ancestorBottom,
  };
}

function HorizontalDiagram({
  layout,
  shared,
  forked,
  ancestor,
  coreView,
  knotsView,
  selectedHash,
  onSelect,
  onToggleCore,
  onToggleKnots,
  coreLabel,
  knotsLabel,
}: {
  layout: HorizontalLayout;
  shared: TopologyBlock[];
  forked: boolean;
  ancestor: TopologyBlock | null;
  coreView: ReturnType<typeof viewBranch>;
  knotsView: ReturnType<typeof viewBranch>;
  selectedHash: string | null;
  onSelect: (b: TopologyBlock) => void;
  onToggleCore: () => void;
  onToggleKnots: () => void;
  coreLabel: string;
  knotsLabel: string;
}) {
  return (
    <>
      {shared.map((b, i) => {
        if (i === 0) return null;
        const x1 = layout.sharedStartX + (i - 1) * (BLOCK_W + GAP) + BLOCK_W;
        const x2 = layout.sharedStartX + i * (BLOCK_W + GAP);
        const y = layout.sharedY + BLOCK_H / 2;
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
          y={layout.coreY}
          branchStartX={layout.branchStartX}
          ancestorCx={layout.ancestorCx}
          ancestorBottom={layout.ancestorBottom}
          selectedHash={selectedHash}
          onSelect={onSelect}
          onToggle={onToggleCore}
          label={coreLabel}
          labelClass="lane-label lane-label--core"
        />
      )}
      {forked && ancestor && (
        <LaneBranch
          side="knots"
          view={knotsView}
          y={layout.knotsY}
          branchStartX={layout.branchStartX}
          ancestorCx={layout.ancestorCx}
          ancestorBottom={layout.ancestorBottom}
          selectedHash={selectedHash}
          onSelect={onSelect}
          onToggle={onToggleKnots}
          label={knotsLabel}
          labelClass="lane-label lane-label--knots"
        />
      )}

      {shared.map((b, i) => (
        <BlockNode
          key={b.hash}
          block={b}
          x={layout.sharedStartX + i * (BLOCK_W + GAP)}
          y={layout.sharedY}
          selected={selectedHash === b.hash}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function VerticalDiagram({
  layout,
  shared,
  forked,
  ancestor,
  coreView,
  knotsView,
  selectedHash,
  onSelect,
  onToggleCore,
  onToggleKnots,
  coreLabel,
  knotsLabel,
}: {
  layout: VerticalLayout;
  shared: TopologyBlock[];
  forked: boolean;
  ancestor: TopologyBlock | null;
  coreView: ReturnType<typeof viewBranch>;
  knotsView: ReturnType<typeof viewBranch>;
  selectedHash: string | null;
  onSelect: (b: TopologyBlock) => void;
  onToggleCore: () => void;
  onToggleKnots: () => void;
  coreLabel: string;
  knotsLabel: string;
}) {
  return (
    <>
      {shared.map((b, i) => {
        if (i === 0) return null;
        const y1 = layout.sharedStartY + (i - 1) * (BLOCK_H + GAP) + BLOCK_H;
        const y2 = layout.sharedStartY + i * (BLOCK_H + GAP);
        const x = layout.sharedX + BLOCK_W / 2;
        return (
          <line
            key={`sl-${b.hash}`}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            className="link link--shared"
          />
        );
      })}

      {forked && ancestor && (
        <VerticalLaneBranch
          side="core"
          view={coreView}
          x={layout.coreX}
          branchStartY={layout.branchStartY}
          ancestorCx={layout.ancestorCx}
          ancestorBottom={layout.ancestorBottom}
          selectedHash={selectedHash}
          onSelect={onSelect}
          onToggle={onToggleCore}
          label={coreLabel}
          labelClass="lane-label lane-label--core"
        />
      )}
      {forked && ancestor && (
        <VerticalLaneBranch
          side="knots"
          view={knotsView}
          x={layout.knotsX}
          branchStartY={layout.branchStartY}
          ancestorCx={layout.ancestorCx}
          ancestorBottom={layout.ancestorBottom}
          selectedHash={selectedHash}
          onSelect={onSelect}
          onToggle={onToggleKnots}
          label={knotsLabel}
          labelClass="lane-label lane-label--knots"
        />
      )}

      {shared.map((b, i) => (
        <BlockNode
          key={b.hash}
          block={b}
          x={layout.sharedX}
          y={layout.sharedStartY + i * (BLOCK_H + GAP)}
          selected={selectedHash === b.hash}
          onSelect={onSelect}
          minerBeside
        />
      ))}
    </>
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
        d={forkPathHorizontal(
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

function VerticalLaneBranch({
  side,
  view,
  x,
  branchStartY,
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
  x: number;
  branchStartY: number;
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

  const laneMidX = x + BLOCK_W / 2;
  let y = branchStartY;
  const placed = view.items.map((item) => {
    const at = y;
    y += BLOCK_H + GAP;
    return { item, y: at };
  });
  const labelY = y - GAP + 18;
  const first = placed[0]!;
  const firstDashed = first.item.kind === 'chip';
  const firstCx =
    first.item.kind === 'chip' ? x + (BLOCK_W - OMIT_W) / 2 + OMIT_W / 2 : laneMidX;

  return (
    <g className={`lane-branch lane-branch--${side}`}>
      <path
        className={`${linkClass}${firstDashed ? ' link--dashed' : ''}`}
        fill="none"
        d={forkPathVertical(ancestorCx, ancestorBottom, firstCx, first.y)}
      />

      {placed.map((cur, i) => {
        if (i === 0) return null;
        const prev = placed[i - 1]!;
        const dashed =
          prev.item.kind === 'chip' || cur.item.kind === 'chip';
        return (
          <line
            key={`l-${side}-${i}`}
            x1={laneMidX}
            y1={prev.y + BLOCK_H}
            x2={laneMidX}
            y2={cur.y}
            className={`${linkClass}${dashed ? ' link--dashed' : ''}`}
          />
        );
      })}

      {placed.map(({ item, y: iy }, i) =>
        item.kind === 'chip' ? (
          <OmitChip
            key={`c-${side}-${i}`}
            x={x + (BLOCK_W - OMIT_W) / 2}
            y={iy}
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
            x={x}
            y={iy}
            selected={selectedHash === item.block.hash}
            onSelect={onSelect}
            minerBeside
          />
        ),
      )}

      <text
        x={laneMidX}
        y={labelY}
        textAnchor="middle"
        className={labelClass}
      >
        {label}
      </text>
    </g>
  );
}

function laneExtent(
  view: ReturnType<typeof viewBranch>,
  orientation: 'horizontal' | 'vertical',
): number {
  if (view.items.length === 0) return 0;
  if (orientation === 'vertical') {
    return view.items.length * BLOCK_H + (view.items.length - 1) * GAP;
  }
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
    ? `${omitted} block${omitted === 1 ? '' : 's'} omitted in fork.observer data`
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

function forkPathHorizontal(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midX = (fromX + toX) / 2;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

function forkPathVertical(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

function BlockNode({
  block,
  x,
  y,
  selected,
  onSelect,
  minerBeside = false,
}: {
  block: TopologyBlock;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (b: TopologyBlock) => void;
  /** Inset miner under height so stacked vertical gaps stay clear. */
  minerBeside?: boolean;
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
        y={minerBeside ? BLOCK_H / 2 - 8 : BLOCK_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="block-height"
      >
        {formatHeight(block.height)}
      </text>
      <text
        x={BLOCK_W / 2}
        y={minerBeside ? BLOCK_H / 2 + 14 : BLOCK_H + LABEL_GAP + 10}
        textAnchor="middle"
        className={`block-miner${minerBeside ? ' block-miner--inset' : ''}`}
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
