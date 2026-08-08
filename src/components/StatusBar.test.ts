import { describe, expect, it } from 'vitest';
import { formatAge } from '../components/StatusBar';

describe('formatAge', () => {
  it('formats short ages', () => {
    expect(formatAge(0)).toBe('just now');
    expect(formatAge(999)).toBe('just now');
    expect(formatAge(5_000)).toBe('5s ago');
    expect(formatAge(59_000)).toBe('59s ago');
    expect(formatAge(60_000)).toBe('1m ago');
    expect(formatAge(3_600_000)).toBe('1h ago');
  });
});
