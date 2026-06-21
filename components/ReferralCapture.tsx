'use client';
// Links a freshly-signed-up customer to their referrer. When a referral code was
// stored by /parrain/<code>, this calls apply_referral_code once the user is signed
// in, then clears it. Mounted in the customer app layout. Renders nothing.
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REFERRAL_KEY = 'lv_ref';

export function ReferralCapture() {
  useEffect(() => {
    let code: string | null = null;
    try {
      code = localStorage.getItem(REFERRAL_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!code) return;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // not signed in yet — keep the code for next visit
      await supabase.rpc('apply_referral_code', { p_code: code });
      try {
        localStorage.removeItem(REFERRAL_KEY); // applied (or rejected) — don't retry
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return null;
}
