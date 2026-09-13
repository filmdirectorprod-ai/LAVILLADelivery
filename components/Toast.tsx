'use client';
// Toast viewport — bottom-centered pill, matching the prototype (app.jsx).
import { useToast } from '@/lib/toast-store';
import { SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from './ui/Icon';

export function ToastViewport() {
  const message = useToast((s) => s.message);
  const tone = useToast((s) => s.tone);
  if (!message) return null;
  const alert = tone === 'alert';
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
        whiteSpace: 'normal',
        maxWidth: 'min(92vw, 420px)',
        textAlign: 'left',
        lineHeight: 1.4,
      }}
    >
      <Icon name={alert ? 'info' : 'check'} size={16} color="var(--gold)" strokeWidth={2.6} style={{ flexShrink: 0 }} /> {message}
    </div>
  );
}
