import { describe, expect, it } from 'vitest';
import { identifyMiner, scriptsigToAscii } from './miner';

describe('identifyMiner', () => {
  it('matches AntPool coinbase tag', () => {
    const ascii = '....Mined by AntPool.....';
    const hex = Buffer.from(ascii, 'utf8').toString('hex');
    expect(identifyMiner(hex, [])).toBe('AntPool');
    expect(scriptsigToAscii(hex)).toContain('Mined by AntPool');
  });

  it('matches AntPool payout address', () => {
    expect(
      identifyMiner('', ['12dRugNcdxK39288NjcDV4GX7rMsKCGn6B']),
    ).toBe('AntPool');
  });
});
