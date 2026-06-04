'use client';
// Toast viewport — bottom-centered pill, matching the prototype (app.jsx).
import { useToast } from '@/lib/toast-store';
import { SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from './ui/Icon';

export function ToastViewport() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: SAFE_BOTTOM + 18,
        zIndex: 40,
        background: 'var(--ink)',
        color: '#fff',
        padding: '11px 18px',
        borderRadius: 999,
        fontFamily: 'var(--ui-font)',
        fontSize: 13.5,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name="check" size={16} color="var(--gold)" strokeWidth={2.6} /> {message}
    </div>
  );
}
