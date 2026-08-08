import { MAX_BRANCH_DISPLAY, type TopologyBlock } from './types';

export type BranchView = {
  /** Blocks to render (tip-aligned when collapsed). */
  blocks: TopologyBlock[];
  /** Hidden older blocks when collapsed; 0 when expanded or under the cap. */
  omitted: number;
  /** True when the lane can expand/collapse. */
  canToggle: boolean;
  /** True when showing the truncated tip window. */
  collapsed: boolean;
};

/** Tip-aligned window for a post-fork lane, with expand/collapse metadata. */
export function viewBranch(
  branch: TopologyBlock[],
  expanded: boolean,
  max = MAX_BRANCH_DISPLAY,
): BranchView {
  const canToggle = branch.length > max;
  if (!canToggle) {
    return { blocks: branch, omitted: 0, canToggle: false, collapsed: false };
  }
  if (expanded) {
    return { blocks: branch, omitted: 0, canToggle: true, collapsed: false };
  }
  return {
    blocks: branch.slice(-max),
    omitted: branch.length - max,
    canToggle: true,
    collapsed: true,
  };
}
