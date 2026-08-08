import { describe, expect, it } from 'vitest';
import { viewBranch } from './branchView';
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

describe('viewBranch', () => {
  it('passes through short branches', () => {
    const branch = [1, 2, 3].map(block);
    expect(viewBranch(branch, false, 10)).toEqual({
      blocks: branch,
      omitted: 0,
      canToggle: false,
      collapsed: false,
    });
  });

  it('collapses to the tip window', () => {
    const branch = [1, 2, 3, 4, 5].map(block);
    const view = viewBranch(branch, false, 3);
    expect(view.canToggle).toBe(true);
    expect(view.collapsed).toBe(true);
    expect(view.omitted).toBe(2);
    expect(view.blocks.map((b) => b.height)).toEqual([3, 4, 5]);
  });

  it('expands to the full branch', () => {
    const branch = [1, 2, 3, 4, 5].map(block);
    const view = viewBranch(branch, true, 3);
    expect(view.collapsed).toBe(false);
    expect(view.omitted).toBe(0);
    expect(view.blocks).toEqual(branch);
    expect(view.canToggle).toBe(true);
  });
});
