/**
 * Product photos live in Supabase Storage, so next/image needs that host on its
 * allow-list before it will optimise them. The URL is read from the same env var
 * the Supabase clients use, so staging and production each allow their own
 * project and nothing else.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

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
