import { describe, it, expect } from 'vitest';
import { formatDH } from '@/lib/format';

describe('formatDH', () => {
  it('uses comma decimal and DH suffix', () => {
    expect(formatDH(165)).toBe('165,00 DH');
    expect(formatDH(12.5)).toBe('12,50 DH');
    expect(formatDH(0)).toBe('0,00 DH');
  });
});
