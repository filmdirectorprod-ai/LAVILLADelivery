// @vitest-environment jsdom
// Monte l'écran Promotions : statut de chaque code, jauge d'utilisation,
// interrupteur, utilisations récentes ; et l'état vide qui ouvre le formulaire.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { PromotionsScreen } from '../PromotionsScreen';
import type { Promotion } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;
const promo = (over: Partial<Promotion>) =>
  ({
    id: 'p',
    code: 'CODE',
    type: 'percent',
    value: 10,
    min_order_dh: 0,
    starts_at: null,
    ends_at: null,
    max_uses: null,
    max_uses_per_user: null,
    branch_id: null,
    active: true,
    created_at: new Date().toISOString(),
    ...over,
  }) as Promotion;

describe('PromotionsScreen', () => {
  it('rend statuts, jauge, interrupteur et utilisations récentes', () => {
    const promos = [
      promo({ id: 'p1', code: 'BIENVENUE10', max_uses: 100 }),
      promo({ id: 'p2', code: 'ETE', starts_at: new Date(Date.now() + 3 * DAY).toISOString() }),
    ];
    const redemptions = [{ id: 'x1', promotionId: 'p1', discount: 10, createdAt: new Date().toISOString(), orderCode: 'LV-042', orderTotal: 120 }];
    const { container } = render(<PromotionsScreen initial={promos} branches={[]} redemptions={redemptions} />);

    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Programmé')).toBeInTheDocument();
    expect(container.querySelector('[role="meter"][aria-label^="BIENVENUE10"]')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText(/LV-042/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Désactiver le code ETE' })).toHaveAttribute('aria-checked', 'true');
  });

  it("affiche l'état vide et ouvre le formulaire", () => {
    render(<PromotionsScreen initial={[]} branches={[]} redemptions={[]} />);
    expect(screen.getByText('Aucun code promo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau code' }));
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
  });
});
