// supabase/functions/push/index.ts
// Sends a Web Push to every device subscription of a user. Called by the
// `trg_push_notification` trigger (pg_net) on each public.notifications insert.
// Auth is a shared secret (x-push-secret) rather than a JWT, so deploy with
// verify_jwt = false. VAPID keys + the secret live in app_config (service-role).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { data: cfgRows } = await supabase
      .from('app_config')
      .select('name,value')
      .in('name', ['vapid_public_key', 'vapid_private_key', 'vapid_subject', 'push_hook_secret']);
    const cfg: Record<string, string> = Object.fromEntries((cfgRows ?? []).map((r) => [r.name, r.value]));

    // Shared-secret auth (the trigger sends x-push-secret).
    if (!cfg.push_hook_secret || req.headers.get('x-push-secret') !== cfg.push_hook_secret) {
      return new Response('forbidden', { status: 401 });
    }

    const payload = await req.json();
    const userId: string | undefined = payload.user_id;
    if (!userId) return new Response(JSON.stringify({ error: 'no user_id' }), { status: 400 });

    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public_key, cfg.vapid_private_key);

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', userId);

    const body = JSON.stringify({
      title: payload.title ?? 'La Villa',
      body: payload.body ?? '',
      kind: payload.kind ?? 'order',
      order_id: payload.order_id ?? null,
    });

    let sent = 0;
    let removed = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            removed++;
          }
        }
      }),
    );

    return new Response(JSON.stringify({ sent, removed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
