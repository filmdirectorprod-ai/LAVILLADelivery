// @vitest-environment jsdom
// La cloche ouvre un panneau BLANC, et elle sert trois applications dont deux
// ont l'encre blanche (--ink: #ffffff sous .lv-driver-root et .lv-admin-root).
// Le panneau héritait de ce jeton : titre, messages et dates s'écrivaient en
// blanc sur blanc, et le panneau paraissait vide tout en recouvrant l'écran.
//
// Ce test monte la cloche DANS un thème à encre blanche — la situation exacte
// de l'application livreur — et vérifie que le panneau impose la sienne.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const notifications = [
  { id: 'n1', title: 'Nouvelle course', body: 'CMD-1234 est prête.', kind: 'driver_order', read: false, created_at: new Date().toISOString() },
];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: notifications }) }),
        }),
      }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  }),
}));
vi.mock('@/lib/use-beep', () => ({ useBeep: () => ({ beep: () => {} }) }));

import { UserNotificationBell } from '../UserNotificationBell';

describe('UserNotificationBell dans un thème à encre blanche', () => {
  beforeEach(() => vi.clearAllMocks());

  it('impose une encre sombre à son panneau blanc', async () => {
    // Le thème livreur : tout le contenu hérite d'une encre blanche.
    const { container } = render(
      <div style={{ ['--ink' as string]: '#ffffff', color: '#ffffff' }}>
        <UserNotificationBell audience="driver" />
      </div>,
    );

    fireEvent.click(screen.getByLabelText('Notifications'));
    const titre = await screen.findByText('Notifications');
    const panneau = titre.parentElement as HTMLElement;

    // Le panneau redéfinit --ink pour lui-même : sans cela, son contenu est
    // blanc sur blanc.
    expect(panneau.style.getPropertyValue('--ink')).toBe('#0f606b');
    expect(panneau.style.background).toContain('rgb(255, 255, 255)');
    expect(container).toBeTruthy();
  });

  it('affiche réellement le contenu des notifications', async () => {
    render(<UserNotificationBell audience="driver" />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Nouvelle course')).toBeTruthy());
    expect(screen.getByText('CMD-1234 est prête.')).toBeTruthy();
  });

  it('ne peint la pastille ni en rouge ni en or : elle doit tenir sur les deux fonds', async () => {
    render(<UserNotificationBell audience="driver" />);
    const pastille = await screen.findByText('1');
    const fond = pastille.style.background;
    expect(fond).not.toMatch(/e0483d|rgb\(224, 72, 61\)/i);
    expect(fond).not.toMatch(/a89723|rgb\(168, 151, 35\)/i);
    // Cerclée de blanc pour se détacher du turquoise foncé du livreur.
    expect(pastille.style.border).toContain('rgb(255, 255, 255)'); // jsdom normalise le hex
  });
});
