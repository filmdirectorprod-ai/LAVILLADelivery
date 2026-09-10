/**
 * Product photos live in Supabase Storage, so next/image needs that host on its
 * allow-list before it will optimise them. The URL is read from the same env var
 * the Supabase clients use, so staging and production each allow their own
 * project and nothing else.
 */
// Guarded: a malformed value would otherwise throw here and take the whole build
// down. With no pattern registered, next/image REFUSES a Storage src rather than
// loading it unoptimised, so product photos would not render — but the app needs
// this variable to reach Supabase at all, so that case is already fatal. The
// guard exists to fail with a readable warning instead of a config stack trace.
let supabaseHost = null;
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  }
} catch {
  console.warn('[next.config] NEXT_PUBLIC_SUPABASE_URL is not a valid URL — next/image will not optimise Supabase Storage photos.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
    // The app is a phone-first PWA: no point generating desktop-sized variants.
    imageSizes: [64, 96, 128, 256, 384],
    deviceSizes: [360, 414, 640, 828, 1080],
  },
};

export default nextConfig;
