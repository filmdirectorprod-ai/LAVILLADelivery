'use client';
// Tells the server to drop its cached catalogue after a staff edit.
//
// The admin screens mutate through SECURITY DEFINER RPCs straight from the
// browser, so nothing on the server would otherwise know the catalogue changed
// and customers would keep the cached rows until the 5-minute TTL. Best-effort:
// a failure here only means the change shows up a few minutes later.
export async function revalidateCatalogue(): Promise<void> {
  try {
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'catalogue' }),
    });
  } catch {
    /* offline or blocked — the TTL will catch up */
  }
}
