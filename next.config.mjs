import withBundleAnalyzerInit from '@next/bundle-analyzer';

/**
 * Baseline security headers applied to every response.
 *
 * In dev mode Turbopack + React Server Components need `'unsafe-eval'`
 * for the RSC protocol (react-server-dom-turbopack uses eval internally).
 * In production `'unsafe-eval'` is removed to minimise the CSP attack surface.
 *
 * Vercel Blob URLs (`*.public.blob.vercel-storage.com`) are allow-listed for
 * `img-src` because uploaded logos and assets live there.
 */
/** @param {boolean} isDev */
function buildCsp(isDev) {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.public.blob.vercel-storage.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

/** @param {boolean} isDev */
function buildSecurityHeaders(isDev) {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(isDev) },
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
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
  // Prevent Next.js from bundling ws/pg native addons into serverless functions.
  // Vercel provides these at runtime; bundling causes native addon load failures
  // (e.g. 'b.mask is not a function' from bufferutil).
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      'date-fns',
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(isDev),
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
