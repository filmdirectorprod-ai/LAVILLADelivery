import { describe, it, expect } from 'vitest';
import { buildSupportThreads } from '@/lib/admin-support';
import type { SupportMessage } from '@/lib/types';

function msg(over: Partial<SupportMessage> & { id: string; driver_id: string }): SupportMessage {
  return {
    sender: 'driver',
    body: 'Bonjour',
    read_by_staff: false,
    created_at: '2026-06-07T10:00:00Z',
    ...over,
  };
}

const drivers = [
  { id: 'd1', name: 'Karim' },
  { id: 'd2', name: 'Yassine' },
];

describe('buildSupportThreads', () => {
  it('folds messages into per-driver threads, oldest first', () => {
    const messages = [
      msg({ id: 'm2', driver_id: 'd1', created_at: '2026-06-07T11:00:00Z' }),
      msg({ id: 'm1', driver_id: 'd1', created_at: '2026-06-07T10:00:00Z' }),
    ];
    const threads = buildSupportThreads(messages, drivers);
    expect(threads).toHaveLength(1);
    expect(threads[0].driver.name).toBe('Karim');
    expect(threads[0].messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('counts staff-unread driver messages only', () => {
    const messages = [
      msg({ id: 'm1', driver_id: 'd1', sender: 'driver', read_by_staff: false }),
      msg({ id: 'm2', driver_id: 'd1', sender: 'driver', read_by_staff: true }),
      msg({ id: 'm3', driver_id: 'd1', sender: 'staff', read_by_staff: false }), // staff reply, not unread
    ];
    expect(buildSupportThreads(messages, drivers)[0].unread).toBe(1);
  });

  it('orders unread threads before read ones, then by most recent message', () => {
    const messages = [
      msg({ id: 'a', driver_id: 'd1', read_by_staff: true, created_at: '2026-06-07T12:00:00Z' }),
      msg({ id: 'b', driver_id: 'd2', read_by_staff: false, created_at: '2026-06-07T09:00:00Z' }),
    ];
    const threads = buildSupportThreads(messages, drivers);
    expect(threads.map((t) => t.driver.id)).toEqual(['d2', 'd1']); // d2 unread first
  });

  it('omits drivers with no messages', () => {
    const threads = buildSupportThreads([msg({ id: 'm1', driver_id: 'd1' })], drivers);
    expect(threads.map((t) => t.driver.id)).toEqual(['d1']);
  });
});
