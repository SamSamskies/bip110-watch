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
    const view = viewBranch(branch, false, 631);
    expect(view.canToggle).toBe(false);
    expect(summary(view.items)).toEqual([
      { kind: 'block', height: 632 },
      { kind: 'block', height: 633 },
      { kind: 'block', height: 634 },
    ]);
  });

  it('places a data-gap chip between bordering blocks when short', () => {
    // 3 head + 2 tip = 5 ≤ 6 — no display truncate, only data gap
    const branch = [632, 633, 634, 644, 645].map(block);
    const view = viewBranch(branch, false, 631);
    expect(view.canToggle).toBe(false);
    expect(summary(view.items)).toEqual([
      { kind: 'block', height: 632 },
      { kind: 'block', height: 633 },
      { kind: 'block', height: 634 },
      { kind: 'chip', omitted: 9, canToggle: false, isDataGap: true },
      { kind: 'block', height: 644 },
      { kind: 'block', height: 645 },
    ]);
  });

  it('keeps 3 after the fork and 3 at the tip, truncating the middle', () => {
    const branch = [632, 633, 634, 635, 636, 637, 638, 639, 640].map(block);
    const view = viewBranch(branch, false, 631, 3, 3);
    expect(view.canToggle).toBe(true);
    expect(view.collapsed).toBe(true);
    expect(summary(view.items)).toEqual([
      { kind: 'block', height: 632 },
      { kind: 'block', height: 633 },
      { kind: 'block', height: 634 },
      { kind: 'chip', omitted: 3, canToggle: true, isDataGap: false },
      { kind: 'block', height: 638 },
      { kind: 'block', height: 639 },
      { kind: 'block', height: 640 },
    ]);
  });

  it('places a data-gap chip before a lone tip', () => {
    const view = viewBranch([block(647)], false, 632);
    expect(summary(view.items)).toEqual([
      { kind: 'chip', omitted: 14, canToggle: false, isDataGap: true },
      { kind: 'block', height: 647 },
    ]);
  });

  it('expands with a collapse control at the lane start', () => {
    const branch = [632, 633, 634, 635, 636, 637, 638, 639, 640].map(block);
    const view = viewBranch(branch, true, 631, 3, 3);
    expect(view.collapsed).toBe(false);
    expect(summary(view.items)[0]).toEqual({
      kind: 'chip',
      omitted: 0,
      canToggle: true,
      isDataGap: false,
    });
    expect(view.items.filter((it) => it.kind === 'block')).toHaveLength(9);
  });
});
