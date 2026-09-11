// components/admin/ui/CopyButton.tsx
// Copies credentials (or any text) to the clipboard. The Clipboard API only
// exists on https / localhost; the admin is often opened over the LAN in plain
// http, so it falls back to a hidden textarea.
'use client';
import { useState } from 'react';
import { GhostButton } from './Glass';

export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label = 'Copier les identifiants' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'ko'>('idle');
  return (
    <GhostButton onClick={async () => setState((await copyText(value)) ? 'ok' : 'ko')}>
      {state === 'ok' ? 'Copié ✓' : state === 'ko' ? 'Copie impossible' : label}
    </GhostButton>
  );
}
