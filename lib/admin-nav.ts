// Admin sidebar model. `icon` names map to components/ui/Icon. Keep this list as
// the single source of truth for the admin route set (used by AdminChrome and
// the nav tests). Pages are added section-by-section across the build phases.
export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: "Vue d'ensemble", icon: 'home' },
  { href: '/admin/orders', label: 'Commandes', icon: 'receipt' },
  { href: '/admin/kitchen', label: 'Cuisine', icon: 'store' },
  { href: '/admin/products', label: 'Produits', icon: 'bag' },
  { href: '/admin/drivers', label: 'Livreurs', icon: 'scooter' },
  { href: '/admin/reviews', label: 'Avis clients', icon: 'star' },
  { href: '/admin/zones', label: 'Zones de livraison', icon: 'pin' },
  { href: '/admin/support', label: 'Support livreurs', icon: 'message' },
  { href: '/admin/incidents', label: 'Incidents', icon: 'info' },
  { href: '/admin/planning', label: 'Planning', icon: 'calendar' },
  { href: '/admin/stats', label: 'Statistiques', icon: 'star' },
  { href: '/admin/promotions', label: 'Promotions', icon: 'tag' },
  { href: '/admin/managers', label: 'Gérants', icon: 'user' },
];

/** Whether `href` is the active section for the current `pathname`. The overview
 *  ('/admin') matches only exactly; every other section also matches sub-paths. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}
