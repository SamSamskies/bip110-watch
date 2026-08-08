import { describe, expect, it } from 'vitest';
import { viewBranch, type BranchItem } from './branchView';
import type { TopologyBlock } from './types';

function block(height: number): TopologyBlock {
  return {
    hash: `h${height}`,
    height,
    prevHash: null,
    version: null,
    time: null,
    miner: null,
    side: 'core',
    signals: false,
  };
}

function summary(items: BranchItem[]) {
  return items.map((it) =>
    it.kind === 'chip'
      ? {
          kind: 'chip',
          omitted: it.omitted,
          canToggle: it.canToggle,
          isDataGap: it.isDataGap,
        }
      : { kind: 'block', height: it.block.height },
  );
}

describe('viewBranch', () => {
  it('passes through short contiguous branches', () => {
    const branch = [632, 633, 634].map(block);
    const view = viewBranch(branch, false, 10, 631);
    expect(view.canToggle).toBe(false);
    expect(summary(view.items)).toEqual([
      { kind: 'block', height: 632 },
      { kind: 'block', height: 633 },
      { kind: 'block', height: 634 },
    ]);
  });

  it('places a data-gap chip between bordering blocks', () => {
    const branch = [632, 633, 634, 644, 645].map(block);
    const view = viewBranch(branch, false, 10, 631);
    expect(summary(view.items)).toEqual([
      { kind: 'block', height: 632 },
      { kind: 'block', height: 633 },
      { kind: 'block', height: 634 },
      { kind: 'chip', omitted: 9, canToggle: false, isDataGap: true },
      { kind: 'block', height: 644 },
      { kind: 'block', height: 645 },
    ]);
  });

  it('places a data-gap chip before a lone tip', () => {
    const view = viewBranch([block(647)], false, 10, 632);
    expect(summary(view.items)).toEqual([
      { kind: 'chip', omitted: 14, canToggle: false, isDataGap: true },
      { kind: 'block', height: 647 },
    ]);
  });

  it('collapses to a tip window with an interactive leading chip', () => {
    const branch = [1, 2, 3, 4, 5].map(block);
    const view = viewBranch(branch, false, 3, 0);
    expect(view.canToggle).toBe(true);
    expect(view.collapsed).toBe(true);
    expect(summary(view.items)).toEqual([
      { kind: 'chip', omitted: 2, canToggle: true, isDataGap: false },
      { kind: 'block', height: 3 },
      { kind: 'block', height: 4 },
      { kind: 'block', height: 5 },
    ]);
  });

  it('expands with a collapse control at the lane start', () => {
    const branch = [1, 2, 3, 4, 5].map(block);
    const view = viewBranch(branch, true, 3, 0);
    expect(view.collapsed).toBe(false);
    expect(summary(view.items)).toEqual([
      { kind: 'chip', omitted: 0, canToggle: true, isDataGap: false },
      { kind: 'block', height: 1 },
      { kind: 'block', height: 2 },
      { kind: 'block', height: 3 },
      { kind: 'block', height: 4 },
      { kind: 'block', height: 5 },
    ]);
  });
});
