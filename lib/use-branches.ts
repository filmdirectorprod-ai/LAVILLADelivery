'use client';
// Loads the active La Villa agencies (0033) for admin pickers / filters. Branches
// are public-readable, so a plain client select is fine.
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Branch } from '@/lib/types';

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('slug')
      .then(({ data }) => {
        if (!cancelled) setBranches((data ?? []) as Branch[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return branches;
}
