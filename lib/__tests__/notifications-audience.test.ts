import { describe, it, expect } from 'vitest';
import { isKindVisibleTo, visibleNotifications } from '@/lib/notifications';
import type { Notification } from '@/lib/types';

const n = (kind: string): Notification => ({
  id: kind, user_id: 'u', kind, title: 't', body: 'b', order_id: null, read: false, created_at: '2026-06-20T00:00:00Z',
});

describe('notification audience filter', () => {
  it('hides gérant↔livreur support threads from the customer app', () => {
    expect(isKindVisibleTo('support_staff', 'client')).toBe(false);
    expect(isKindVisibleTo('support_driver', 'client')).toBe(false);
    // customer-relevant kinds stay
    expect(isKindVisibleTo('order', 'client')).toBe(true);
    expect(isKindVisibleTo('message', 'client')).toBe(true);
    expect(isKindVisibleTo('call', 'client')).toBe(true);
    expect(isKindVisibleTo('promo', 'client')).toBe(true);
  });

  it('keeps the gérant reply for the driver app, but not staff-side support', () => {
    expect(isKindVisibleTo('support_driver', 'driver')).toBe(true);
    expect(isKindVisibleTo('support_staff', 'driver')).toBe(false);
  });

  it('visibleNotifications drops the hidden kinds for the customer', () => {
    const list = [n('order'), n('support_staff'), n('message'), n('support_driver'), n('call')];
    expect(visibleNotifications(list, 'client').map((x) => x.kind)).toEqual(['order', 'message', 'call']);
  });
});
