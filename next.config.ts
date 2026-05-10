import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
};

// Conditionally apply Serwist only in production to avoid Turbopack conflict in dev.
// Next.js supports async next.config.* exports.
export default async function getNextConfig(): Promise<NextConfig> {
  if (process.env.NODE_ENV !== 'production') return nextConfig;

  const withSerwistInit = (await import('@serwist/next')).default;
  const withSerwist = withSerwistInit({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
  });

  return withSerwist(nextConfig);
}
