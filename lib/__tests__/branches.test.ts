import { describe, it, expect } from 'vitest';
import { LA_VILLA_BRANCHES, DEFAULT_BRANCH, findBranch, branchPickupLabel } from '@/lib/branches';

describe('branches', () => {
  it('has the two La Villa shops', () => {
    expect(LA_VILLA_BRANCHES.map((b) => b.id)).toEqual(['riad', 'badie']);
  });
  it('defaults to the Ville Nouvelle shop', () => {
    expect(DEFAULT_BRANCH.id).toBe('riad');
  });
  it('findBranch returns the match, or the default for unknown ids', () => {
    expect(findBranch('badie').id).toBe('badie');
    expect(findBranch('nope').id).toBe('riad');
    expect(findBranch(null).id).toBe('riad');
  });
  it('branchPickupLabel includes the name and address', () => {
    expect(branchPickupLabel(findBranch('badie'))).toContain('La Villa Badie');
    expect(branchPickupLabel(findBranch('badie'))).toContain('Aïn Chkef');
  });
});
