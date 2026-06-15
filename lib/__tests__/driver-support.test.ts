import { describe, it, expect } from 'vitest';
import { unreadFromStaff } from '@/lib/driver-support';
import type { SupportMessage } from '@/lib/types';

function msg(over: Partial<SupportMessage> & { id: string; sender: 'driver' | 'staff'; created_at: string }): SupportMessage {
  return { driver_id: 'd1', body: 'Bonjour', read_by_staff: false, ...over };
}

const messages: SupportMessage[] = [
  msg({ id: 'a', sender: 'staff', created_at: '2026-06-07T10:00:00Z' }),
  msg({ id: 'b', sender: 'driver', created_at: '2026-06-07T11:00:00Z' }),
  msg({ id: 'c', sender: 'staff', created_at: '2026-06-07T12:00:00Z' }),
  msg({ id: 'd', sender: 'staff', created_at: '2026-06-07T13:00:00Z' }),
];

describe('unreadFromStaff', () => {
  it('counts only staff messages newer than lastSeen', () => {
    expect(unreadFromStaff(messages, '2026-06-07T11:30:00Z')).toBe(2); // c, d
  });

  it('ignores driver-authored messages', () => {
    const onlyDriver = [msg({ id: 'x', sender: 'driver', created_at: '2026-06-08T00:00:00Z' })];
    expect(unreadFromStaff(onlyDriver, null)).toBe(0);
  });

  it('treats every staff message as unread when lastSeen is null', () => {
    expect(unreadFromStaff(messages, null)).toBe(3); // a, c, d
  });

  it('treats an unparseable lastSeen as never-seen', () => {
    expect(unreadFromStaff(messages, 'garbage')).toBe(3);
  });

  it('returns 0 once lastSeen is past the latest staff message', () => {
    expect(unreadFromStaff(messages, '2026-06-07T13:00:01Z')).toBe(0);
  });
});
