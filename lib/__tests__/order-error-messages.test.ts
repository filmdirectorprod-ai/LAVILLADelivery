import { describe, it, expect } from 'vitest';
import { customerMessage } from '@/lib/order-error-messages';

describe('customerMessage', () => {
  it('names the unavailable product in French', () => {
    expect(customerMessage('product Tarte au citron out of stock at branch')).toBe(
      "« Tarte au citron » n'est plus disponible. Retirez-le du panier pour continuer.",
    );
  });

  it('maps the other place_order exceptions', () => {
    expect(customerMessage('invalid promo code')).toBe("Ce code promo n'est pas valide.");
    expect(customerMessage('empty order')).toBe('Votre panier est vide.');
    expect(customerMessage('forbidden')).toContain('Session expirée');
  });

  it('passes an unmapped fault through rather than hiding it', () => {
    expect(customerMessage('deadlock detected')).toBe('deadlock detected');
  });
});
