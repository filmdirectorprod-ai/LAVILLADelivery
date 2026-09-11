// @vitest-environment jsdom
// Monte le Support : filtre « À répondre » et réponses rapides.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/use-beep', () => ({ useBeep: () => ({ beep: () => {} }) }));

import { SupportScreen } from '../SupportScreen';
import type { AdminSupportData } from '@/lib/queries';

const msg = (id: string, driver: string, sender: 'driver' | 'staff', body: string, read: boolean) => ({ id, driver_id: driver, sender, body, read_by_staff: read, created_at: new Date().toISOString() });
const thread = (id: string, name: string, messages: ReturnType<typeof msg>[], unread: number) => ({ driver: { id, name, avatarUrl: null, isOnline: true, matricule: 'LV-01' }, messages, unread });
const initial = {
  threads: [thread('k', 'Karim', [msg('1', 'k', 'driver', 'Client absent', false)], 1), thread('s', 'Sanaé', [msg('2', 's', 'staff', 'OK', true)], 0)],
} as unknown as AdminSupportData;

describe('SupportScreen', () => {
  it('filtre les conversations à répondre et remplit une réponse rapide', () => {
    render(<SupportScreen initial={initial} />);
    expect(screen.getByRole('button', { name: /Sanaé/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^À répondre/ }));
    expect(screen.queryByRole('button', { name: /Sanaé/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bien reçu, je regarde.' }));
    expect(screen.getByLabelText('Message à Karim')).toHaveValue('Bien reçu, je regarde.');
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
  });
});
