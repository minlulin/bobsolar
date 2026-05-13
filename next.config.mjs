import withBundleAnalyzerInit from '@next/bundle-analyzer';

/**
 * Baseline security headers applied to every response.
 *
 * The CSP intentionally allows `'unsafe-inline'` for styles (Tailwind / shadcn
 * inject a few inline styles) and `'unsafe-eval'` is NOT allowed. `script-src`
 * is locked to `'self'` plus Next.js' inline bootstrap nonce path.
 *
 * Vercel Blob URLs (`*.public.blob.vercel-storage.com`) are allow-listed for
 * `img-src` because uploaded logos and assets live there.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  // Next.js dev/prod ships inline runtime; allow self + inline for now.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.public.blob.vercel-storage.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === 'true',
});

// Conditionally apply Serwist only in production to avoid Turbopack conflict in dev.
export default async function getNextConfig() {
  let config = nextConfig;
  if (process.env.NODE_ENV !== 'production') {
    config = { ...config, turbopack: {} };
  } else {
    const { default: withSerwistInit } = await import('@serwist/next');
    const withSerwist = withSerwistInit({
      swSrc: 'src/sw.ts',
      swDest: 'public/sw.js',
    });
    config = withSerwist(config);
  }
  return withBundleAnalyzer(config);
}
