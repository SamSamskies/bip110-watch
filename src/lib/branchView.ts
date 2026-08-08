import {
  BRANCH_HEAD_DISPLAY,
  BRANCH_TIP_DISPLAY,
  type TopologyBlock,
} from './types';

export type BranchChip = {
  kind: 'chip';
  /** Number of heights not shown in this gap. */
  omitted: number;
  /** Display-truncation chip (expand/collapse). */
  canToggle: boolean;
  /** True while the head+tip window is collapsed. */
  collapsed: boolean;
  /** True when the gap is missing headers, not just hidden. */
  isDataGap: boolean;
};

export type BranchBlockItem = {
  kind: 'block';
  block: TopologyBlock;
};

export type BranchItem = BranchChip | BranchBlockItem;

export type BranchView = {
  items: BranchItem[];
  /** True when a display-truncation chip is present. */
  canToggle: boolean;
  /** True when showing the head+tip window. */
  collapsed: boolean;
};

/**
 * Build a lane that keeps the fork head and the tip, truncating the middle.
 * Sparse DAG holes get chips between bordering blocks; the middle truncate
 * chip is clickable when known headers are hidden.
 */
export function viewBranch(
  branch: TopologyBlock[],
  expanded: boolean,
  ancestorHeight?: number | null,
  head = BRANCH_HEAD_DISPLAY,
  tip = BRANCH_TIP_DISPLAY,
): BranchView {
  const canToggle = branch.length > head + tip;
  const collapsed = canToggle && !expanded;

  let visible = branch;
  let hiddenMiddle = 0;
  let truncateAfterHeight: number | null = null;

  if (canToggle && collapsed) {
    const headBlocks = branch.slice(0, head);
    const tipBlocks = branch.slice(-tip);
    visible = [...headBlocks, ...tipBlocks];
    hiddenMiddle = branch.length - head - tip;
    truncateAfterHeight = headBlocks[headBlocks.length - 1]?.height ?? null;
  }

  const items = itemsFromHeights(visible, ancestorHeight ?? null, {
    canToggle,
    collapsed,
    hiddenMiddle,
    truncateAfterHeight,
  });

  return { items, canToggle, collapsed };
}

function itemsFromHeights(
  visible: TopologyBlock[],
  ancestorHeight: number | null,
  opts: {
    canToggle: boolean;
    collapsed: boolean;
    hiddenMiddle: number;
    truncateAfterHeight: number | null;
  },
): BranchItem[] {
  const items: BranchItem[] = [];
  let prevHeight = ancestorHeight;

  for (let i = 0; i < visible.length; i++) {
    const block = visible[i]!;
    if (prevHeight != null) {
      const hole = block.height - prevHeight - 1;
      if (hole > 0) {
        const isTruncateChip =
          opts.canToggle &&
          opts.collapsed &&
          opts.hiddenMiddle > 0 &&
          opts.truncateAfterHeight != null &&
          prevHeight === opts.truncateAfterHeight;
        items.push({
          kind: 'chip',
          omitted: hole,
          canToggle: isTruncateChip,
          collapsed: opts.collapsed,
          isDataGap: !isTruncateChip || hole > opts.hiddenMiddle,
        });
      }
    }

    items.push({ kind: 'block', block });
    prevHeight = block.height;
  }

  // Expanded: collapse control at lane start.
  if (opts.canToggle && !opts.collapsed) {
    const hasTruncateChip = items.some((it) => it.kind === 'chip' && it.canToggle);
    if (!hasTruncateChip) {
      items.unshift({
        kind: 'chip',
        omitted: 0,
        canToggle: true,
        collapsed: false,
        isDataGap: false,
      });
    }
  }

  return items;
}
