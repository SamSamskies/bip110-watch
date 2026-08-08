import { MAX_BRANCH_DISPLAY, type TopologyBlock } from './types';

export type BranchChip = {
  kind: 'chip';
  /** Number of heights not shown in this gap. */
  omitted: number;
  /** Display-truncation chip (expand/collapse). */
  canToggle: boolean;
  /** True while the tip window is collapsed. */
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
  /** True when showing the truncated tip window. */
  collapsed: boolean;
};

/**
 * Build a tip-aligned lane with chips at real height holes.
 * Display truncation inserts an interactive chip before the tip window;
 * sparse DAG holes get non-interactive chips between the bordering blocks.
 */
export function viewBranch(
  branch: TopologyBlock[],
  expanded: boolean,
  max = MAX_BRANCH_DISPLAY,
  ancestorHeight?: number | null,
): BranchView {
  const canToggle = branch.length > max;
  const collapsed = canToggle && !expanded;
  const visible =
    canToggle && collapsed ? branch.slice(-max) : branch;

  const items = itemsFromHeights(visible, ancestorHeight ?? null, {
    canToggle,
    collapsed,
    /** Heights dropped by tip-window collapse (known headers, just hidden). */
    hiddenPrefix: canToggle && collapsed ? branch.length - max : 0,
  });

  return { items, canToggle, collapsed };
}

function itemsFromHeights(
  visible: TopologyBlock[],
  ancestorHeight: number | null,
  opts: { canToggle: boolean; collapsed: boolean; hiddenPrefix: number },
): BranchItem[] {
  const items: BranchItem[] = [];
  let prevHeight = ancestorHeight;

  for (let i = 0; i < visible.length; i++) {
    const block = visible[i]!;
    if (prevHeight != null) {
      const hole = block.height - prevHeight - 1;
      if (hole > 0) {
        // First hole while tip-window is collapsed: treat as expand control
        // when it matches (or covers) the hidden prefix of known headers.
        const isTruncateChip =
          opts.canToggle &&
          opts.collapsed &&
          i === 0 &&
          opts.hiddenPrefix > 0;
        items.push({
          kind: 'chip',
          omitted: hole,
          canToggle: isTruncateChip,
          collapsed: opts.collapsed,
          isDataGap: isTruncateChip ? hole > opts.hiddenPrefix : true,
        });
      }
    } else if (opts.canToggle && opts.collapsed && i === 0 && opts.hiddenPrefix > 0) {
      // No ancestor height — still show truncate chip before tip window.
      items.push({
        kind: 'chip',
        omitted: opts.hiddenPrefix,
        canToggle: true,
        collapsed: true,
        isDataGap: false,
      });
    }

    items.push({ kind: 'block', block });
    prevHeight = block.height;
  }

  // Expanded truncate control: show collapse chip at lane start when no hole.
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
