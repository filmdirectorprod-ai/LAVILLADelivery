import { describe, it, expect } from 'vitest';
import { buildSupportThreads, driverInitials, threadPreview } from '@/lib/admin-support';
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
  { id: 'd1', name: 'Karim Benali' },
  { id: 'd2', name: 'Yassine Alaoui' },
];

describe('driverInitials', () => {
  it('uses first + last initial, two letters for a single name, ? when empty', () => {
    expect(driverInitials('Karim Benali')).toBe('KB');
    expect(driverInitials('Karim')).toBe('KA');
    expect(driverInitials('  ')).toBe('?');
  });
});

describe('buildSupportThreads', () => {
  it('folds messages into per-driver threads, oldest first', () => {
    const messages = [
      msg({ id: 'm2', driver_id: 'd1', created_at: '2026-06-07T11:00:00Z' }),
      msg({ id: 'm1', driver_id: 'd1', created_at: '2026-06-07T10:00:00Z' }),
    ];
    const threads = buildSupportThreads(messages, drivers);
    expect(threads).toHaveLength(2); // both drivers appear (d2 has no message)
    expect(threads[0].driver.name).toBe('Karim Benali');
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

  it('includes drivers with no messages, after those who wrote', () => {
    const threads = buildSupportThreads([msg({ id: 'm1', driver_id: 'd1' })], drivers);
    expect(threads.map((t) => t.driver.id)).toEqual(['d1', 'd2']);
    expect(threadPreview(threads[1])).toBe('Aucun message');
  });

  it('among message-less drivers, sorts online first then alphabetically', () => {
    const roster = [
      { id: 'b', name: 'Brahim', is_online: false },
      { id: 'a', name: 'Adil', is_online: false },
      { id: 'z', name: 'Zaid', is_online: true },
    ];
    const threads = buildSupportThreads([], roster);
    expect(threads.map((t) => t.driver.id)).toEqual(['z', 'a', 'b']);
  });

  it('attaches presence, avatar and a derived matricule from roster position', () => {
    const roster = [
      { id: 'd1', name: 'Karim Benali', avatar_url: 'http://x/k.png', is_online: true },
      { id: 'd2', name: 'Yassine Alaoui', avatar_url: null, is_online: false },
    ];
    const threads = buildSupportThreads([], roster);
    const byId = Object.fromEntries(threads.map((t) => [t.driver.id, t.driver]));
    expect(byId.d1).toMatchObject({ matricule: 'LV-01', isOnline: true, avatarUrl: 'http://x/k.png' });
    expect(byId.d2).toMatchObject({ matricule: 'LV-02', isOnline: false, avatarUrl: null });
  });
});

describe('threadPreview', () => {
  it('shows the last message, prefixing staff replies with "Vous : "', () => {
    const threads = buildSupportThreads(
      [
        msg({ id: 'm1', driver_id: 'd1', body: 'Bonjour', created_at: '2026-06-07T10:00:00Z' }),
        msg({ id: 'm2', driver_id: 'd1', sender: 'staff', body: 'Bien reçu', created_at: '2026-06-07T10:05:00Z' }),
      ],
      drivers,
    );
    expect(threadPreview(threads[0])).toBe('Vous : Bien reçu');
  });
});
