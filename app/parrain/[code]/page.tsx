'use client';
// /parrain/<code> — referral landing. Stores the referrer's code locally, then
// sends the visitor to onboarding (install / sign up). Once they sign in, the
// ReferralCapture component links them via apply_referral_code. Public route.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const REFERRAL_KEY = 'lv_ref';

export default function ParrainPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  useEffect(() => {
    try {
      localStorage.setItem(REFERRAL_KEY, (params.code || '').trim().toUpperCase());
    } catch {
      /* storage unavailable */
    }
    router.replace('/onboarding');
  }, [params.code, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'var(--ui-font)', color: 'var(--muted)', fontSize: 14 }}>
      Redirection…
    </div>
  );
}
